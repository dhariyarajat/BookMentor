import Availability from '../models/Availability.js';
import Booking from '../models/Booking.js';
import { todayInZone, zonedTimeToUtc } from '../utils/time.js';

/** Mandatory gap (minutes) after every session before the next one can start. */
export const SESSION_BUFFER_MINUTES = 20;

const toMin = (t) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};
export { toMin as toMinutes };

/**
 * Classifies a window [s, e) (minutes) against an existing window [bs, be).
 * Returns 'overlap', 'buffer' (violates the 20-minute buffer) or null.
 * A gap of exactly 20 minutes is allowed.
 */
export function conflictsWithWindow(s, e, bs, be) {
  if (s < be && e > bs) return 'overlap';
  if (s >= be && s < be + SESSION_BUFFER_MINUTES) return 'buffer'; // too soon after existing
  if (e <= bs && e > bs - SESSION_BUFFER_MINUTES) return 'buffer'; // existing starts too soon after ours
  return null;
}

/**
 * Resolves the effective free ranges for a mentor on a given date:
 * recurring slots for that weekday + one-off slots for that date.
 * Also returns the already-booked (confirmed) ranges for that date.
 */
export async function getSlotsForDate(mentorId, date, timeZone = 'Asia/Kolkata') {
  const weekday = new Date(`${date}T12:00:00`).getDay();

  const [recurring, oneOff, booked] = await Promise.all([
    Availability.find({ mentor: mentorId, type: 'recurring', dayOfWeek: weekday, isActive: true }).sort({ startTime: 1 }),
    Availability.find({ mentor: mentorId, type: 'one-off', date, isActive: true }).sort({ startTime: 1 }),
    Booking.find({ mentor: mentorId, date, status: 'confirmed' }).select('startTime endTime').lean(),
  ]);

  return {
    date,
    weekday,
    timeZone,
    recurring,
    oneOff,
    ranges: [...oneOff.map((s) => ({ startTime: s.startTime, endTime: s.endTime })), ...recurring.map((s) => ({ startTime: s.startTime, endTime: s.endTime }))],
    booked: booked.map((b) => ({ startTime: b.startTime, endTime: b.endTime })),
  };
}

/** True if the full [startTime, endTime] window fits inside a free range. */
export function isSlotInRanges(startTime, endTime, ranges) {
  return ranges.some((r) => startTime >= r.startTime && endTime <= r.endTime);
}

/**
 * Finds a confirmed booking (same mentor & date) that overlaps [startTime, endTime)
 * or violates the 20-minute buffer. Returns { type: 'overlap' | 'buffer', booking }
 * or null when the window is free. `excludeId` lets rescheduling ignore itself.
 */
export async function findSlotConflict(mentorId, date, startTime, endTime, excludeId = null) {
  const query = { mentor: mentorId, date, status: 'confirmed' };
  if (excludeId) query._id = { $ne: excludeId };
  const bookings = await Booking.find(query).select('startTime endTime').lean();

  const s = toMin(startTime);
  const e = toMin(endTime);
  for (const b of bookings) {
    const kind = conflictsWithWindow(s, e, toMin(b.startTime), toMin(b.endTime));
    if (kind) return { type: kind, booking: b };
  }
  return null;
}

/** True if the slot start is already in the past (in the mentor's timezone). */
export function isSlotInPast(date, startTime, timeZone) {
  const start = zonedTimeToUtc(date, startTime, timeZone);
  return start.getTime() <= Date.now();
}

export { todayInZone };
