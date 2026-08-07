import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Ban, CalendarCheck, CalendarClock, CalendarDays, CalendarOff, CheckCircle2, ChevronDown, Clock, History, Inbox, Pencil, Repeat, Save, Sparkles, Star, Trash2, Video, XCircle } from 'lucide-react';
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
import { formatDate, formatTime, todayInZone, generateSlotPreview, WEEKDAYS } from '../utils/time.js';

const TIMEZONES = ['Asia/Kolkata', 'Asia/Karachi', 'Asia/Dubai', 'Asia/Singapore', 'Europe/London', 'America/New_York', 'America/Los_Angeles', 'UTC'];

const SESSION_PRESETS = [15, 20, 30, 45, 60, 90, 120];
const BUFFER_PRESETS = [0, 5, 10, 15, 20, 30, 45, 60];

// Monday-first display order for the weekday dropdown & saved weekly rows
// (WEEKDAYS is indexed Sunday=0 … Saturday=6)
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

const BLOCKED_REASONS = [
  { key: 'vacation', label: 'Vacation' },
  { key: 'personal', label: 'Personal leave' },
  { key: 'emergency', label: 'Emergency' },
  { key: 'holiday', label: 'Holiday' },
  { key: 'other', label: 'Other' },
];
const BLOCKED_LABEL = Object.fromEntries(BLOCKED_REASONS.map((r) => [r.key, r.label]));

const ACTIVITY_ICONS = { booked: Clock, completed: CheckCircle2, cancelled: XCircle, confirmed: CheckCircle2 };
const ACTIVITY_COLORS = { booked: 'text-amber-500', completed: 'text-emerald-500', cancelled: 'text-rose-500', confirmed: 'text-emerald-500' };

/** Dropdown of presets + a Custom option that reveals a free-form number input. */
function PresetWithCustom({ label, presets, value, onChange, min, max }) {
  // Mode is derived from the value so it can never go stale: the dropdown shows
  // "Custom…" whenever the current value isn't one of the presets.
  const v = Number.isFinite(value) ? value : presets[0];
  const isCustom = !presets.includes(v);
  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex items-center gap-2">
        <select
          className="input !py-2"
          value={isCustom ? 'custom' : v}
          onChange={(e) => {
            if (e.target.value === 'custom') {
              // Prefill a non-preset value (e.g. preset + 1) so the input shows.
              onChange(Math.min(Math.max(v + 1, min), max));
            } else {
              onChange(Number(e.target.value));
            }
          }}
        >
          {presets.map((p) => (
            <option key={p} value={p}>{p === 0 ? 'None' : `${p} min`}</option>
          ))}
          <option value="custom">Custom…</option>
        </select>
        {isCustom && (
          <input
            type="number"
            min={min}
            max={max}
            step={1}
            className="input !w-24 !py-2"
            value={v}
            onChange={(e) => onChange(Number(e.target.value))}
            aria-label={`${label} (custom value)`}
          />
        )}
      </div>
    </div>
  );
}

/** Collapsible section used to keep secondary features inside the same card. */
function Collapsible({ icon: Icon, title, badge = 0, open, onToggle, children }) {
  return (
    <div className="mt-5 border-t border-slate-100 pt-4 dark:border-slate-800">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 rounded-lg px-1 py-1 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/50"
        onClick={onToggle}
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
          <Icon className="h-4 w-4 text-slate-400 dark:text-slate-500" /> {title}
          {badge > 0 && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              {badge}
            </span>
          )}
        </span>
        <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="mt-3 animate-fade-in-up">{children}</div>}
    </div>
  );
}

