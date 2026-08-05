import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client, { errMsg } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { requestCalendarTokens } from '../utils/google.js';
import Avatar from '../components/Avatar.jsx';
import StarRating from '../components/StarRating.jsx';
import ReviewCard from '../components/ReviewCard.jsx';
import { SkeletonCard, SkeletonStat } from '../components/Skeleton.jsx';
import EmptyState from '../components/EmptyState.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import BookingDetailsModal from '../components/BookingDetailsModal.jsx';
import Modal from '../components/Modal.jsx';
import { formatDate, formatTime, todayInZone, WEEKDAYS } from '../utils/time.js';

const TIMES = [];
for (let h = 0; h < 24; h++) {
  for (const m of [0, 30]) TIMES.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
}

const ACTIVITY_ICONS = { booked: '🟡', completed: '✅', cancelled: '❌', confirmed: '🟢' };

function SlotRow({ slot, onDelete, onEdit, onToggleActive, booked, meta }) {
  const unavailable = slot.isActive === false;
  return (
    <div
      className={`group flex items-center justify-between gap-2 rounded-xl border px-4 py-2.5 text-sm shadow-sm transition dark:bg-slate-800 ${
        unavailable
          ? 'border-slate-200 bg-slate-50 opacity-70 dark:border-slate-700 dark:bg-slate-800/40'
          : 'border-slate-100 bg-white hover:border-indigo-100 hover:shadow dark:border-slate-700 dark:hover:border-indigo-500/40'
      }`}
    >
      <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 font-semibold text-slate-700 dark:text-slate-200">
        {formatTime(slot.startTime)} – {formatTime(slot.endTime)}
        {unavailable && (
          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-500 dark:bg-slate-700 dark:text-slate-400">
            Unavailable
          </span>
        )}
        {booked && (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:bg-amber-500/15 dark:text-amber-300">
            Booked
          </span>
        )}
        {meta && (
          <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
            {meta}
          </span>
        )}
      </span>
      <span className="flex shrink-0 items-center gap-0.5">
        <button
          className="rounded-lg p-1.5 text-slate-400 opacity-50 transition hover:bg-indigo-50 hover:text-indigo-600 group-hover:opacity-100 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-300"
          onClick={() => onEdit(slot)}
          disabled={booked}
          title={booked ? 'Booked — cannot edit' : 'Edit slot'}
        >
          ✏️
        </button>
        <button
          className="rounded-lg p-1.5 text-slate-400 opacity-50 transition hover:bg-slate-100 hover:text-slate-700 group-hover:opacity-100 dark:hover:bg-slate-700 dark:hover:text-slate-200"
          onClick={() => onToggleActive(slot)}
          disabled={booked}
          title={
            booked ? 'Booked — cannot change' : unavailable ? 'Mark available' : 'Mark unavailable'
          }
        >
          {unavailable ? '🔓' : '🔒'}
        </button>
        <button
          className="rounded-lg p-1.5 text-slate-400 opacity-50 transition hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
          onClick={() => onDelete(slot)}
          disabled={booked}
          title={booked ? 'Booked — cancel session first' : 'Delete slot'}
        >
          🗑
        </button>
      </span>
    </div>
  );
}

