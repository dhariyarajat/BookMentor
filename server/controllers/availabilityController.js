import mongoose from 'mongoose';
import User from '../models/User.js';
import Availability from '../models/Availability.js';
import MentorProfile from '../models/MentorProfile.js';
import Booking from '../models/Booking.js';
import { getSlotsForDate, todayInZone, conflictsWithWindow, toMinutes } from '../services/slotService.js';
import AppError from '../utils/appError.js';
import asyncHandler from '../utils/asyncHandler.js';

/** Does any confirmed booking overlap this slot (same date for one-off, same weekday for recurring)? */
async function slotHasConfirmedBookings(slot) {
  const timeFilter = { startTime: { $lt: slot.endTime }, endTime: { $gt: slot.startTime } };
  const query =
    slot.type === 'one-off'
      ? { mentor: slot.mentor, date: slot.date, status: 'confirmed', ...timeFilter }
      : {
          mentor: slot.mentor,
          status: 'confirmed',
          ...timeFilter,
          date: { $gte: todayInZone('Asia/Kolkata'), $regex: '^\\d{4}-\\d{2}-\\d{2}$' },
        };
  const bookings = await Booking.find(query).select('date').lean();
  if (slot.type === 'one-off') return bookings.length > 0;
  // For recurring: only bookings whose date's weekday matches the slot's dayOfWeek count.
  return bookings.some((b) => new Date(`${b.date}T12:00:00`).getDay() === slot.dayOfWeek);
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
  return { mentor, timeZone, sessionDuration };
}

/** Public: free slots + booked ranges for a mentor on a given date. */
export const getMentorAvailability = asyncHandler(async (req, res) => {
  const { mentor, timeZone, sessionDuration } = await loadMentorContext(req.params.id);
  if (!mentor.isApproved) throw new AppError('Mentor not found.', 404);

  const date = req.query.date || todayInZone(timeZone);
  const slots = await getSlotsForDate(mentor._id, date, timeZone);
  res.json({ success: true, ...slots, timeZone, sessionDuration });
});

/** Mentor dashboard: all recurring slots + a date's one-off slots & bookings. */
export const getMyAvailability = asyncHandler(async (req, res) => {
  const { mentor, timeZone } = await loadMentorContext(req.user._id);
  const date = req.query.date || todayInZone(timeZone);
  const slots = await getSlotsForDate(mentor._id, date, timeZone);

  const allRecurring = await Availability.find({ mentor: mentor._id, type: 'recurring' }).sort({
    dayOfWeek: 1,
    startTime: 1,
  });
  res.json({ success: true, ...slots, allRecurring });
});

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
 * Throws if any slot matching `filter` sits within the 20-minute buffer of
 * [startTime, endTime). Pure overlaps are already rejected by the callers, so
 * only the buffer case is checked here.
 */
async function assertSlotBuffer(filter, startTime, endTime) {
  const s = toMinutes(startTime);
  const e = toMinutes(endTime);
  const slots = await Availability.find(filter).select('startTime endTime').lean();
  for (const x of slots) {
    if (conflictsWithWindow(s, e, toMinutes(x.startTime), toMinutes(x.endTime)) === 'buffer') {
      throw new AppError('Every session requires a minimum 20-minute buffer after the previous session.', 409);
    }
  }
}

