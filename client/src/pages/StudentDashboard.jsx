import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, CalendarClock, CalendarDays, CheckCircle2, Pencil, Play, Star, Trash2, XCircle } from 'lucide-react';
import client, { errMsg } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import Avatar from '../components/Avatar.jsx';
import StarRating from '../components/StarRating.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { SkeletonCard, SkeletonStat } from '../components/Skeleton.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Modal from '../components/Modal.jsx';
import BookingDetailsModal from '../components/BookingDetailsModal.jsx';
import { formatDate, formatTime, todayInZone, buildSlotStarts } from '../utils/time.js';
import { BOOKING_STATUS_STYLE } from '../utils/status.js';

/** Labels shown in the "Showing: …" line above the list, one per stat-card filter. */
const FILTER_LABELS = {
  all: 'All sessions',
  upcoming: 'Upcoming sessions',
  completed: 'Completed sessions',
  cancelled: 'Cancelled sessions',
};

/** Empty-state icons per stat-card filter. */
const EMPTY_ICONS = { all: CalendarDays, upcoming: CalendarClock, completed: CheckCircle2, cancelled: XCircle };

/** True when a booking's start (local date + start time) is still in the future in its own timezone. */
function bookingStartsInFuture(b) {
  if (!b.date || !b.startTime) return false;
  const tz = b.timeZone || 'Asia/Kolkata';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  const get = (type) => parts.find((p) => p.type === type)?.value || '';
  const nowStr = `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
  return `${b.date}T${b.startTime}` >= nowStr;
}

/** "Upcoming sessions" rule: confirmed AND the session start time is still in the future. */
function isUpcomingBooking(b) {
  return b.status === 'confirmed' && bookingStartsInFuture(b);
}

function StatCard({ icon: Icon, label, value, iconCls = 'from-blue-600 to-indigo-600', active = false, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`card group w-full cursor-pointer p-5 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 ${
        active
          ? '-translate-y-0.5 border-indigo-500 shadow-lg shadow-indigo-600/20 ring-2 ring-indigo-500/30'
          : 'hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md'
      }`}
    >
      <div className="flex items-center justify-between">
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${iconCls} shadow-md transition-transform duration-200 group-hover:scale-110`}
        >
          <Icon className="h-5 w-5 text-white" strokeWidth={2.2} />
        </span>
        <span className="text-2xl font-extrabold text-slate-900 dark:text-white">{value}</span>
      </div>
      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">{label}</p>
    </button>
  );
}