function StatCard({ icon, label, value, iconCls = 'from-blue-600 to-indigo-600' }) {
  return (
    <div className="card group p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md">
      <div className="flex items-center justify-between">
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${iconCls} text-lg shadow-md transition-transform duration-200 group-hover:scale-110`}
        >
          {icon}
        </span>
        <span className="text-2xl font-extrabold text-slate-900 dark:text-white">{value}</span>
      </div>
      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">{label}</p>
    </div>
  );
}

export default function MentorDashboard() {
  const { user } = useAuth();
  const toast = useToast();

  const [date, setDate] = useState(() => todayInZone());
  const [avail, setAvail] = useState(null);
  const [recurring, setRecurring] = useState([]);
  const [loading, setLoading] = useState(true);

  // Add slot form (one-off)
  const [oneOff, setOneOff] = useState({ date: '', start: '09:00', end: '10:00' });
  // Add slot form (recurring)
  const [rec, setRec] = useState({ day: 1, start: '18:00', end: '19:00' });

  const [bookings, setBookings] = useState([]);
  const [bookingsTab, setBookingsTab] = useState('confirmed');
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [counts, setCounts] = useState({ confirmed: 0, completed: 0, cancelled: 0 });

  // Confirmation dialog state for complete / cancel / delete
  const [confirm, setConfirm] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [detailsTarget, setDetailsTarget] = useState(null);

  // Edit / mark-unavailable slot state
  const [editTarget, setEditTarget] = useState(null);
  const [editStart, setEditStart] = useState('09:00');
  const [editEnd, setEditEnd] = useState('10:00');
  const [editing, setEditing] = useState(false);

  // Confirmed bookings (booked-slot detection + upcoming count) & recent activity
  const [confirmedList, setConfirmedList] = useState([]);
  const [allBookings, setAllBookings] = useState([]);
  const [hourlyRate, setHourlyRate] = useState(0);
  const [sessionDuration, setSessionDuration] = useState(60);

  // Frontend search (no API changes)
  const [q, setQ] = useState('');

  // Student reviews
  const [reviews, setReviews] = useState([]);
  const [reviewStats, setReviewStats] = useState({ avg: 0, count: 0, distribution: [] });
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewFilter, setReviewFilter] = useState(''); // '' = all, else '5'..'1'
  const [reviewSort, setReviewSort] = useState('latest');

  const loadAvailability = useCallback(async (d) => {
    setLoading(true);
    try {
      const { data } = await client.get(`/availability/me?date=${d}`);
      setAvail(data);
      setRecurring(data.allRecurring || []);
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const loadBookings = useCallback(async (status) => {
    setBookingsLoading(true);
    try {
      const { data } = await client.get(`/bookings/mentor-bookings?status=${status}`);
      setBookings(data.bookings);
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setBookingsLoading(false);
    }
  }, [toast]);

  const loadReviews = useCallback(async () => {
    setReviewsLoading(true);
    try {
      const { data } = await client.get(
        `/reviews/mentor/${user.id}?rating=${reviewFilter}&sort=${reviewSort}`
      );
      setReviews(data.reviews);
      setReviewStats(data.stats);
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setReviewsLoading(false);
    }
  }, [user.id, reviewFilter, reviewSort, toast]);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  // Load counts for the stat cards + confirmed list + recent activity once
  const loadCounts = useCallback(async () => {
    try {
      const [c, p, x, all, me] = await Promise.all([
        client.get('/bookings/mentor-bookings?status=confirmed'),
        client.get('/bookings/mentor-bookings?status=completed'),
        client.get('/bookings/mentor-bookings?status=cancelled'),
        client.get('/bookings/mentor-bookings'),
        client.get('/mentors/me'),
      ]);
      setCounts({
        confirmed: c.data.bookings.length,
        completed: p.data.bookings.length,
        cancelled: x.data.bookings.length,
      });
      setConfirmedList(c.data.bookings);
      setAllBookings(all.data.bookings);
      setHourlyRate(me.data.mentor.hourlyRate || 0);
      setSessionDuration(me.data.mentor.sessionDuration || 60);
    } catch {
      /* stats are non-critical */
    }
  }, []);

  useEffect(() => {
    loadAvailability(date);
  }, [date, loadAvailability]);

  useEffect(() => {
    loadBookings(bookingsTab);
  }, [bookingsTab, loadBookings]);

  useEffect(() => {
    loadCounts();
  }, [loadCounts]);

  const addOneOff = async (e) => {
    e.preventDefault();
    try {
      await client.post('/availability', { type: 'one-off', date: oneOff.date, startTime: oneOff.start, endTime: oneOff.end });
      toast('Free slot added for ' + formatDate(oneOff.date) + '!');
      loadAvailability(date);
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  };

  const addRecurring = async (e) => {
    e.preventDefault();
    try {
      await client.post('/availability', { type: 'recurring', dayOfWeek: rec.day, startTime: rec.start, endTime: rec.end });
      toast(`Recurring slot added for every ${WEEKDAYS[rec.day]}!`);
      loadAvailability(date);
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  };

  const openEdit = (slot) => {
    setEditTarget(slot);
    setEditStart(slot.startTime);
    setEditEnd(slot.endTime);
  };

  const saveEdit = async () => {
    setEditing(true);
    try {
      await client.patch(`/availability/${editTarget._id}`, { startTime: editStart, endTime: editEnd });
      toast('Slot updated.');
      setEditTarget(null);
      loadAvailability(date);
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setEditing(false);
    }
  };

  const toggleActive = async (slot) => {
    try {
      await client.patch(`/availability/${slot._id}`, { isActive: !slot.isActive });
      toast(slot.isActive ? 'Slot marked unavailable.' : 'Slot is available again.');
      loadAvailability(date);
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  };

  const runConfirmedAction = async () => {
    setConfirming(true);
    try {
      if (confirm.type === 'delete') {
        await client.delete(`/availability/${confirm.target._id}`);
        toast('Slot deleted.');
        loadAvailability(date);
      } else {
        const { data } = await client.post(`/bookings/${confirm.target._id}/${confirm.type}`);
        toast(data.message);
        loadBookings(bookingsTab);
        loadCounts();
      }
      setConfirm(null);
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setConfirming(false);
    }
  };

  const connectCalendar = async () => {
    try {
      const tokens = await requestCalendarTokens();
      await client.post('/auth/google/tokens', tokens);
      toast('Google Calendar connected! Meet links will be auto-generated. 🎥');
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  };

  const todaySlotCount = avail?.oneOff?.length || 0;
  const bookedToday = avail?.booked?.length || 0;
  const totalSlots = todaySlotCount + recurring.length;
  const availableSlots = Math.max(todaySlotCount - bookedToday, 0);

  // Upcoming = confirmed sessions on a date >= today (mentor's own timezone)
  const upcomingCount = confirmedList.filter((b) => b.date >= todayInZone(b.timeZone)).length;
  // Revenue placeholder: completed sessions x hourly rate, scaled by session length
  const revenueEstimate = Math.round(counts.completed * hourlyRate * (sessionDuration / 60));
  const recentActivity = [...allBookings]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 6);

  /** True if a slot already has a confirmed booking (one-off: on the selected date; recurring: any matching weekday). */
  const slotIsBooked = (slot) => {
    const overlaps = (r) => slot.startTime < r.endTime && slot.endTime > r.startTime;
    if (slot.type === 'one-off') {
      return (avail?.booked || []).some(overlaps);
    }
    return confirmedList.some((b) => {
      const weekday = new Date(`${b.date}T12:00:00`).getDay();
      return weekday === slot.dayOfWeek && overlaps(b);
    });
  };

  const filteredBookings = bookings.filter((b) => {
    const name = (b.student?.name || '').toLowerCase();
    return !q.trim() || name.includes(q.trim().toLowerCase());
  });

  const confirmMeta = {
    complete: {
      title: 'Mark session as completed?',
      message: `Mark the session with ${confirm?.target?.student?.name} on ${formatDate(confirm?.target?.date)} as completed?`,
      label: 'Mark complete',
      cancelLabel: 'Keep session',
      tone: 'primary',
    },
    cancel: {
      title: 'Cancel this session?',
      message: `Cancel the session with ${confirm?.target?.student?.name} on ${formatDate(confirm?.target?.date)} at ${formatTime(confirm?.target?.startTime)}? The student will be notified by email.`,
      label: 'Yes, cancel',
      cancelLabel: 'Keep session',
      tone: 'danger',
    },
    delete: {
      title: 'Delete this slot?',
      message: `Delete the ${formatTime(confirm?.target?.startTime)} – ${formatTime(confirm?.target?.endTime)} slot? Students will no longer be able to book it.`,
      label: 'Delete slot',
      cancelLabel: 'Keep slot',
      tone: 'danger',
    },
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar name={user.name} src={user.avatar} size="lg" />
          <div>
            <p className="kicker">Mentor dashboard</p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Welcome, {user.name.split(' ')[0]}!
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Manage your availability and bookings.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/mentor/profile" className="btn-secondary">✏️ Edit profile</Link>
          <button className="btn-primary" onClick={connectCalendar}>🎥 Connect Google Calendar</button>
        </div>
      </div>

      {/* Stats */}
      {loading ? (
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonStat key={i} />
          ))}
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8">
          <StatCard icon="🗓️" label="Total slots" value={totalSlots} />
          <StatCard icon="🟢" label="Available" value={availableSlots} iconCls="from-emerald-500 to-teal-500" />
          <StatCard icon="📥" label="Booked" value={counts.confirmed} />
          <StatCard icon="📅" label="Upcoming" value={upcomingCount} iconCls="from-cyan-500 to-blue-500" />
          <StatCard icon="✅" label="Completed" value={counts.completed} iconCls="from-blue-600 to-indigo-600" />
          <StatCard icon="❌" label="Cancelled" value={counts.cancelled} iconCls="from-rose-500 to-pink-500" />
          <StatCard icon="💰" label="Revenue est." value={`₹${revenueEstimate}`} iconCls="from-amber-500 to-orange-500" />
          <StatCard icon="⭐" label="Avg rating" value={reviewStats.count ? reviewStats.avg.toFixed(1) : '—'} iconCls="from-amber-500 to-orange-500" />
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* ---- Availability manager ---- */}
        <div className="card p-6">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">🗓️ My availability</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Set free hours for a specific day, or save a slot that repeats every week.
          </p>

          <div className="mt-5 rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50/80 to-blue-50/60 p-4 dark:border-indigo-500/30 dark:from-indigo-500/10 dark:to-blue-500/5">
            <h3 className="text-sm font-bold text-indigo-800 dark:text-indigo-300">Today & one-off slots</h3>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input type="date" className="input !w-auto !py-2" value={date} onChange={(e) => setDate(e.target.value)} min={todayInZone()} />
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {avail ? `${todaySlotCount} slot(s) · ${bookedToday} booked` : ''}
              </span>
            </div>

            <form onSubmit={addOneOff} className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-[auto_1fr_1fr_auto] sm:items-center">
              <input type="date" className="input !py-2" value={oneOff.date} onChange={(e) => setOneOff({ ...oneOff, date: e.target.value })} required />
              <select className="input !py-2" value={oneOff.start} onChange={(e) => setOneOff({ ...oneOff, start: e.target.value })}>
                {TIMES.map((t) => <option key={t} value={t}>{formatTime(t)}</option>)}
              </select>
              <select className="input !py-2" value={oneOff.end} onChange={(e) => setOneOff({ ...oneOff, end: e.target.value })}>
                {TIMES.map((t) => <option key={t} value={t}>{formatTime(t)}</option>)}
              </select>
              <button type="submit" className="btn-primary !py-2">+ Add</button>
            </form>

            <div className="mt-3 space-y-2">
              {loading ? (
                <div className="flex justify-center py-3">
                  <span className="h-5 w-5 animate-spin rounded-full border-[3px] border-indigo-100 border-t-indigo-600" />
                </div>
              ) : avail?.oneOff?.length ? (
                avail.oneOff.map((s) => (
                  <SlotRow
                    key={s._id}
                    slot={s}
                    booked={slotIsBooked(s)}
                    onEdit={openEdit}
                    onToggleActive={toggleActive}
                    onDelete={(slot) => setConfirm({ type: 'delete', target: slot })}
                  />
                ))
              ) : (
                <p className="py-2 text-center text-xs text-slate-400 dark:text-slate-500">No one-off slots on this day.</p>
              )}
            </div>
          </div>

          <div className="mt-5">
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">🔁 Recurring weekly schedule</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500">These slots repeat every week — set once, save forever.</p>
            <form onSubmit={addRecurring} className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-[auto_1fr_1fr_auto] sm:items-center">
              <select className="input !py-2" value={rec.day} onChange={(e) => setRec({ ...rec, day: Number(e.target.value) })}>
                {WEEKDAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
              </select>
              <select className="input !py-2" value={rec.start} onChange={(e) => setRec({ ...rec, start: e.target.value })}>
                {TIMES.map((t) => <option key={t} value={t}>{formatTime(t)}</option>)}
              </select>
              <select className="input !py-2" value={rec.end} onChange={(e) => setRec({ ...rec, end: e.target.value })}>
                {TIMES.map((t) => <option key={t} value={t}>{formatTime(t)}</option>)}
              </select>
              <button type="submit" className="btn-primary !py-2">+ Save</button>
            </form>

            <div className="mt-3 space-y-2">
              {loading ? (
                <div className="flex justify-center py-3">
                  <span className="h-5 w-5 animate-spin rounded-full border-[3px] border-indigo-100 border-t-indigo-600" />
                </div>
              ) : recurring.length ? (
                recurring.map((s) => (
                  <SlotRow
                    key={s._id}
                    slot={s}
                    booked={slotIsBooked(s)}
                    onEdit={openEdit}
                    onToggleActive={toggleActive}
                    onDelete={(slot) => setConfirm({ type: 'delete', target: slot })}
                    meta={`every ${WEEKDAYS[s.dayOfWeek]}`}
                  />
                ))
              ) : (
                <p className="py-2 text-center text-xs text-slate-400 dark:text-slate-500">No recurring slots yet. Add one above!</p>
              )}
            </div>
          </div>
        </div>

        {/* ---- Bookings ---- */}
        <div className="card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">📥 Bookings</h2>
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
                className="input !w-40 !py-2 pl-9"
                placeholder="Search student…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {['confirmed', 'completed', 'cancelled'].map((s) => (
              <button
                key={s}
                onClick={() => setBookingsTab(s)}
                className={`chip border transition-all duration-150 ${
                  bookingsTab === s
                    ? 'border-indigo-500 bg-indigo-600 text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:bg-indigo-50/50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-indigo-500/50 dark:hover:bg-indigo-500/10'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {bookingsLoading ? (
            <div className="mt-4 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : filteredBookings.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                icon="📭"
                title={q.trim() ? 'No matching students' : `No ${bookingsTab} bookings`}
                subtitle={q.trim() ? 'Try a different name.' : 'When students book your free slots, they will appear here.'}
              />
            </div>
          ) : (
            <div className="mt-4 max-h-[560px] space-y-3 overflow-y-auto pr-1">
              {filteredBookings.map((b) => (
                <div
                  key={b._id}
                  className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 transition hover:border-indigo-100 hover:bg-white hover:shadow-sm dark:border-slate-700 dark:bg-slate-800/60 dark:hover:border-indigo-500/40 dark:hover:bg-slate-800"
                >
                  <div className="flex items-center gap-3">
                    <Avatar name={b.student?.name} src={b.student?.avatar} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">{b.student?.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{formatDate(b.date)} · {formatTime(b.startTime)} – {formatTime(b.endTime)}</p>
                    </div>
                    <button className="btn-ghost !px-2.5 !py-1.5 text-xs" onClick={() => setDetailsTarget(b)}>
                      Details
                    </button>
                  </div>
                  {b.notes && <p className="mt-2 text-xs italic text-slate-400 dark:text-slate-500">"{b.notes}"</p>}
                  {b.meetLink && (
                    <a href={b.meetLink} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400">
                      🎥 {b.meetLink.replace('https://', '').slice(0, 40)}…
                    </a>
                  )}
                  {b.status === 'confirmed' && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {b.meetLink && (
                        <a href={b.meetLink} target="_blank" rel="noreferrer" className="btn-primary !px-3 !py-1.5 !text-xs">Join Meet</a>
                      )}
                      <button className="btn-secondary !px-3 !py-1.5 !text-xs" onClick={() => setConfirm({ type: 'complete', target: b })}>
                        ✓ Complete
                      </button>
                      <button className="btn-danger !px-3 !py-1.5 !text-xs" onClick={() => setConfirm({ type: 'cancel', target: b })}>
                        ✕ Cancel
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ---- Student reviews ---- */}
      <div className="card mt-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">⭐ Student reviews</h2>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              Reviews are left by students after completed sessions. You cannot edit or delete them.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap gap-1.5 rounded-xl border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-700 dark:bg-slate-800">
              {['', '5', '4', '3', '2', '1'].map((f) => (
                <button
                  key={f || 'all'}
                  onClick={() => setReviewFilter(f)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all duration-150 ${
                    reviewFilter === f
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200'
                  }`}
                >
                  {f ? `${f}★` : 'All'}
                </button>
              ))}
            </div>
            <select
              className="input !w-auto !py-2"
              value={reviewSort}
              onChange={(e) => setReviewSort(e.target.value)}
              aria-label="Sort reviews"
            >
              <option value="latest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </div>
        </div>

        <div className="mt-5 grid gap-6 lg:grid-cols-[260px_1fr]">
          {/* Summary card */}
          <div className="h-fit rounded-xl border border-slate-100 bg-slate-50/60 p-5 dark:border-slate-700 dark:bg-slate-800/60">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-5xl font-extrabold text-transparent">
              {reviewStats.count ? reviewStats.avg.toFixed(1) : '—'}
            </div>
            <div className="mt-1">
              <StarRating value={Math.round(reviewStats.avg)} />
            </div>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{reviewStats.count} reviews</p>
            {reviewStats.count > 0 && (
              <div className="mt-4 space-y-1.5">
                {reviewStats.distribution.map((d) => {
                  const pct = Math.round((d.count / reviewStats.count) * 100);
                  return (
                    <div key={d.rating} className="flex items-center gap-2 text-xs" title={`${pct}%`}>
                      <span className="w-7 shrink-0 font-semibold text-slate-500 dark:text-slate-400">{d.rating}★</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200/70 dark:bg-slate-700">
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
          </div>

          {/* Review list */}
          <div>
            {reviewsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            ) : reviews.length === 0 ? (
              <EmptyState
                icon="⭐"
                title={reviewFilter ? 'No reviews with this rating' : 'No reviews yet'}
                subtitle={
                  reviewFilter
                    ? 'Try a different rating filter.'
                    : 'Reviews that students leave after completed sessions will show up here.'
                }
              />
            ) : (
              <div className="max-h-[520px] space-y-3 overflow-y-auto pr-1">
                {reviews.map((r) => (
                  <ReviewCard key={r._id} review={r} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ---- Recent activity ---- */}
      <div className="card mt-6 p-6">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">🕘 Recent activity</h2>
        {recentActivity.length === 0 ? (
          <p className="mt-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-400 dark:bg-slate-800/60 dark:text-slate-500">
            No activity yet — bookings and slot changes will show up here.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
            {recentActivity.map((b) => (
              <li key={b._id} className="flex items-center gap-3 py-2.5 text-sm">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-base dark:bg-slate-800">
                  {ACTIVITY_ICONS[b.status] || '•'}
                </span>
                <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-200">
                  <strong>{b.student?.name || 'A student'}</strong>{' '}
                  <span className="text-slate-400">
                    {b.status === 'confirmed' ? 'booked' : b.status} · {formatDate(b.date)} at {formatTime(b.startTime)}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-slate-400 dark:text-slate-500">
                  {new Date(b.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Edit slot modal */}
      {editTarget && (
        <Modal open={!!editTarget} title="Edit slot" onClose={() => setEditTarget(null)} size="sm">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Adjust this slot's free hours. Overlapping slots and booked slots are protected.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <label className="label">Start</label>
            <label className="label">End</label>
            <select className="input" value={editStart} onChange={(e) => setEditStart(e.target.value)}>
              {TIMES.map((t) => <option key={t} value={t}>{formatTime(t)}</option>)}
            </select>
            <select className="input" value={editEnd} onChange={(e) => setEditEnd(e.target.value)}>
              {TIMES.map((t) => <option key={t} value={t}>{formatTime(t)}</option>)}
            </select>
          </div>
          <div className="mt-5 flex gap-3">
            <button className="btn-secondary flex-1" onClick={() => setEditTarget(null)}>Cancel</button>
            <button className="btn-primary flex-1" onClick={saveEdit} disabled={editing}>
              {editing ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </Modal>
      )}

      {/* Confirmation dialogs */}
      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={runConfirmedAction}
        title={confirmMeta[confirm?.type]?.title || ''}
        message={confirmMeta[confirm?.type]?.message || ''}
        confirmLabel={confirmMeta[confirm?.type]?.label || 'Confirm'}
        cancelLabel={confirmMeta[confirm?.type]?.cancelLabel || 'Keep session'}
        tone={confirmMeta[confirm?.type]?.tone || 'danger'}
        loading={confirming}
      />

      {/* Booking details */}
      <BookingDetailsModal booking={detailsTarget} onClose={() => setDetailsTarget(null)} />
    </div>
  );
}