/** Mentor adds a free slot (one-off for a date, or recurring for a weekday). */
export const addSlot = asyncHandler(async (req, res) => {
  const { type, date, dayOfWeek, startTime, endTime } = req.body;
  validateRange(startTime, endTime);
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
  } else {
    if (dayOfWeek === undefined || dayOfWeek === null || dayOfWeek < 0 || dayOfWeek > 6) {
      throw new AppError('A valid dayOfWeek (0-6) is required for recurring slots.', 400);
    }
    filter.dayOfWeek = dayOfWeek;
  }

  // Overlap check against existing slots of the same kind
  const overlap = await Availability.findOne({
    ...filter,
    startTime: { $lt: endTime },
    endTime: { $gt: startTime },
  });
  if (overlap) {
    throw new AppError('This range overlaps with an existing free slot.', 409);
  }

  // A one-off slot must also not overlap the mentor's recurring schedule for that weekday.
  if (type === 'one-off') {
    const weekday = new Date(`${date}T12:00:00`).getDay();
    const recOverlap = await Availability.findOne({
      mentor: mentor._id,
      type: 'recurring',
      dayOfWeek: weekday,
      startTime: { $lt: endTime },
      endTime: { $gt: startTime },
    });
    if (recOverlap) {
      throw new AppError('This range overlaps your recurring schedule for that weekday.', 409);
    }
  }

  // Mandatory 20-minute buffer between consecutive slots (same kind + recurring cross-check).
  await assertSlotBuffer(filter, startTime, endTime);
  if (type === 'one-off') {
    const weekday = new Date(`${date}T12:00:00`).getDay();
    await assertSlotBuffer({ mentor: mentor._id, type: 'recurring', dayOfWeek: weekday }, startTime, endTime);
  }

  // A one-off slot must also respect the buffer around confirmed sessions already booked that day.
  // (Recurring slots span many future dates, so the buffer is enforced at booking time instead.)
  if (type === 'one-off') {
    const sessions = await Booking.find({ mentor: mentor._id, date, status: 'confirmed' }).select('startTime endTime').lean();
    const s = toMinutes(startTime);
    const e = toMinutes(endTime);
    for (const b of sessions) {
      if (conflictsWithWindow(s, e, toMinutes(b.startTime), toMinutes(b.endTime)) === 'buffer') {
        throw new AppError('Every session requires a minimum 20-minute buffer after the previous session.', 409);
      }
    }
  }

  const slot = await Availability.create({ mentor: mentor._id, type, date, dayOfWeek, startTime, endTime });
  res.status(201).json({ success: true, slot });
});

export const deleteSlot = asyncHandler(async (req, res) => {
  const slot = await Availability.findById(req.params.id);
  if (!slot) throw new AppError('Slot not found.', 404);
  if (slot.mentor.toString() !== req.user._id.toString()) {
    throw new AppError('You can only delete your own slots.', 403);
  }
  if (await slotHasConfirmedBookings(slot)) {
    throw new AppError('This slot is already booked. Cancel the session before deleting the slot.', 409);
  }
  await slot.deleteOne();
  res.json({ success: true, message: 'Slot deleted.' });
});

/** Mentor edits a slot's times or marks it unavailable (soft-disable). */
export const updateSlot = asyncHandler(async (req, res) => {
  const slot = await Availability.findById(req.params.id);
  if (!slot) throw new AppError('Slot not found.', 404);
  if (slot.mentor.toString() !== req.user._id.toString()) {
    throw new AppError('You can only edit your own slots.', 403);
  }
  if (await slotHasConfirmedBookings(slot)) {
    throw new AppError('This slot is already booked and cannot be edited.', 409);
  }

  const { startTime, endTime, isActive } = req.body;
  const nextStart = startTime !== undefined ? startTime : slot.startTime;
  const nextEnd = endTime !== undefined ? endTime : slot.endTime;
  validateRange(nextStart, nextEnd);

  // Prevent overlapping with other slots (same kind, excluding self)
  const filter = { mentor: slot.mentor, type: slot.type, _id: { $ne: slot._id } };
  if (slot.type === 'one-off') filter.date = slot.date;
  else filter.dayOfWeek = slot.dayOfWeek;
  const overlap = await Availability.findOne({
    ...filter,
    startTime: { $lt: nextEnd },
    endTime: { $gt: nextStart },
  });
  if (overlap) throw new AppError('This range overlaps with another slot.', 409);

  // A one-off slot must also not overlap the mentor's recurring schedule for that weekday.
  if (slot.type === 'one-off') {
    const weekday = new Date(`${slot.date}T12:00:00`).getDay();
    const recOverlap = await Availability.findOne({
      mentor: slot.mentor,
      type: 'recurring',
      dayOfWeek: weekday,
      startTime: { $lt: nextEnd },
      endTime: { $gt: nextStart },
    });
    if (recOverlap) throw new AppError('This range overlaps your recurring schedule for that weekday.', 409);
  }

  // Mandatory 20-minute buffer between consecutive slots (same kind + recurring cross-check).
  await assertSlotBuffer(filter, nextStart, nextEnd);
  if (slot.type === 'one-off') {
    const weekday = new Date(`${slot.date}T12:00:00`).getDay();
    await assertSlotBuffer({ mentor: slot.mentor, type: 'recurring', dayOfWeek: weekday }, nextStart, nextEnd);
  }

  slot.startTime = nextStart;
  slot.endTime = nextEnd;
  if (typeof isActive === 'boolean') slot.isActive = isActive;
  await slot.save();
  res.json({ success: true, message: 'Slot updated.', slot });
});