/** One saved schedule row: label, hours, session/buffer meta + Edit / Delete. */
function ScheduleRow({ label, icon: Icon, slot, fallbackSession, fallbackBreak, booked, unavailable, onEdit, onDelete }) {
  return (
    <div
      className={`group flex items-center justify-between gap-2 rounded-xl border px-4 py-3 transition ${
        unavailable
          ? 'border-slate-200 bg-slate-50 opacity-70 dark:border-slate-700 dark:bg-slate-800/40'
          : 'border-slate-100 bg-white hover:border-indigo-100 hover:shadow-sm dark:border-slate-700 dark:bg-slate-800/50 dark:hover:border-indigo-500/40'
      }`}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span
          className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
            unavailable
              ? 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
              : 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300'
          }`}
        >
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-bold text-slate-800 dark:text-slate-100">
            {label}
            {booked && (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:bg-amber-500/15 dark:text-amber-300">
                Booked
              </span>
            )}
            {unavailable && (
              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-700 dark:text-slate-400">
                Unavailable
              </span>
            )}
          </p>
          <p className="mt-0.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
            {formatTime(slot.startTime)} → {formatTime(slot.endTime)}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
            {slot.sessionDuration ?? fallbackSession} min sessions · {slot.breakDuration ?? fallbackBreak} min buffer
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        <button
          className="rounded-lg p-1.5 text-slate-400 opacity-50 transition hover:bg-indigo-50 hover:text-indigo-600 group-hover:opacity-100 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-300"
          onClick={onEdit}
          disabled={booked}
          title={booked ? 'Booked — cannot edit' : 'Edit schedule'}
          aria-label="Edit schedule"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          className="rounded-lg p-1.5 text-slate-400 opacity-50 transition hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
          onClick={onDelete}
          disabled={booked}
          title={booked ? 'Booked — cancel sessions first' : 'Delete schedule'}
          aria-label="Delete schedule"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, iconCls = 'from-blue-600 to-indigo-600' }) {
  return (
    <div className="card group p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md">
      <div className="flex items-center justify-between">
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${iconCls} shadow-md transition-transform duration-200 group-hover:scale-110`}
        >
          <Icon className="h-5 w-5 text-white" strokeWidth={2.2} />
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

  const [avail, setAvail] = useState(null);
  const [recurring, setRecurring] = useState([]);
  const [oneOffAll, setOneOffAll] = useState([]);
  const [loading, setLoading] = useState(true);

  // Profile-level defaults (fallback for schedules without their own values) + timezone
  const [profileDefaults, setProfileDefaults] = useState({ sessionDuration: 60, breakDuration: 20, timeZone: 'Asia/Kolkata' });
  const formDefaultsRef = useRef(false);

  // Dashboard view date — "today" in the mentor's timezone (refetches once the
  // timezone loads, then stays stable).
  const date = todayInZone(profileDefaults.timeZone);

  // Availability form — per-schedule session/buffer live here now
  const [availType, setAvailType] = useState('weekly'); // 'today' | 'weekly'
  const [form, setForm] = useState({
    dayOfWeek: 1,
    date: todayInZone(),
    startTime: '09:00',
    endTime: '18:00',
    sessionDuration: 60,
    breakDuration: 20,
  });
  const [savingAvail, setSavingAvail] = useState(false);

  // Edit-schedule modal
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState({ startTime: '09:00', endTime: '10:00', sessionDuration: 60, breakDuration: 20, isActive: true });
  const [editing, setEditing] = useState(false);

  // Time-off / blocked dates
  const [blockedDates, setBlockedDates] = useState([]);
  const [blockedForm, setBlockedForm] = useState({ date: '', reason: 'other' });
  const [blockedSaving, setBlockedSaving] = useState(false);
  const [timeoffOpen, setTimeoffOpen] = useState(false);

  // Slot preview (client-side mirror of the server generator, per-window aware)
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewDate, setPreviewDate] = useState(() => todayInZone());
  const [previewData, setPreviewData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewSlots, setPreviewSlots] = useState([]);

  const [bookings, setBookings] = useState([]);
  const [bookingsTab, setBookingsTab] = useState('confirmed');
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [counts, setCounts] = useState({ confirmed: 0, completed: 0, cancelled: 0 });

  // Confirmation dialog state for complete / cancel / delete
  const [confirm, setConfirm] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [detailsTarget, setDetailsTarget] = useState(null);

  // Confirmed bookings (booked-slot detection + upcoming count) & recent activity
  const [confirmedList, setConfirmedList] = useState([]);
  const [allBookings, setAllBookings] = useState([]);

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
      setOneOffAll(data.allOneOff || []);
      setProfileDefaults({
        sessionDuration: data.sessionDuration || 60,
        breakDuration: data.breakDuration ?? 20,
        timeZone: data.timeZone || 'Asia/Kolkata',
      });
      // Seed the form with the mentor's defaults once (don't clobber edits)
      if (!formDefaultsRef.current) {
        formDefaultsRef.current = true;
        setForm((f) => ({
          ...f,
          sessionDuration: data.sessionDuration || 60,
          breakDuration: data.breakDuration ?? 20,
          date: todayInZone(data.timeZone || 'Asia/Kolkata'),
        }));
      }
      setBlockedDates(data.blockedDates || []);
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
      const [c, p, x, all] = await Promise.all([
        client.get('/bookings/mentor-bookings?status=confirmed'),
        client.get('/bookings/mentor-bookings?status=completed'),
        client.get('/bookings/mentor-bookings?status=cancelled'),
        client.get('/bookings/mentor-bookings'),
      ]);
      setCounts({
        confirmed: c.data.bookings.length,
        completed: p.data.bookings.length,
        cancelled: x.data.bookings.length,
      });
      setConfirmedList(c.data.bookings);
      setAllBookings(all.data.bookings);
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

  const today = todayInZone(profileDefaults.timeZone);
  const oneOffLabel = (d) => (d === today ? 'Today' : formatDate(d));

  /** Saves the form as either a weekly schedule or a date-specific schedule. */
  const saveAvailability = async () => {
    if (!form.startTime || !form.endTime) {
      toast('Pick a start and end time.', 'error');
      return;
    }
    if (form.startTime >= form.endTime) {
      toast('Start time must be before end time.', 'error');
      return;
    }
    setSavingAvail(true);
    try {
      if (availType === 'weekly') {
        await client.post('/availability', {
          type: 'recurring',
          dayOfWeek: form.dayOfWeek,
          startTime: form.startTime,
          endTime: form.endTime,
          sessionDuration: form.sessionDuration,
          breakDuration: form.breakDuration,
        });
        toast(`Weekly schedule saved for ${WEEKDAYS[form.dayOfWeek]}!`);
      } else {
        await client.post('/availability', {
          type: 'one-off',
          date: form.date,
          startTime: form.startTime,
          endTime: form.endTime,
          sessionDuration: form.sessionDuration,
          breakDuration: form.breakDuration,
        });
        const label = form.date === today ? "Today's availability" : `${formatDate(form.date)} availability`;
        toast(`${label} saved!`);
      }
      loadAvailability(date);
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setSavingAvail(false);
    }
  };

  /** Timezone affects \"today\" & displayed times — saved straight to the profile. */
  const saveTimezone = async (tz) => {
    const prev = profileDefaults.timeZone;
    setProfileDefaults((p) => ({ ...p, timeZone: tz }));
    try {
      await client.patch('/mentors/me', { timeZone: tz });
      toast('Timezone updated.');
      loadAvailability(date);
    } catch (err) {
      setProfileDefaults((p) => ({ ...p, timeZone: prev }));
      toast(errMsg(err), 'error');
    }
  };

  const addBlockedDate = async (e) => {
    e.preventDefault();
    if (!blockedForm.date) return;
    setBlockedSaving(true);
    try {
      const { data } = await client.post('/availability/blocked-dates', blockedForm);
      setBlockedDates(data.blockedDates);
      setBlockedForm({ date: '', reason: 'other' });
      toast('Date blocked — students can no longer book it.');
      loadAvailability(date);
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setBlockedSaving(false);
    }
  };

  const removeBlockedDate = async (d) => {
    try {
      const { data } = await client.delete(`/availability/blocked-dates/${d}`);
      setBlockedDates(data.blockedDates);
      toast('Date unblocked.');
      loadAvailability(date);
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  };

  // Live slot preview for the chosen preview date (fetches that date's windows)
  useEffect(() => {
    if (!previewOpen) return undefined;
    let cancelled = false;
    setPreviewLoading(true);
    (async () => {
      try {
        const { data } = await client.get(`/availability/me?date=${previewDate}`);
        if (cancelled) return;
        setPreviewData(data);
        setPreviewSlots(
          generateSlotPreview({
            ranges: data.ranges || [],
            booked: data.booked || [],
            sessionDuration: profileDefaults.sessionDuration,
            breakDuration: profileDefaults.breakDuration,
            date: previewDate,
            timeZone: profileDefaults.timeZone,
          })
        );
      } catch (err) {
        if (!cancelled) toast(errMsg(err), 'error');
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [previewOpen, previewDate, profileDefaults.sessionDuration, profileDefaults.breakDuration, profileDefaults.timeZone, toast]);

  const openEdit = (slot) => {
    setEditTarget(slot);
    setEditForm({
      startTime: slot.startTime,
      endTime: slot.endTime,
      sessionDuration: slot.sessionDuration ?? profileDefaults.sessionDuration,
      breakDuration: slot.breakDuration ?? profileDefaults.breakDuration,
      isActive: slot.isActive !== false,
    });
  };

  const saveEdit = async () => {
    setEditing(true);
    try {
      await client.patch(`/availability/${editTarget._id}`, {
        startTime: editForm.startTime,
        endTime: editForm.endTime,
        sessionDuration: editForm.sessionDuration,
        breakDuration: editForm.breakDuration,
        isActive: editForm.isActive,
      });
      toast('Schedule updated.');
      setEditTarget(null);
      loadAvailability(date);
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setEditing(false);
    }
  };

  const runConfirmedAction = async () => {
    setConfirming(true);
    try {
      if (confirm.type === 'delete') {
        await client.delete(`/availability/${confirm.target._id}`);
        toast('Schedule deleted.');
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
      toast('Google Calendar connected! Meet links will be auto-generated.');
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  };

  const todaySlotCount = avail?.oneOff?.length || 0;
  const bookedToday = avail?.booked?.length || 0;
  const totalSlots = (oneOffAll?.length || 0) + recurring.length;
  const availableSlots = Math.max(todaySlotCount - bookedToday, 0);

  // Upcoming = confirmed sessions on a date >= today (mentor's own timezone)
  const upcomingCount = confirmedList.filter((b) => b.date >= todayInZone(b.timeZone)).length;
  const recentActivity = [...allBookings]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 6);

  /** True if a schedule window already has a confirmed booking. */
  const slotIsBooked = (slot) => {
    const overlaps = (r) => slot.startTime < r.endTime && slot.endTime > r.startTime;
    if (slot.type === 'one-off') {
      return confirmedList.some((b) => b.date === slot.date && overlaps(b));
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
      title: 'Delete this schedule?',
      message: `Delete the ${
        confirm?.target?.type === 'one-off'
          ? `${oneOffLabel(confirm?.target?.date)} schedule`
          : `${WEEKDAYS[confirm?.target?.dayOfWeek]} schedule`
      } (${formatTime(confirm?.target?.startTime)} – ${formatTime(confirm?.target?.endTime)})? Students will no longer be able to book these hours.`,
      label: 'Delete schedule',
      cancelLabel: 'Keep schedule',
      tone: 'danger',
    },
  };

  // Saved schedules, ordered: date-specific (Today) rows first, then weekly rows Monday-first
  const oneOffRows = [...oneOffAll].sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
  const weeklyRows = [...recurring].sort(
    (a, b) => WEEKDAY_ORDER.indexOf(a.dayOfWeek) - WEEKDAY_ORDER.indexOf(b.dayOfWeek) || a.startTime.localeCompare(b.startTime)
  );
  const scheduleCount = oneOffRows.length + weeklyRows.length;

  // Warn when saving a date that currently has a weekly schedule (it will be replaced for that date)
  const todayOverridesWeekly =
    availType === 'today' &&
    recurring.some((s) => s.dayOfWeek === new Date(`${form.date}T12:00:00`).getDay());

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
          <Link to="/mentor/profile" className="btn-secondary">
            <Pencil className="h-4 w-4" /> Edit profile
          </Link>
          <button className="btn-primary" onClick={connectCalendar}>
            <Video className="h-4 w-4" /> Connect Google Calendar
          </button>
        </div>
      </div>

      {/* Stats */}
      {loading ? (
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
          {Array.from({ length: 7 }).map((_, i) => (
            <SkeletonStat key={i} />
          ))}
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
          <StatCard icon={CalendarDays} label="Total slots" value={totalSlots} />
          <StatCard icon={CalendarCheck} label="Available" value={availableSlots} iconCls="from-emerald-500 to-teal-500" />
          <StatCard icon={Inbox} label="Booked" value={counts.confirmed} />
          <StatCard icon={CalendarClock} label="Upcoming" value={upcomingCount} iconCls="from-cyan-500 to-blue-500" />
          <StatCard icon={CheckCircle2} label="Completed" value={counts.completed} iconCls="from-blue-600 to-indigo-600" />
          <StatCard icon={XCircle} label="Cancelled" value={counts.cancelled} iconCls="from-rose-500 to-pink-500" />
          <StatCard icon={Star} label="Avg rating" value={reviewStats.count ? reviewStats.avg.toFixed(1) : '—'} iconCls="from-amber-500 to-orange-500" />
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* ---- Availability Settings (single card) ---- */}
        <div className="card p-6">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
            <CalendarDays className="h-5 w-5 text-indigo-500 dark:text-indigo-400" /> Availability Settings
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Set your working hours — bookable slots are generated automatically from working hours + session duration + buffer.
          </p>

          {/* Timezone */}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
            <label className="mb-0 flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">
              <Clock className="h-4 w-4 text-indigo-500 dark:text-indigo-400" /> Timezone
            </label>
            <select
              className="input !w-auto !py-1.5 text-xs"
              value={profileDefaults.timeZone}
              onChange={(e) => saveTimezone(e.target.value)}
              aria-label="Timezone"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </div>

          {/* Availability type */}
          <div className="mt-5">
            <label className="label">Availability type</label>
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => {
                  setAvailType('today');
                  setForm((f) => ({ ...f, date: today }));
                }}
                className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-all duration-150 ${
                  availType === 'today'
                    ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-700 dark:text-indigo-300'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <CalendarClock className="h-4 w-4" /> Today Only
              </button>
              <button
                type="button"
                onClick={() => setAvailType('weekly')}
                className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-all duration-150 ${
                  availType === 'weekly'
                    ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-700 dark:text-indigo-300'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <Repeat className="h-4 w-4" /> Weekly Recurring
              </button>
            </div>
            <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">
              {availType === 'weekly'
                ? 'Repeats every week until you change it.'
                : 'Applies to one date only — the weekly schedule automatically resumes the next day.'}
            </p>
          </div>

          {/* Day / Date */}
          <div className="mt-4">
            <label className="label">{availType === 'weekly' ? 'Day of week' : 'Date'}</label>
            {availType === 'weekly' ? (
              <select
                className="input"
                value={form.dayOfWeek}
                onChange={(e) => setForm((f) => ({ ...f, dayOfWeek: Number(e.target.value) }))}
              >
                {WEEKDAY_ORDER.map((i) => (
                  <option key={i} value={i}>{WEEKDAYS[i]}</option>
                ))}
              </select>
            ) : (
              <input
                type="date"
                className="input"
                value={form.date}
                min={today}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                required
              />
            )}
            {todayOverridesWeekly && (
              <p className="mt-1.5 rounded-lg bg-amber-50 px-3 py-1.5 text-[11px] font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                A weekly {WEEKDAYS[new Date(`${form.date}T12:00:00`).getDay()]} schedule exists — it will be replaced for this date only.
              </p>
            )}
          </div>

          {/* Working hours — any minute allowed */}
          <div className="mt-4">
            <label className="label">Working hours</label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Start</span>
                <input
                  type="time"
                  step={60}
                  className="input"
                  value={form.startTime}
                  onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                  required
                />
              </div>
              <div>
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">End</span>
                <input
                  type="time"
                  step={60}
                  className="input"
                  value={form.endTime}
                  onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
                  required
                />
              </div>
            </div>
            <p className="mt-1.5 text-[11px] text-slate-400 dark:text-slate-500">Any minute is allowed — e.g. 9:07 AM, 11:43 AM, 2:18 PM.</p>
          </div>

          {/* Session duration & buffer */}
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <PresetWithCustom
              label="Session duration"
              presets={SESSION_PRESETS}
              value={form.sessionDuration}
              onChange={(v) => setForm((f) => ({ ...f, sessionDuration: v }))}
              min={10}
              max={240}
            />
            <PresetWithCustom
              label="Buffer time"
              presets={BUFFER_PRESETS}
              value={form.breakDuration}
              onChange={(v) => setForm((f) => ({ ...f, breakDuration: v }))}
              min={0}
              max={120}
            />
          </div>

          {/* Save */}
          <button type="button" className="btn-primary mt-5 w-full" onClick={saveAvailability} disabled={savingAvail || loading}>
            <Save className="h-4 w-4" />
            {savingAvail ? 'Saving…' : availType === 'weekly' ? 'Save Weekly Schedule' : "Save Today's Availability"}
          </button>

          {/* Saved schedules */}
          <div className="mt-6 border-t border-slate-100 pt-5 dark:border-slate-800">
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
              <CalendarCheck className="h-4 w-4 text-indigo-500 dark:text-indigo-400" /> Saved schedules
              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
                {scheduleCount}
              </span>
            </h3>
            {loading ? (
              <div className="mt-3 space-y-2">
                {Array.from({ length: 2 }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            ) : scheduleCount === 0 ? (
              <div className="mt-3">
                <EmptyState
                  icon={CalendarCheck}
                  title="No schedules yet"
                  subtitle="Add your first working-hours schedule above — it appears here with edit & delete options."
                />
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                {oneOffRows.map((s) => (
                  <ScheduleRow
                    key={s._id}
                    label={oneOffLabel(s.date)}
                    icon={CalendarClock}
                    slot={s}
                    fallbackSession={profileDefaults.sessionDuration}
                    fallbackBreak={profileDefaults.breakDuration}
                    booked={slotIsBooked(s)}
                    unavailable={s.isActive === false}
                    onEdit={() => openEdit(s)}
                    onDelete={() => setConfirm({ type: 'delete', target: s })}
                  />
                ))}
                {weeklyRows.map((s) => (
                  <ScheduleRow
                    key={s._id}
                    label={WEEKDAYS[s.dayOfWeek]}
                    icon={Repeat}
                    slot={s}
                    fallbackSession={profileDefaults.sessionDuration}
                    fallbackBreak={profileDefaults.breakDuration}
                    booked={slotIsBooked(s)}
                    unavailable={s.isActive === false}
                    onEdit={() => openEdit(s)}
                    onDelete={() => setConfirm({ type: 'delete', target: s })}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Time off — blocked dates (collapsible, inside the same card) */}
          <Collapsible
            icon={Ban}
            title="Time off — blocked dates"
            badge={blockedDates.length}
            open={timeoffOpen}
            onToggle={() => setTimeoffOpen((o) => !o)}
          >
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Block dates for vacation, personal leave or holidays. Students can't book them.
            </p>
            <form onSubmit={addBlockedDate} className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-[auto_1fr_auto] sm:items-center">
              <input
                type="date"
                className="input !py-2"
                min={today}
                value={blockedForm.date}
                onChange={(e) => setBlockedForm((f) => ({ ...f, date: e.target.value }))}
                required
              />
              <select className="input !py-2" value={blockedForm.reason} onChange={(e) => setBlockedForm((f) => ({ ...f, reason: e.target.value }))}>
                {BLOCKED_REASONS.map((r) => (
                  <option key={r.key} value={r.key}>{r.label}</option>
                ))}
              </select>
              <button type="submit" className="btn-primary !py-2" disabled={blockedSaving}>
                {blockedSaving ? 'Blocking…' : 'Block'}
              </button>
            </form>
            <div className="mt-2 space-y-1.5">
              {blockedDates.length ? (
                blockedDates.map((b) => (
                  <div key={b.date} className="flex items-center justify-between gap-2 rounded-xl border border-rose-100 bg-rose-50/50 px-3 py-2 text-sm dark:border-rose-500/25 dark:bg-rose-500/10">
                    <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 font-semibold text-slate-700 dark:text-slate-200">
                      <CalendarOff className="h-4 w-4 shrink-0 text-rose-500 dark:text-rose-400" />
                      {formatDate(b.date)}
                      <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-medium text-rose-600 dark:bg-rose-500/20 dark:text-rose-300">
                        {BLOCKED_LABEL[b.reason] || b.reason}
                      </span>
                    </span>
                    <button
                      className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-500/15 dark:hover:text-rose-400"
                      onClick={() => removeBlockedDate(b.date)}
                      title="Unblock date"
                      aria-label="Unblock date"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))
              ) : (
                <p className="py-2 text-center text-xs text-slate-400 dark:text-slate-500">No blocked dates yet.</p>
              )}
            </div>
          </Collapsible>

          {/* Slot preview (collapsible, inside the same card) */}
          <Collapsible
            icon={Sparkles}
            title="Slot preview"
            open={previewOpen}
            onToggle={() => setPreviewOpen((o) => !o)}
          >
            <p className="text-xs text-slate-400 dark:text-slate-500">
              See the exact slots students will be able to book on a given day.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                type="date"
                className="input !w-auto !py-1.5 text-xs"
                value={previewDate}
                min={today}
                onChange={(e) => setPreviewDate(e.target.value)}
                aria-label="Preview date"
              />
              <span className="text-[11px] text-slate-400 dark:text-slate-500">({profileDefaults.timeZone})</span>
            </div>
            <div className="mt-2">
              {previewLoading ? (
                <div className="flex justify-center py-4">
                  <span className="h-5 w-5 animate-spin rounded-full border-[3px] border-indigo-100 border-t-indigo-600" />
                </div>
              ) : previewData?.blocked ? (
                <p className="rounded-lg bg-rose-50 px-3 py-2 text-center text-xs font-medium text-rose-600 dark:bg-rose-500/10 dark:text-rose-300">
                  This date is blocked (time off) — no slots will be shown.
                </p>
              ) : previewSlots.length ? (
                <div className="flex flex-wrap gap-2">
                  {previewSlots.map((s) => (
                    <span
                      key={s.startTime}
                      className="rounded-lg border border-indigo-100 bg-white px-3 py-1.5 text-xs font-bold text-indigo-700 shadow-sm dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300"
                    >
                      {formatTime(s.startTime)} – {formatTime(s.endTime)}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="rounded-lg bg-slate-100 px-3 py-2 text-center text-xs text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                  No slots fit on this date with the current working hours. Try another day or adjust session/buffer.
                </p>
              )}
            </div>
          </Collapsible>
        </div>

        {/* ---- Bookings ---- */}
        <div className="card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
              <Inbox className="h-5 w-5 text-indigo-500 dark:text-indigo-400" /> Bookings
            </h2>
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
                icon={Inbox}
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
                      <Video className="h-3.5 w-3.5" /> {b.meetLink.replace('https://', '').slice(0, 40)}…
                    </a>
                  )}
                  {b.status === 'confirmed' && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {b.meetLink && (
                        <a href={b.meetLink} target="_blank" rel="noreferrer" className="btn-primary !px-3 !py-1.5 !text-xs">Join Meet</a>
                      )}
                      <button className="btn-secondary !px-3 !py-1.5 !text-xs" onClick={() => setConfirm({ type: 'complete', target: b })}>
                        <CheckCircle2 className="h-3.5 w-3.5" /> Complete
                      </button>
                      <button className="btn-danger !px-3 !py-1.5 !text-xs" onClick={() => setConfirm({ type: 'cancel', target: b })}>
                        <XCircle className="h-3.5 w-3.5" /> Cancel
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
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
              <Star className="h-5 w-5 text-indigo-500 dark:text-indigo-400" /> Student reviews
            </h2>
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
                  {f ? (<>{f}<Star className="ml-0.5 inline h-3 w-3 fill-current" /></>) : 'All'}
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
                      <span className="flex w-8 shrink-0 items-center gap-0.5 font-semibold text-slate-500 dark:text-slate-400">
                        {d.rating}
                        <Star className="h-3 w-3 fill-current" />
                      </span>
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
                icon={Star}
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
        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
          <History className="h-5 w-5 text-indigo-500 dark:text-indigo-400" /> Recent activity
        </h2>
        {recentActivity.length === 0 ? (
          <p className="mt-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-400 dark:bg-slate-800/60 dark:text-slate-500">
            No activity yet — bookings and slot changes will show up here.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
            {recentActivity.map((b) => {
              const ActivityIcon = ACTIVITY_ICONS[b.status];
              return (
                <li key={b._id} className="flex items-center gap-3 py-2.5 text-sm">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
                    {ActivityIcon ? <ActivityIcon className={`h-4 w-4 ${ACTIVITY_COLORS[b.status] || 'text-slate-400'}`} /> : '•'}
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
              );
            })}
          </ul>
        )}
      </div>

      {/* Edit schedule modal */}
      {editTarget && (
        <Modal
          open={!!editTarget}
          title={`Edit ${editTarget.type === 'one-off' ? oneOffLabel(editTarget.date) : WEEKDAYS[editTarget.dayOfWeek]} schedule`}
          onClose={() => setEditTarget(null)}
          size="md"
        >
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Adjust the working hours, session duration or buffer. Booked schedules can't be edited — cancel the sessions first.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Start</span>
              <input
                type="time"
                step={60}
                className="input"
                value={editForm.startTime}
                onChange={(e) => setEditForm((f) => ({ ...f, startTime: e.target.value }))}
              />
            </div>
            <div>
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">End</span>
              <input
                type="time"
                step={60}
                className="input"
                value={editForm.endTime}
                onChange={(e) => setEditForm((f) => ({ ...f, endTime: e.target.value }))}
              />
            </div>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <PresetWithCustom
              label="Session duration"
              presets={SESSION_PRESETS}
              value={editForm.sessionDuration}
              onChange={(v) => setEditForm((f) => ({ ...f, sessionDuration: v }))}
              min={10}
              max={240}
            />
            <PresetWithCustom
              label="Buffer time"
              presets={BUFFER_PRESETS}
              value={editForm.breakDuration}
              onChange={(v) => setEditForm((f) => ({ ...f, breakDuration: v }))}
              min={0}
              max={120}
            />
          </div>
          <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              checked={editForm.isActive}
              onChange={(e) => setEditForm((f) => ({ ...f, isActive: e.target.checked }))}
            />
            Available for booking
          </label>
          <p className="mt-1.5 text-[11px] text-slate-400 dark:text-slate-500">
            Unchecking keeps the schedule saved but hides its slots from students.
          </p>
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
