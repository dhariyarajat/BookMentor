import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import client from '../api/client.js';
import { todayInZone, buildSlotStarts, formatDate } from '../utils/time.js';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

/**
 * Monthly calendar that highlights dates with free slots and lets the user
 * click a date to view its slots. Pure frontend — fetches the existing
 * per-date availability endpoint for future days of the visible month.
 */
export default function CalendarView({ mentorId, timeZone, selectedDate, onSelectDate }) {
  const today = todayInZone(timeZone);
  const [view, setView] = useState(() => `${selectedDate.slice(0, 7)}-01`);
  const [slotsByDate, setSlotsByDate] = useState({});
  const [blockedDates, setBlockedDates] = useState([]); // mentor time-off dates this month
  const [loading, setLoading] = useState(false);

  // Keep the visible month in sync when the selected date moves across a month boundary
  useEffect(() => {
    setView((v) => (selectedDate.slice(0, 7) !== v.slice(0, 7) ? `${selectedDate.slice(0, 7)}-01` : v));
  }, [selectedDate]);

  const [y, m] = view.split('-').map(Number);
  const firstWeekday = new Date(y, m - 1, 1).getDay();
  const daysInMonth = new Date(y, m, 0).getDate();
  const monthDates = [];
  for (let d = 1; d <= daysInMonth; d++) {
    monthDates.push(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }

  // Cache fetched months so toggling back and forth doesn't refire ~30 requests.
  // Keyed by the full today so the snapshot refreshes on each new day.
  const cacheRef = useRef({});

  useEffect(() => {
    const cacheKey = `${mentorId}|${view.slice(0, 7)}|${today}`;
    if (cacheRef.current[cacheKey]) {
      const c = cacheRef.current[cacheKey];
      setSlotsByDate(c.slots);
      setBlockedDates(c.blocked);
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    const future = monthDates.filter((ds) => ds >= today);
    if (!future.length) {
      setSlotsByDate({});
      setBlockedDates([]);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    Promise.allSettled(future.map((ds) => client.get(`/availability/mentors/${mentorId}?date=${ds}`)))
      .then((results) => {
        if (cancelled) return;
        const map = {};
        const blocked = [];
        results.forEach((r, i) => {
          if (r.status === 'fulfilled') {
            const data = r.value.data;
            if (data.blocked) {
              blocked.push(future[i]);
              return;
            }
            const starts = buildSlotStarts({
              slots: data.slots,
              date: future[i],
              timeZone: data.timeZone || timeZone,
            });
            if (starts.length) map[future[i]] = starts.length;
          }
        });
        // Cap the cache to the last few visited months
        const keys = Object.keys(cacheRef.current);
        if (keys.length >= 8) delete cacheRef.current[keys[0]];
        cacheRef.current[cacheKey] = { slots: map, blocked };
        setSlotsByDate(map);
        setBlockedDates(blocked);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [view, mentorId, timeZone, today]); // eslint-disable-line react-hooks/exhaustive-deps

  const prevDisabled = `${y}-${String(m).padStart(2, '0')}` <= today.slice(0, 7);
  const goMonth = (delta) => {
    const d = new Date(y, m - 1 + delta, 1);
    setView(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`);
  };
  const monthLabel = new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div>
      <div className="flex items-center justify-between">
        <button
          className="btn-ghost !px-2.5 !py-1.5 text-sm"
          onClick={() => goMonth(-1)}
          disabled={prevDisabled}
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{monthLabel}</p>
        <button className="btn-ghost !px-2.5 !py-1.5 text-sm" onClick={() => goMonth(1)} aria-label="Next month">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
        {WEEKDAYS.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {Array.from({ length: firstWeekday }).map((_, i) => (
          <span key={`blank-${i}`} />
        ))}
        {monthDates.map((ds) => {
          const count = slotsByDate[ds];
          const isBlocked = blockedDates.includes(ds);
          const isPast = ds < today;
          const isSelected = ds === selectedDate;
          return (
            <button
              key={ds}
              disabled={isPast || isBlocked}
              onClick={() => onSelectDate(ds)}
              title={
                count
                  ? `${count} free slot(s) · ${formatDate(ds)}`
                  : isBlocked
                  ? `Blocked (time off) · ${formatDate(ds)}`
                  : formatDate(ds)
              }
              className={`flex h-9 items-center justify-center rounded-lg text-xs font-semibold transition-all duration-150 ${
                isSelected
                  ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md shadow-indigo-600/25'
                  : isBlocked
                  ? 'cursor-not-allowed bg-rose-50 text-rose-300 line-through decoration-rose-200 dark:bg-rose-500/10 dark:text-rose-500/60 dark:decoration-rose-500/30'
                  : count
                  ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-500/15 dark:text-indigo-300 dark:hover:bg-indigo-500/25'
                  : isPast
                  ? 'cursor-not-allowed text-slate-300 dark:text-slate-600'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              <span className="relative">
                {Number(ds.slice(8))}
                {count > 0 && !isSelected && (
                  <span className="absolute -bottom-1.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-indigo-500 dark:bg-indigo-400" />
                )}
                {isBlocked && (
                  <span className="absolute -bottom-1.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-rose-400 dark:bg-rose-500" />
                )}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-400 dark:text-slate-500">
        {loading ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
            Checking slots…
          </span>
        ) : (
          <>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-indigo-500" /> Available
            </span>
            {blockedDates.length > 0 && (
              <>
                <span>·</span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-rose-400" /> Blocked
                </span>
              </>
            )}
            <span>·</span>
            <span>Click a date to see its slots</span>
          </>
        )}
      </div>
    </div>
  );
}