export default function StudentDashboard() {
  const toast = useToast();
  const [upcoming, setUpcoming] = useState([]);
  const [past, setPast] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('upcoming');

  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const [reschedTarget, setReschedTarget] = useState(null);
  const [reschedDate, setReschedDate] = useState(() => todayInZone());
  const [reschedSlots, setReschedSlots] = useState([]);
  const [reschedTime, setReschedTime] = useState('');
  const [rescheduling, setRescheduling] = useState(false);

  const [myReviews, setMyReviews] = useState([]);
  const [reviewTarget, setReviewTarget] = useState(null);
  const [editingReview, setEditingReview] = useState(null); // review being edited, or null when writing a new one
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deleteReviewTarget, setDeleteReviewTarget] = useState(null);
  const [deletingReview, setDeletingReview] = useState(false);

  const [detailsTarget, setDetailsTarget] = useState(null);

  // Frontend search & filters (no API changes)
  const [q, setQ] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState('all'); // stat-card filter: all | upcoming | completed | cancelled

  const loadBookings = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data }, rRes] = await Promise.all([
        client.get('/bookings/my-bookings'),
        client.get('/reviews/mine'),
      ]);
      setUpcoming(data.upcoming);
      setPast(data.past);
      setMyReviews(rRes.data.reviews);
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  const handleCancel = async () => {
    setCancelling(true);
    try {
      const { data } = await client.post(`/bookings/${cancelTarget._id}/cancel`, { reason: cancelReason });
      toast(data.message);
      setCancelTarget(null);
      setCancelReason('');
      loadBookings();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setCancelling(false);
    }
  };

  const openReschedule = (b) => {
    setReschedTarget(b);
    setReschedDate(b.date);
    setReschedTime('');
    loadReschedSlots(b.mentor._id, b.date);
  };

  const loadReschedSlots = async (mentorId, d) => {
    try {
      const { data } = await client.get(`/availability/mentors/${mentorId}?date=${d}`);
      setReschedSlots(
        buildSlotStarts({
          ranges: data.ranges,
          booked: data.booked,
          sessionDuration: data.sessionDuration,
          date: d,
          timeZone: data.timeZone,
        })
      );
    } catch (err) {
      setReschedSlots([]);
      toast(errMsg(err), 'error');
    }
  };

  const handleReschedule = async () => {
    if (!reschedTime) {
      toast('Please pick a new time.', 'info');
      return;
    }
    setRescheduling(true);
    try {
      const { data } = await client.post(`/bookings/${reschedTarget._id}/reschedule`, {
        newDate: reschedDate,
        newStartTime: reschedTime,
      });
      toast(data.message);
      setReschedTarget(null);
      loadBookings();
    } catch (err) {
      toast(errMsg(err), 'error');
      if (err.response?.status === 409) loadReschedSlots(reschedTarget.mentor._id, reschedDate);
    } finally {
      setRescheduling(false);
    }
  };

  const openWriteReview = (b) => {
    setReviewTarget(b);
    setEditingReview(null);
    setRating(0);
    setComment('');
  };

  const openEditReview = (b, r) => {
    setReviewTarget(b);
    setEditingReview(r);
    setRating(r.rating);
    setComment(r.comment || '');
  };

  /** True when this booking already has a review from the current student. */
  const reviewFor = (bookingId) => myReviews.find((r) => r.booking?._id?.toString() === bookingId);

  const handleSubmitReview = async () => {
    if (!rating) {
      toast('Please select a star rating.', 'info');
      return;
    }
    setSubmitting(true);
    try {
      if (editingReview) {
        await client.patch(`/reviews/${editingReview._id}`, { rating, comment });
        toast('Review updated!');
      } else {
        await client.post('/reviews', {
          bookingId: reviewTarget._id,
          rating,
          comment,
        });
        toast('Thanks for your review!');
      }
      setReviewTarget(null);
      setEditingReview(null);
      setComment('');
      setRating(0);
      loadBookings();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteReview = async () => {
    setDeletingReview(true);
    try {
      await client.delete(`/reviews/${deleteReviewTarget._id}`);
      toast('Review deleted.');
      setDeleteReviewTarget(null);
      loadBookings();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setDeletingReview(false);
    }
  };

  const allBookings = [...upcoming, ...past];
  const totalBookings = allBookings.length;
  const upcomingCount = allBookings.filter(isUpcomingBooking).length;
  const completedCount = allBookings.filter((b) => b.status === 'completed').length;
  const cancelledCount = allBookings.filter((b) => b.status === 'cancelled').length;

  const list = activeTab === 'upcoming' ? upcoming : past;
  // Counts shown in the "Showing: …" line always describe the current tab's list.
  const filterCounts = {
    all: list.length,
    upcoming: list.filter(isUpcomingBooking).length,
    completed: list.filter((b) => b.status === 'completed').length,
    cancelled: list.filter((b) => b.status === 'cancelled').length,
  };
  const filtered = useMemo(
    () =>
      list.filter((b) => {
        // Stat-card filter first; search/date/status filters compose on top of it.
        if (activeFilter === 'upcoming' && !isUpcomingBooking(b)) return false;
        if (activeFilter === 'completed' && b.status !== 'completed') return false;
        if (activeFilter === 'cancelled' && b.status !== 'cancelled') return false;
        const name = (b.mentor?.name || '').toLowerCase();
        if (q.trim() && !name.includes(q.trim().toLowerCase())) return false;
        if (dateFilter && b.date !== dateFilter) return false;
        if (statusFilter && b.status !== statusFilter) return false;
        return true;
      }),
    [list, activeFilter, q, dateFilter, statusFilter]
  );

  const hasFilters = q.trim() || dateFilter || statusFilter;
  const clearFilters = () => {
    setQ('');
    setDateFilter('');
    setStatusFilter('');
    setActiveFilter('all');
  };

  /** Manual tab click: switch the bucket and reset the stat-card filter. */
  const handleTab = (tab) => {
    setActiveTab(tab);
    setActiveFilter('all');
  };

  /** Stat-card click: apply its filter and auto-switch to the matching tab. */
  const selectFilter = (f) => {
    const next = activeFilter === f && f !== 'all' ? 'all' : f;
    setActiveFilter(next);
    if (next === 'upcoming') setActiveTab('upcoming');
    else if (next === 'completed' || next === 'cancelled') setActiveTab('past');
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      {/* Welcome + quick actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="kicker">Student dashboard</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">My sessions</h1>
          <p className="mt-1 text-slate-500 dark:text-slate-400">Manage your bookings, join meetings and leave reviews.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" onClick={() => handleTab(activeTab === 'upcoming' ? 'past' : 'upcoming')}>
            {activeTab === 'upcoming' ? 'View past' : 'View upcoming'}
          </button>
          <Link to="/mentors" className="btn-primary">Find more mentors</Link>
        </div>
      </div>

      {/* Stat cards */}
      {loading ? (
        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonStat key={i} />
          ))}
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard icon={BarChart3} label="Total bookings" value={totalBookings} active={activeFilter === 'all'} onClick={() => selectFilter('all')} />
          <StatCard icon={CalendarClock} label="Upcoming sessions" value={upcomingCount} iconCls="from-indigo-600 to-blue-600" active={activeFilter === 'upcoming'} onClick={() => selectFilter('upcoming')} />
          <StatCard icon={CheckCircle2} label="Completed" value={completedCount} iconCls="from-emerald-500 to-teal-500" active={activeFilter === 'completed'} onClick={() => selectFilter('completed')} />
          <StatCard icon={XCircle} label="Cancelled" value={cancelledCount} iconCls="from-rose-500 to-pink-500" active={activeFilter === 'cancelled'} onClick={() => selectFilter('cancelled')} />
        </div>
      )}

      {/* Tabs + filters */}
      <div className="mt-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="inline-flex w-fit rounded-xl border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          {['upcoming', 'past'].map((tab) => (
            <button
              key={tab}
              onClick={() => handleTab(tab)}
              className={`flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-semibold capitalize transition-all duration-200 ${
                activeTab === tab
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-indigo-600/25'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
              }`}
            >
              {tab}
              <span
                className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold ${
                  activeTab === tab ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300'
                }`}
              >
                {tab === 'upcoming' ? upcoming.length : past.length}
              </span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <svg
              className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <circle cx="9" cy="9" r="6" />
              <path d="M13.5 13.5L18 18" />
            </svg>
            <input
              className="input !w-44 !py-2 pl-9"
              placeholder="Search mentor…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <input
            type="date"
            className="input !w-40 !py-2"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            aria-label="Filter by date"
          />
          <select className="input !w-auto !py-2" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            <option value="confirmed">Confirmed</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="mt-6 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : (
        <>
          <p aria-live="polite" className="mt-6 text-sm text-slate-500 dark:text-slate-400">
            Showing:{' '}
            <span className="font-semibold text-slate-700 dark:text-slate-200">{FILTER_LABELS[activeFilter]}</span>{' '}
            <span className="font-bold text-slate-900 dark:text-white">({filterCounts[activeFilter]})</span>
          </p>
          {filtered.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                icon={EMPTY_ICONS[activeFilter]}
                title={
                  hasFilters
                    ? 'No matching sessions'
                    : activeFilter === 'completed'
                    ? 'No completed sessions yet.'
                    : activeFilter === 'cancelled'
                    ? 'No cancelled sessions.'
                    : activeFilter === 'upcoming'
                    ? 'No upcoming sessions yet.'
                    : activeTab === 'upcoming'
                    ? 'No upcoming sessions'
                    : 'No past sessions'
                }
                subtitle={
                  hasFilters
                    ? 'Try adjusting your search or filters.'
                    : activeFilter === 'completed'
                    ? 'Sessions your mentors complete will appear here.'
                    : activeFilter === 'cancelled'
                    ? 'Sessions you cancel will appear here.'
                    : activeFilter === 'upcoming'
                    ? 'Book a session with a mentor to see it here.'
                    : activeTab === 'upcoming'
                    ? 'Browse mentors and book your first session today!'
                    : 'Your completed and cancelled sessions will appear here.'
                }
                action={
                  hasFilters ? (
                    <button className="btn-secondary" onClick={clearFilters}>Clear filters</button>
                  ) : activeTab === 'upcoming' ? (
                    <Link to="/mentors" className="btn-primary">Browse mentors</Link>
                  ) : null
                }
              />
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              {filtered.map((b) => (
                <div
                  key={b._id}
                  className="group card flex flex-col gap-4 p-5 transition-all duration-200 hover:border-indigo-200 hover:shadow-md sm:flex-row sm:items-center"
                >
                  <Link to={`/mentors/${b.mentor._id}`} className="flex items-center gap-3 sm:min-w-[230px]">
                    <Avatar name={b.mentor.name} src={b.mentor.avatar} size="md" />
                    <div>
                      <p className="font-bold text-slate-900 transition group-hover:text-indigo-700 dark:text-slate-100">{b.mentor.name}</p>
                      <p className="text-xs text-slate-400">Mentor</p>
                    </div>
                  </Link>
                  <div className="flex-1 text-sm text-slate-600 dark:text-slate-300">
                    <p className="font-semibold text-slate-800 dark:text-slate-100">
                      {formatDate(b.date)} · {formatTime(b.startTime)} – {formatTime(b.endTime)}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                      Sessions: {b.rescheduleCount > 0 ? `rescheduled ${b.rescheduleCount}×` : 'original time'}
                    </p>
                    {b.notes && <p className="mt-1 truncate text-xs italic text-slate-400 dark:text-slate-500">"{b.notes}"</p>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    {b.status === 'confirmed' && (
                      <>
                        {b.meetLink && (
                          <a href={b.meetLink} target="_blank" rel="noreferrer" className="btn-primary !py-2">
                            <Play className="h-3.5 w-3.5" /> Join Meet
                          </a>
                        )}
                        <button className="btn-secondary !py-2" onClick={() => openReschedule(b)}>Reschedule</button>
                        <button className="btn-danger !py-2" onClick={() => setCancelTarget(b)}>Cancel</button>
                      </>
                    )}
                    {b.status === 'completed' &&
                      (reviewFor(b._id) ? (
                        <>
                          <div className="flex items-center gap-1.5 rounded-lg border border-amber-100 bg-amber-50/80 px-2.5 py-1.5 dark:border-amber-500/30 dark:bg-amber-500/10">
                            <StarRating value={reviewFor(b._id).rating} size="text-sm" />
                            <span className="text-xs font-bold text-amber-700 dark:text-amber-300">Reviewed</span>
                          </div>
                          <button className="btn-secondary !py-2" onClick={() => openEditReview(b, reviewFor(b._id))}>
                            <Pencil className="h-3.5 w-3.5" /> Edit review
                          </button>
                          <button
                            className="btn-danger !py-2"
                            onClick={() => setDeleteReviewTarget(reviewFor(b._id))}
                            title="Delete review"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Delete
                          </button>
                        </>
                      ) : (
                        <button className="btn-primary !py-2" onClick={() => openWriteReview(b)}>
                          <Star className="h-3.5 w-3.5" /> Write review
                        </button>
                      ))}
                    <button className="btn-ghost !px-3 !py-2 text-sm" onClick={() => setDetailsTarget(b)}>
                      Details
                    </button>
                    <span className={`chip ${BOOKING_STATUS_STYLE[b.status] || ''}`}>{b.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Cancel confirmation (custom modal with reason input) */}
      {cancelTarget && (
        <Modal open={!!cancelTarget} title="Cancel this session?" onClose={() => setCancelTarget(null)} size="sm">
          <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            Cancel your session with <strong className="text-slate-700 dark:text-slate-200">{cancelTarget.mentor.name}</strong> on{' '}
            <strong className="text-slate-700 dark:text-slate-200">{formatDate(cancelTarget.date)} at {formatTime(cancelTarget.startTime)}</strong>?
            Both you and the mentor will get an email notification.
          </p>
          <label className="label mt-4">Reason (optional)</label>
          <input className="input" placeholder="Why are you cancelling?" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
          <div className="mt-5 flex gap-3">
            <button className="btn-secondary flex-1" onClick={() => setCancelTarget(null)} disabled={cancelling}>
              Keep session
            </button>
            <button className="btn-danger flex-1" onClick={handleCancel} disabled={cancelling}>
              {cancelling ? 'Cancelling…' : 'Yes, cancel'}
            </button>
          </div>
        </Modal>
      )}

      {/* Reschedule modal */}
      {reschedTarget && (
        <Modal open={!!reschedTarget} title="Reschedule session" onClose={() => setReschedTarget(null)}>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Pick a new time. Both you and the mentor will be notified by email.
          </p>
          <div className="mt-4">
            <input
              type="date"
              className="input"
              min={todayInZone()}
              value={reschedDate}
              onChange={(e) => { setReschedDate(e.target.value); setReschedTime(''); loadReschedSlots(reschedTarget.mentor._id, e.target.value); }}
            />
          </div>
          <div className="mt-4 grid max-h-56 grid-cols-3 gap-2 overflow-y-auto pr-1">
            {reschedSlots.length === 0 ? (
              <p className="col-span-3 py-6 text-center text-sm text-slate-400 dark:text-slate-500">No free slots on this day.</p>
            ) : (
              reschedSlots.map((s) => (
                <button
                  key={s}
                  onClick={() => setReschedTime(s)}
                  className={`rounded-lg border-2 px-2 py-2 text-sm font-semibold transition-all duration-150 ${
                    reschedTime === s
                      ? 'border-indigo-500 bg-indigo-600 text-white shadow-md'
                      : 'border-indigo-100 bg-indigo-50/50 text-indigo-700 hover:border-indigo-400 hover:bg-indigo-100/60 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:bg-indigo-500/20'
                  }`}
                >
                  {formatTime(s)}
                </button>
              ))
            )}
          </div>
          <div className="mt-5 flex gap-3">
            <button className="btn-secondary flex-1" onClick={() => setReschedTarget(null)}>Close</button>
            <button className="btn-primary flex-1" onClick={handleReschedule} disabled={rescheduling || !reschedTime}>
              {rescheduling ? 'Rescheduling…' : 'Confirm new time'}
            </button>
          </div>
        </Modal>
      )}

      {/* Review modal (create & edit) */}
      {reviewTarget && (
        <Modal
          open={!!reviewTarget}
          title={editingReview ? `Edit review for ${reviewTarget.mentor.name}` : `Rate ${reviewTarget.mentor.name}`}
          onClose={() => setReviewTarget(null)}
        >
          <p className="text-center text-xs font-medium text-slate-400 dark:text-slate-500">
            {editingReview ? 'Update your rating and feedback.' : 'Tap a star to rate this session.'}
          </p>
          <div className="mt-3 flex justify-center">
            <StarRating value={rating} onChange={setRating} size="text-3xl" />
          </div>
          {!rating && (
            <p className="mt-2 text-center text-xs font-semibold text-rose-500">A star rating is required</p>
          )}
          <label className="label mt-4">
            Your review <span className="font-normal text-slate-400 dark:text-slate-500">(optional)</span>
          </label>
          <textarea
            className="input min-h-[90px] resize-none"
            placeholder="How was the session?"
            value={comment}
            maxLength={500}
            onChange={(e) => setComment(e.target.value)}
          />
          <div className="mt-1 text-right text-xs text-slate-400 dark:text-slate-500">{comment.length}/500</div>
          <div className="mt-4 flex gap-3">
            <button className="btn-secondary flex-1" onClick={() => setReviewTarget(null)}>Cancel</button>
            <button className="btn-primary flex-1" onClick={handleSubmitReview} disabled={submitting || !rating}>
              {submitting ? 'Submitting…' : editingReview ? 'Update review' : 'Submit review'}
            </button>
          </div>
        </Modal>
      )}

      {/* Delete review confirmation */}
      <ConfirmDialog
        open={!!deleteReviewTarget}
        onClose={() => setDeleteReviewTarget(null)}
        onConfirm={handleDeleteReview}
        title="Delete this review?"
        message={`This permanently removes your ${deleteReviewTarget?.rating}★ review for ${deleteReviewTarget?.mentor?.name || 'this mentor'}. This cannot be undone.`}
        confirmLabel="Yes, delete"
        cancelLabel="Keep review"
        tone="danger"
        loading={deletingReview}
      />

      {/* Booking details */}
      <BookingDetailsModal booking={detailsTarget} onClose={() => setDetailsTarget(null)} />
    </div>
  );
}
