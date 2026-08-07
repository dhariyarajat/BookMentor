import mongoose from 'mongoose';
import User from '../models/User.js';
import Availability from '../models/Availability.js';
import MentorProfile from '../models/MentorProfile.js';
import Booking from '../models/Booking.js';
import { getSlotsForDate, todayInZone } from '../services/slotService.js';
import AppError from '../utils/appError.js';
import asyncHandler from '../utils/asyncHandler.js';

/** Does any confirmed booking overlap this window (same date for one-off, same weekday for recurring)? */
async function windowHasConfirmedBookings(window) {
  const timeFilter = { startTime: { $lt: window.endTime }, endTime: { $gt: window.startTime } };
  const query =
    window.type === 'one-off'
      ? { mentor: window.mentor, date: window.date, status: 'confirmed', ...timeFilter }
      : {
          mentor: window.mentor,
          status: 'confirmed',
          ...timeFilter,
          date: { $gte: todayInZone('Asia/Kolkata'), $regex: '^\\d{4}-\\d{2}-\\d{2}$' },
        };
  const bookings = await Booking.find(query).select('date').lean();
  if (window.type === 'one-off') return bookings.length > 0;
  // For recurring: only bookings whose date's weekday matches the window's dayOfWeek count.
  return bookings.some((b) => new Date(`${b.date}T12:00:00`).getDay() === window.dayOfWeek);
}

async function loadMentorContext(mentorId) {
  if (!mongoose.isValidObjectId(mentorId)) throw new AppError('Invalid mentor id.', 400);
  const mentor = await User.findById(mentorId);
  if (!mentor || mentor.role !== 'mentor' || !mentor.isActive) {
    throw new AppError('Mentor not found.', 404);
  }
  const profile = await MentorProfile.findOne({ user: mentorId });
  const timeZone = profile?.timeZone || 'Asia/Kolkata';
  const sessionDuration = profile?.sessionDuration || 60;
  const breakDuration = profile?.breakDuration ?? 20;
  const blockedDates = profile?.blockedDates || [];
  return { mentor, timeZone, sessionDuration, breakDuration, blockedDates };
}

