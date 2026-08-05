import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import client, { errMsg } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import Avatar from '../components/Avatar.jsx';
import StarRating from '../components/StarRating.jsx';
import ReviewCard from '../components/ReviewCard.jsx';
import Spinner from '../components/Spinner.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Modal from '../components/Modal.jsx';
import CalendarView from '../components/CalendarView.jsx';
import { buildSlotStarts, todayInZone, addDays, formatDate, formatTime } from '../utils/time.js';

function addMinutes(timeStr, minutes) {
  const [h, m] = timeStr.split(':').map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export default function MentorDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();

  const [mentor, setMentor] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [reviewStats, setReviewStats] = useState({ avg: 0, count: 0, distribution: [] });
  const [loading, setLoading] = useState(true);

  const [date, setDate] = useState(() => todayInZone());
  const [avail, setAvail] = useState(null);
  const [slotStarts, setSlotStarts] = useState([]);
  const [availLoading, setAvailLoading] = useState(false);

  const [selected, setSelected] = useState(null); // 'HH:mm'
  const [notes, setNotes] = useState('');
  const [booking, setBooking] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [mRes, rRes] = await Promise.all([
          client.get(`/mentors/${id}`),
          client.get(`/reviews/mentor/${id}`),
        ]);
        const m = mRes.data.mentor;
        setMentor(m);
        setReviews(rRes.data.reviews);
        setReviewStats(rRes.data.stats || { avg: 0, count: 0, distribution: [] });
        // Start the date picker on the mentor's own "today" (not the client's)
        setDate((d) => (d < todayInZone(m.timeZone) ? todayInZone(m.timeZone) : d));
      } catch (err) {
        toast(errMsg(err), 'error');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, toast]);

  const loadAvailability = useCallback(async (d) => {
    setAvailLoading(true);
    try {
      const { data } = await client.get(`/availability/mentors/${id}?date=${d}`);
      setAvail(data);
      setSlotStarts(
        buildSlotStarts({
          ranges: data.ranges,
          booked: data.booked,
          sessionDuration: data.sessionDuration,
          date: d,
          timeZone: data.timeZone,
        })
      );
    } catch (err) {
      toast(errMsg(err), 'error');
      setAvail(null);
      setSlotStarts([]);
    } finally {
      setAvailLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    if (mentor) loadAvailability(date);
  }, [mentor, date, loadAvailability]);

  const openBook = (start) => {
    if (!user) {
      toast('Please login to book a session.', 'info');
      return;
    }
    if (user.role !== 'student') {
      toast('Only student accounts can book sessions.', 'info');
      return;
    }
    setSelected(start);
    setShowModal(true);
  };

  const confirmBooking = async () => {
    setBooking(true);
    try {
      const { data } = await client.post('/bookings', {
        mentorId: id,
        date,
        startTime: selected,
        notes,
      });
      toast(data.message);
      setShowModal(false);
      setNotes('');
      // Refresh availability so the booked slot disappears
      loadAvailability(date);
    } catch (err) {
      // 409 = someone grabbed the slot first — reload so it disappears
      if (err.response?.status === 409) {
        toast(errMsg(err), 'error');
        loadAvailability(date);
        setShowModal(false);
      } else {
        toast(errMsg(err), 'error');
      }
    } finally {
      setBooking(false);
    }
  };

  if (loading) return <Spinner />;
  if (!mentor) {
    return (
      <EmptyState
        icon="👤"
        title="Mentor not found"
        subtitle="This mentor may have been removed."
        action={<Link to="/mentors" className="btn-secondary">Browse mentors</Link>}
      />
    );
  }

  const dateLabel = date === todayInZone(mentor.timeZone) ? 'Today' : formatDate(date);
  const isStudent = user?.role === 'student';

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      {/* Header card */}
      <div className="card overflow-hidden">
        <div className="relative h-32 overflow-hidden bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-800">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-16 -left-8 h-40 w-40 rounded-full bg-blue-300/20 blur-2xl" />
        </div>
        <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-end sm:p-8">
          <div className="-mt-20">
            <Avatar name={mentor.name} src={mentor.avatar} size="xl" className="!ring-4 !ring-white shadow-xl shadow-indigo-900/20 dark:!ring-slate-900" />
          </div>
          <div className="min-w-0 flex-1 pt-2 sm:pt-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-3xl">{mentor.name}</h1>
              <span className="chip bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30">
                <span className="mr-1 inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Verified mentor
              </span>
              {mentor.isOnline ? (
                <span className="chip bg-emerald-500/10 text-emerald-700 ring-1 ring-inset ring-emerald-500/30 dark:text-emerald-300">
                  <span className="mr-1 inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                  Online now
                </span>
              ) : (
                <span className="chip bg-slate-100 text-slate-500 ring-1 ring-inset ring-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700">
                  <span className="mr-1 inline-flex h-1.5 w-1.5 rounded-full bg-slate-400" />
                  Offline
                </span>
              )}
            </div>
            <p className="mt-1 text-slate-500 dark:text-slate-400">{mentor.headline || 'Mentor'}</p>
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <StarRating value={Math.round(mentor.ratingAvg)} size="text-sm" />
                <span className="font-semibold text-slate-700 dark:text-slate-200">{mentor.ratingAvg.toFixed(1)}</span>
                <span>({mentor.ratingCount} reviews)</span>
              </span>
              <span className="flex items-center gap-1.5">💼 {mentor.experienceYears} yrs experience</span>
              <span className="flex items-center gap-1.5">📍 {mentor.location || 'Remote'}</span>
              <span className="flex items-center gap-1.5">⏱️ {mentor.sessionDuration} min sessions</span>
              {typeof mentor.totalSessions === 'number' && (
                <span className="flex items-center gap-1.5">📈 {mentor.totalSessions} sessions</span>
              )}
            </div>
          </div>
          <div className="shrink-0 rounded-2xl border border-indigo-100 bg-gradient-to-br from-blue-50 to-indigo-50 px-7 py-5 text-center shadow-sm dark:border-indigo-500/30 dark:from-indigo-500/10 dark:to-blue-500/10">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-3xl font-extrabold text-transparent">
              ₹{mentor.hourlyRate}
            </div>
            <div className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">per hour</div>
          </div>
        </div>
        <div className="border-t border-slate-100 px-6 py-6 sm:px-8 dark:border-slate-800">
          <p className="kicker">About</p>
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            {mentor.bio || 'No bio yet.'}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {mentor.expertise.map((e) => (
              <span key={e} className="chip bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-100 dark:bg-indigo-500/15 dark:text-indigo-300 dark:ring-indigo-500/30">
                {e}
              </span>
            ))}
          </div>
          {mentor.languages?.length > 0 && (
            <p className="mt-4 text-xs text-slate-400 dark:text-slate-500">Speaks: {mentor.languages.join(', ')}</p>
          )}
        </div>
      </div>

      {/* Booking section */}
      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        {/* Calendar */}
        <div className="card p-5">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Availability calendar</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Pick a highlighted date to see its free slots.
          </p>
          <div className="mt-4">
            <CalendarView
              mentorId={id}
              timeZone={mentor.timeZone}
              sessionDuration={mentor.sessionDuration}
              selectedDate={date}
              onSelectDate={setDate}
            />
          </div>
        </div>

        {/* Free slots */}
        <div className="card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Free slots</h2>
            <div className="flex items-center gap-2">
              <button
                className="btn-ghost !px-3 !py-2 text-sm"
                onClick={() => setDate(addDays(date, -1, mentor.timeZone))}
                disabled={date <= todayInZone(mentor.timeZone)}
                aria-label="Previous day"
              >
                ←
              </button>
              <span className="min-w-[130px] text-center text-sm font-semibold text-slate-700 dark:text-slate-200">
                {dateLabel}
              </span>
              <button className="btn-ghost !px-3 !py-2 text-sm" onClick={() => setDate(addDays(date, 1, mentor.timeZone))} aria-label="Next day">
                →
              </button>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <input
              type="date"
              className="input !w-auto"
              value={date}
              min={todayInZone(mentor.timeZone)}
              onChange={(e) => setDate(e.target.value)}
              aria-label="Pick a date"
            />
            <span className="text-xs text-slate-400 dark:text-slate-500">({mentor.timeZone})</span>
          </div>

          {availLoading ? (
            <Spinner className="h-6 w-6" />
          ) : slotStarts.length === 0 ? (
            <EmptyState
              icon="🗓️"
              title="No free slots"
              subtitle={`${mentor.name.split(' ')[0]} has no free slots on ${dateLabel}. Try another day.`}
            />
          ) : (
            <>
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {slotStarts.map((s) => (
                  <div
                    key={s}
                    className="flex flex-col items-start gap-2 rounded-xl border-2 border-indigo-100 bg-indigo-50/50 px-3 py-2.5 transition-all duration-200 dark:border-indigo-500/30 dark:bg-indigo-500/10"
                  >
                    <span className="flex items-center gap-1.5 text-sm font-bold text-indigo-700 dark:text-indigo-300">
                      <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                        <circle cx="10" cy="10" r="7" />
                        <path d="M10 6v4l2.5 1.5" />
                      </svg>
                      {formatTime(s)}
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-indigo-400 dark:text-indigo-400">
                      {mentor.sessionDuration} min
                    </span>
                    {isStudent ? (
                      <button
                        onClick={() => openBook(s)}
                        className="btn-primary w-full !px-2 !py-1.5 !text-xs"
                      >
                        Book Slot
                      </button>
                    ) : (
                      <span className="w-full rounded-lg bg-slate-100 px-2 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                        Available
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs text-slate-400 dark:text-slate-500">
                Sessions are {mentor.sessionDuration} minutes long. Slots marked as taken by others are hidden automatically.
              </p>
            </>
          )}
        </div>

        {/* Reviews */}
        <div className="card p-6">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Reviews</h2>
          <div className="mt-4 flex items-center gap-4">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-4xl font-extrabold text-transparent">
              {reviewStats.avg.toFixed(1)}
            </div>
            <div>
              <StarRating value={Math.round(reviewStats.avg)} />
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{reviewStats.count} reviews</p>
            </div>
          </div>

          {/* Rating distribution */}
          {reviewStats.count > 0 && (
            <div className="mt-5 space-y-1.5">
              {reviewStats.distribution.map((d) => {
                const pct = Math.round((d.count / reviewStats.count) * 100);
                return (
                  <div key={d.rating} className="flex items-center gap-2 text-xs" title={`${pct}%`}>
                    <span className="w-7 shrink-0 font-semibold text-slate-500 dark:text-slate-400">{d.rating}★</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500 transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-5 shrink-0 text-right text-slate-400 dark:text-slate-500">{d.count}</span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-5 max-h-[420px] space-y-4 overflow-y-auto pr-1">
            {reviews.length === 0 ? (
              <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-400 dark:bg-slate-800/60 dark:text-slate-500">
                No reviews yet. Be the first after your session!
              </p>
            ) : (
              reviews.map((r) => <ReviewCard key={r._id} review={r} />)
            )}
          </div>
        </div>
      </div>

      {/* Booking modal */}
      {showModal && (
        <Modal open={showModal} title="Confirm booking" onClose={() => setShowModal(false)} size="md">
          <div className="rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-blue-50 p-4 text-sm dark:border-indigo-500/30 dark:from-indigo-500/10 dark:to-blue-500/10">
            <p className="font-semibold text-indigo-800 dark:text-indigo-300">{mentor.name}</p>
            <p className="mt-1.5 text-slate-600 dark:text-slate-300">
              📅 {dateLabel} · {formatTime(selected)} – {formatTime(addMinutes(selected, mentor.sessionDuration))}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Session duration: {mentor.sessionDuration} min · ₹{mentor.hourlyRate}/hr
            </p>
          </div>
          <label className="label mt-4">Notes for the mentor (optional)</label>
          <textarea
            className="input min-h-[80px] resize-none"
            placeholder="What would you like to discuss?"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <div className="mt-5 flex gap-3">
            <button className="btn-secondary flex-1" onClick={() => setShowModal(false)}>
              Cancel
            </button>
            <button className="btn-primary flex-1" onClick={confirmBooking} disabled={booking}>
              {booking ? 'Booking…' : 'Confirm & book'}
            </button>
          </div>
          <p className="mt-3 text-center text-[11px] text-slate-400 dark:text-slate-500">
            Double-booking protection: if someone books this exact slot first, you'll be notified instantly.
          </p>
        </Modal>
      )}
    </div>
  );
}
