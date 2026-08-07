import Availability from '../models/Availability.js';
import Booking from '../models/Booking.js';
import { todayInZone, nowInZone, zonedTimeToUtc } from '../utils/time.js';

const toMin = (t) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};
export { toMin as toMinutes };

const toStr = (min) => `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

/**
 * Generates the bookable slot grid inside a set of working-hours windows.
 *
 * Algorithm (per working-hours window [workingStart, workingEnd]):
 *   session = window.sessionDuration ?? sessionDuration   (per-window override)
 *   buffer  = window.breakDuration ?? breakDuration
 *   current = workingStart
 *   while current + session <= workingEnd:
 *     slotStart = current
 *     slotEnd   = slotStart + session
 *     if the slot doesn't overlap an existing confirmed booking → show it
 *     current = slotEnd + buffer
 *
 * The grid stays anchored to the window start even when a slot is already
 * booked, so the break between consecutive sessions is always respected and
 * overlapping bookings can never be produced. Slots are computed on every
 * request — nothing is ever persisted.
 *
 * `ranges` are the mentor's working-hours windows for that date
 * (recurring schedule + one-off windows); each range may carry its own
 * sessionDuration/breakDuration to override the profile-level defaults.
 * `booked` are the confirmed booking ranges that block those windows.
 */
export function generateSlotsForRanges({
  ranges = [],
  booked = [],
  sessionDuration = 60,
  breakDuration = 20,
  date,
  timeZone = 'Asia/Kolkata',
}) {
  // Past dates can never have bookable slots
  if (date && date < todayInZone(timeZone)) return [];

  const isToday = !date || date === todayInZone(timeZone);
  const now = isToday ? nowInZone(timeZone) : '';

  const bookedMins = booked.map((b) => ({ s: toMin(b.startTime), e: toMin(b.endTime) }));

  const slots = [];
  for (const range of ranges) {
    const dur = range.sessionDuration ?? sessionDuration;
    const brk = range.breakDuration ?? breakDuration;
    if (!(dur > 0)) continue; // an invalid per-window duration must not hang the grid
    let current = toMin(range.startTime);
    const end = toMin(range.endTime);
    while (current + dur <= end) {
      const start = current;
      const stop = current + dur;
      const startStr = toStr(start);
      const endStr = toStr(stop);

      // Skip grid slots blocked by an existing booking; the grid still
      // advances by session + break so the buffer is always respected.
      const blocked = bookedMins.some((b) => start < b.e && stop > b.s);
      if (!blocked && (!isToday || startStr > now)) {
        slots.push({ startTime: startStr, endTime: endStr });
      }
      current = stop + brk;
    }
  }
  return slots;
}

/**
 * Resolves the effective working-hours windows for a mentor on a given date:
 * recurring windows for that weekday + one-off windows for that date.
 *
 * Override rule: when the mentor saved any "today" (one-off) window for a
 * date, it takes precedence over the weekly schedule — the recurring windows
 * for that weekday are skipped for that date only. Tomorrow the weekly
 * schedule applies again automatically.
 *
 * Also returns the already-booked (confirmed) ranges and the dynamically
 * generated free slots for that date.
 */
export async function getSlotsForDate(mentorId, date, timeZone = 'Asia/Kolkata', opts = {}) {
  const weekday = new Date(`${date}T12:00:00`).getDay();

  // Time-off: if the mentor blocked this date, no working hours apply and no
  // slots can ever be generated for it (regardless of windows or bookings).
  const blocked = (opts.blockedDates || []).some((b) => b.date === date);
  if (blocked) {
    return {
      date,
      weekday,
      timeZone,
      recurring: [],
      oneOff: [],
      ranges: [],
      booked: [],
      slots: [],
      blocked: true,
      sessionDuration: opts.sessionDuration || 60,
      breakDuration: opts.breakDuration ?? 20,
    };
  }

  // NOTE: isActive: { $ne: false } (not plain `true`) so legacy windows created
  // before the field existed (or otherwise missing it) are still treated as
  // active — we only hide windows the mentor explicitly disabled.
  const [recurring, oneOff, booked] = await Promise.all([
    Availability.find({ mentor: mentorId, type: 'recurring', dayOfWeek: weekday, isActive: { $ne: false } }).sort({ startTime: 1 }),
    Availability.find({ mentor: mentorId, type: 'one-off', date, isActive: { $ne: false } }).sort({ startTime: 1 }),
    Booking.find({ mentor: mentorId, date, status: 'confirmed' }).select('startTime endTime').lean(),
  ]);

  // "Today's availability overrides the weekly schedule for that date": if the
  // mentor saved one-off windows for this date, the weekday's recurring windows
  // are skipped (for this date only).
  const effectiveRecurring = oneOff.length ? [] : recurring;

  const toRange = (s) => ({
    startTime: s.startTime,
    endTime: s.endTime,
    sessionDuration: s.sessionDuration,
    breakDuration: s.breakDuration,
  });
  const ranges = [...oneOff.map(toRange), ...effectiveRecurring.map(toRange)];
  const bookedRanges = booked.map((b) => ({ startTime: b.startTime, endTime: b.endTime }));

  const sessionDuration = opts.sessionDuration || 60;
  const breakDuration = opts.breakDuration ?? 20;

  const slots = generateSlotsForRanges({
    ranges,
    booked: bookedRanges,
    sessionDuration,
    breakDuration,
    date,
    timeZone,
  });

  return {
    date,
    weekday,
    timeZone,
    recurring: effectiveRecurring,
    oneOff,
    ranges,
    booked: bookedRanges,
    slots,
    blocked: false,
    sessionDuration,
    breakDuration,
  };
}

/** True if the full [startTime, endTime] window fits inside a free range. */
export function isSlotInRanges(startTime, endTime, ranges) {
  return ranges.some((r) => startTime >= r.startTime && endTime <= r.endTime);
}

/**
 * Finds a confirmed booking (same mentor & date) that overlaps [startTime, endTime)
 * or violates the mentor's break buffer around it. Returns
 * { type: 'overlap' | 'buffer', booking } or null when the window is free.
 *
 * `excludeId` lets rescheduling ignore itself. `bufferMinutes` (the mentor's
 * break duration) guards against sessions sitting closer than the break to an
 * existing booking — a case that only arises with pre-change / misaligned
 * bookings, since new grid-aligned bookings already guarantee the break.
 * Used as a concurrency-safe second line of defense behind the primary guard:
 * a booking must land exactly on a generated free slot.
 */
export async function findSlotConflict(mentorId, date, startTime, endTime, excludeId = null, bufferMinutes = 0) {
  const query = { mentor: mentorId, date, status: 'confirmed' };
  if (excludeId) query._id = { $ne: excludeId };
  const bookings = await Booking.find(query).select('startTime endTime').lean();

  const s = toMin(startTime);
  const e = toMin(endTime);
  const found = bookings.find((b) => {
    const bs = toMin(b.startTime);
    const be = toMin(b.endTime);
    if (s < be && e > bs) return true; // overlaps an existing session
    if (bufferMinutes > 0) {
      if (s >= be && s < be + bufferMinutes) return true; // starts too soon after a session
      if (e <= bs && e > bs - bufferMinutes) return true; // a session starts too soon after this one
    }
    return false;
  });
  if (!found) return null;

  const bs = toMin(found.startTime);
  const be = toMin(found.endTime);
  const type = s < be && e > bs ? 'overlap' : 'buffer';
  return { type, booking: found };
}

/** True if the slot start is already in the past (in the mentor's timezone). */
export function isSlotInPast(date, startTime, timeZone) {
  const start = zonedTimeToUtc(date, startTime, timeZone);
  return start.getTime() <= Date.now();
}

export { todayInZone };