/** Public: working hours + dynamically generated free slots for a mentor on a given date. */
export const getMentorAvailability = asyncHandler(async (req, res) => {
  const { mentor, timeZone, sessionDuration, breakDuration, blockedDates } = await loadMentorContext(req.params.id);
  if (!mentor.isApproved) throw new AppError('Mentor not found.', 404);

  const date = req.query.date || todayInZone(timeZone);
  const result = await getSlotsForDate(mentor._id, date, timeZone, { sessionDuration, breakDuration, blockedDates });

  // Debug logs (dev only, avoids noise in production): requested date, mentor id,
  // fetched availability, filtered slots, final response.
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[availability] GET mentor=${mentor._id} requestedDate=${date} today=${todayInZone(timeZone)} tz=${timeZone}`);
    console.log(
      `[availability] fetched: recurring=${result.recurring.length} oneOff=${result.oneOff.length} ranges=${JSON.stringify(
        result.ranges
      )} booked=${JSON.stringify(result.booked)}`
    );
    console.log(
      `[availability] filtered slots (session=${sessionDuration}m break=${breakDuration}m): ${JSON.stringify(result.slots)}`
    );
    console.log(
      `[availability] final response: ${JSON.stringify({ date: result.date, slots: result.slots, sessionDuration, breakDuration })}`
    );
  }

  res.json({ success: true, ...result, timeZone, sessionDuration, breakDuration });
});

/** Mentor dashboard: all recurring windows + a date's one-off windows, bookings & generated slots. */
export const getMyAvailability = asyncHandler(async (req, res) => {
  const { mentor, timeZone, sessionDuration, breakDuration, blockedDates } = await loadMentorContext(req.user._id);
  const date = req.query.date || todayInZone(timeZone);
  const result = await getSlotsForDate(mentor._id, date, timeZone, { sessionDuration, breakDuration, blockedDates });

  const [allRecurring, allOneOff] = await Promise.all([
    Availability.find({ mentor: mentor._id, type: 'recurring' }).sort({ dayOfWeek: 1, startTime: 1 }),
    Availability.find({ mentor: mentor._id, type: 'one-off' }).sort({ date: 1, startTime: 1 }),
  ]);
  console.log(
    `[availability] GET /me mentor=${mentor._id} requestedDate=${date} ranges=${result.ranges.length} slots=${JSON.stringify(result.slots)}`
  );
  res.json({ success: true, ...result, allRecurring, allOneOff, timeZone, sessionDuration, breakDuration, blockedDates });
});

function validateDurations(sessionDuration, breakDuration) {
  const ok = (v, min, max) => v === undefined || (Number.isFinite(v) && v >= min && v <= max);
  if (!ok(sessionDuration, 10, 240)) {
    throw new AppError('Session duration must be between 10 and 240 minutes.', 400);
  }
  if (!ok(breakDuration, 0, 120)) {
    throw new AppError('Break duration must be between 0 and 120 minutes.', 400);
  }
}

function validateRange(startTime, endTime) {
  const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (!timeRe.test(startTime) || !timeRe.test(endTime)) {
    throw new AppError('Times must be in HH:mm (24h) format.', 400);
  }
  if (startTime >= endTime) {
    throw new AppError('Start time must be before end time.', 400);
  }
}

/**
 * Mentor adds a working-hours window (one-off for a date, or recurring for a
 * weekday). Each window may carry its own sessionDuration/breakDuration, which
 * override the profile-level defaults when generating bookable slots.
 *
 * One-off windows implement the "today overrides weekly" rule: saving a
 * date's availability replaces that date's existing one-off windows (they are
 * removed, unless they already have confirmed bookings).
 */
export const addSlot = asyncHandler(async (req, res) => {
  const { type, date, dayOfWeek, startTime, endTime } = req.body;
  // Coerce to numbers so string payloads can never corrupt slot generation.
  const sessionDuration = req.body.sessionDuration === undefined ? undefined : Number(req.body.sessionDuration);
  const breakDuration = req.body.breakDuration === undefined ? undefined : Number(req.body.breakDuration);
  validateRange(startTime, endTime);
  validateDurations(sessionDuration, breakDuration);
  if (!['one-off', 'recurring'].includes(type)) {
    throw new AppError('Slot type must be one-off or recurring.', 400);
  }

  const { mentor, timeZone } = await loadMentorContext(req.user._id);

  const filter = { mentor: mentor._id, type };
  if (type === 'one-off') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) {
      throw new AppError('A valid date (YYYY-MM-DD) is required for one-off slots.', 400);
    }
    if (date < todayInZone(timeZone)) {
      throw new AppError('Cannot add a free slot in the past.', 400);
    }
    filter.date = date;

    // Saving "today's availability" replaces any existing one-off windows for
    // that date. Booked windows are protected — check for them BEFORE deleting
    // anything so a failed save never loses unbooked windows.
    const existing = await Availability.find({ mentor: mentor._id, type: 'one-off', date });
    const bookedWindows = [];
    for (const w of existing) {
      if (await windowHasConfirmedBookings(w)) bookedWindows.push(w);
    }
    if (bookedWindows.length) {
      throw new AppError(
        'This date already has booked sessions. Cancel them before replacing the date\'s availability.',
        409
      );
    }
    for (const w of existing) await w.deleteOne();
  } else {
    if (dayOfWeek === undefined || dayOfWeek === null || dayOfWeek < 0 || dayOfWeek > 6) {
      throw new AppError('A valid dayOfWeek (0-6) is required for recurring slots.', 400);
    }
    filter.dayOfWeek = dayOfWeek;
  }

  // Overlap check against existing windows of the same kind
  const overlap = await Availability.findOne({
    ...filter,
    startTime: { $lt: endTime },
    endTime: { $gt: startTime },
  });
  if (overlap) {
    throw new AppError('This range overlaps with an existing free slot.', 409);
  }

  let slot;
  try {
    slot = await Availability.create({
      mentor: mentor._id,
      type,
      date,
      dayOfWeek,
      startTime,
      endTime,
      sessionDuration: sessionDuration ?? null,
      breakDuration: breakDuration ?? null,
    });
  } catch (err) {
    // E11000 -> unique partial index: a concurrent request created the same window first.
    if (err.code === 11000) {
      throw new AppError('This range overlaps with an existing free slot.', 409);
    }
    throw err;
  }
  res.status(201).json({ success: true, slot });
});

export const deleteSlot = asyncHandler(async (req, res) => {
  const slot = await Availability.findById(req.params.id);
  if (!slot) throw new AppError('Slot not found.', 404);
  if (slot.mentor.toString() !== req.user._id.toString()) {
    throw new AppError('You can only delete your own slots.', 403);
  }
  if (await windowHasConfirmedBookings(slot)) {
    throw new AppError('This slot is already booked. Cancel the session before deleting the slot.', 409);
  }
  await slot.deleteOne();
  res.json({ success: true, message: 'Slot deleted.' });
});

/** Mentor edits a window's times or marks it unavailable (soft-disable). */
export const updateSlot = asyncHandler(async (req, res) => {
  const slot = await Availability.findById(req.params.id);
  if (!slot) throw new AppError('Slot not found.', 404);
  if (slot.mentor.toString() !== req.user._id.toString()) {
    throw new AppError('You can only edit your own slots.', 403);
  }
  if (await windowHasConfirmedBookings(slot)) {
    throw new AppError('This slot is already booked and cannot be edited.', 409);
  }

  const { startTime, endTime, isActive } = req.body;
  const nextStart = startTime !== undefined ? startTime : slot.startTime;
  const nextEnd = endTime !== undefined ? endTime : slot.endTime;
  // Coerce to numbers so string payloads can never corrupt slot generation.
  const sessionDuration = req.body.sessionDuration === undefined ? undefined : Number(req.body.sessionDuration);
  const breakDuration = req.body.breakDuration === undefined ? undefined : Number(req.body.breakDuration);
  validateRange(nextStart, nextEnd);
  validateDurations(sessionDuration, breakDuration);

  // Prevent overlapping with other windows (same kind, excluding self)
  const filter = { mentor: slot.mentor, type: slot.type, _id: { $ne: slot._id } };
  if (slot.type === 'one-off') filter.date = slot.date;
  else filter.dayOfWeek = slot.dayOfWeek;
  const overlap = await Availability.findOne({
    ...filter,
    startTime: { $lt: nextEnd },
    endTime: { $gt: nextStart },
  });
  if (overlap) throw new AppError('This range overlaps with another slot.', 409);

  slot.startTime = nextStart;
  slot.endTime = nextEnd;
  if (typeof isActive === 'boolean') slot.isActive = isActive;
  if (sessionDuration !== undefined) slot.sessionDuration = sessionDuration;
  if (breakDuration !== undefined) slot.breakDuration = breakDuration;
  await slot.save();
  res.json({ success: true, message: 'Slot updated.', slot });
});

const BLOCKED_REASONS = ['vacation', 'personal', 'emergency', 'holiday', 'other'];

/** Mentor blocks a date (time off). Students cannot book it — no slots are generated. */
export const addBlockedDate = asyncHandler(async (req, res) => {
  const { date, reason = 'other' } = req.body;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) {
    throw new AppError('A valid date (YYYY-MM-DD) is required.', 400);
  }
  const { mentor, timeZone } = await loadMentorContext(req.user._id);
  if (date < todayInZone(timeZone)) {
    throw new AppError('Cannot block a date in the past.', 400);
  }
  const key = String(reason || 'other').trim().toLowerCase();
  const cleanReason = BLOCKED_REASONS.includes(key) ? key : 'other';

  let profile = await MentorProfile.findOne({ user: mentor._id });
  if (!profile) profile = await MentorProfile.create({ user: mentor._id });
  if (profile.blockedDates.some((b) => b.date === date)) {
    throw new AppError('This date is already blocked.', 409);
  }

  profile.blockedDates.push({ date, reason: cleanReason });
  // Keep the list sorted by date (ascending) for a tidy UI.
  profile.blockedDates.sort((a, b) => (a.date < b.date ? -1 : 1));
  await profile.save();
  res.status(201).json({ success: true, message: 'Date blocked.', blockedDates: profile.blockedDates });
});

/** Mentor unblocks a date. */
export const deleteBlockedDate = asyncHandler(async (req, res) => {
  const { date } = req.params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) {
    throw new AppError('A valid date (YYYY-MM-DD) is required.', 400);
  }
  const profile = await MentorProfile.findOne({ user: req.user._id });
  if (!profile) throw new AppError('No profile found.', 404);

  const before = profile.blockedDates.length;
  profile.blockedDates = profile.blockedDates.filter((b) => b.date !== date);
  if (profile.blockedDates.length === before) {
    throw new AppError('This date is not blocked.', 404);
  }
  await profile.save();
  res.json({ success: true, message: 'Date unblocked.', blockedDates: profile.blockedDates });
});
