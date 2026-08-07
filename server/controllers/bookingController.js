import mongoose from 'mongoose';
import Booking from '../models/Booking.js';
import User from '../models/User.js';
import MentorProfile from '../models/MentorProfile.js';
import { getSlotsForDate, findSlotConflict, isSlotInPast } from '../services/slotService.js';
import { zonedTimeToUtc, todayInZone } from '../utils/time.js';
import { sendMail, emailTemplates } from '../services/mailer.js';
import { createMeetLink, deleteCalendarEvent } from '../services/meeting.js';
import AppError from '../utils/appError.js';
import asyncHandler from '../utils/asyncHandler.js';

async function loadMentor(mentorId) {
  if (!mongoose.isValidObjectId(mentorId)) throw new AppError('Invalid mentor id.', 400);
  const mentor = await User.findById(mentorId);
  if (!mentor || mentor.role !== 'mentor' || !mentor.isActive || !mentor.isApproved) {
    throw new AppError('Mentor not found or not available.', 404);
  }
  const profile = await MentorProfile.findOne({ user: mentor._id });
  return { mentor, profile };
}

async function buildEmailData(booking, mentor, student, timeZone) {
  return {
    mentorName: mentor.name,
    studentName: student.name,
    studentEmail: student.email,
    date: booking.date,
    startTime: booking.startTime,
    endTime: booking.endTime,
    timeZone,
    bookingId: booking._id.toString(),
    status: booking.status,
    meetLink: booking.meetLink,
    notes: booking.notes,
    cancelReason: booking.cancelReason,
  };
}

/** Sends email to both parties independently, never failing the request if emailing breaks. */
async function notifyBoth({ student, mentor, buildForStudent, buildForMentor }) {
  const results = await Promise.allSettled([
    sendMail({ to: student.email, ...buildForStudent() }),
    sendMail({ to: mentor.email, ...buildForMentor() }),
  ]);
  for (const r of results) {
    if (r.status === 'rejected') console.error('❌ Notification email failed:', r.reason?.message || r.reason);
  }
}

/** Best-effort: create a Google Meet link via the mentor's connected calendar. */
async function attachMeetLink(booking, mentor, student, date, startTime, endTime, timeZone) {
  if (!mentor.googleRefreshToken) return;
  const meet = await createMeetLink({
    user: mentor,
    summary: `Mentoring session: ${student.name} ↔ ${mentor.name}`,
    start: zonedTimeToUtc(date, startTime, timeZone),
    end: zonedTimeToUtc(date, endTime, timeZone),
    attendeeEmails: [mentor.email, student.email],
  });
  if (meet) {
    booking.meetLink = meet.meetLink;
    booking.calendarEventId = meet.eventId;
    await booking.save();
  }
}

/** Student books a slot. Concurrency-safe via the unique partial index. */
export const createBooking = asyncHandler(async (req, res) => {
  const { mentorId, date, startTime, notes = '' } = req.body;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) throw new AppError('A valid date (YYYY-MM-DD) is required.', 400);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime || '')) throw new AppError('A valid start time (HH:mm) is required.', 400);

  const { mentor, profile } = await loadMentor(mentorId);
  if (mentor._id.toString() === req.user._id.toString()) {
    throw new AppError('You cannot book a session with yourself.', 400);
  }

  const timeZone = profile.timeZone || 'Asia/Kolkata';
  const sessionDuration = profile.sessionDuration || 60;
  const breakDuration = profile.breakDuration ?? 20;

  if ((profile.blockedDates || []).some((b) => b.date === date)) {
    throw new AppError('This date is blocked by the mentor (time off) and cannot be booked.', 400);
  }
  if (isSlotInPast(date, startTime, timeZone)) {
    throw new AppError('This slot is already in the past.', 400);
  }

  // Slots are generated on every request from the mentor's working hours +
  // session/break duration (which may differ per schedule window), minus
  // existing bookings. A booking is only valid if it lands exactly on one of
  // those generated free slots — this guarantees it fits the working hours,
  // respects the break buffer and never overlaps. The slot's own endTime is
  // authoritative, so per-window durations are honored automatically.
  const { slots } = await getSlotsForDate(mentorId, date, timeZone, { sessionDuration, breakDuration });
  const match = slots.find((s) => s.startTime === startTime);
  if (!match) {
    throw new AppError("This slot is not available. Please pick one of the mentor's free slots.", 400);
  }
  const endTime = match.endTime;

  const conflict = await findSlotConflict(mentorId, date, startTime, endTime, null, breakDuration);
  if (conflict) {
    if (conflict.type === 'buffer') {
      throw new AppError('This slot is too close to another session. Please pick another time.', 409);
    }
    throw new AppError('This slot was just taken by someone else. Please pick another time.', 409);
  }

  let booking;
  try {
    booking = await Booking.create({
      mentor: mentor._id,
      student: req.user._id,
      date,
      startTime,
      endTime,
      notes: notes.trim(),
      timeZone,
    });
  } catch (err) {
    // E11000 -> unique partial index hit: someone booked this exact slot first.
    if (err.code === 11000) {
      throw new AppError('This slot was just taken by someone else. Please pick another time.', 409);
    }
    throw err;
  }

  await attachMeetLink(booking, mentor, req.user, date, startTime, endTime, timeZone);

  const student = req.user;
  const data = await buildEmailData(booking, mentor, student, timeZone);
  await notifyBoth({
    student,
    mentor,
    buildForStudent: () => emailTemplates.bookingConfirmed(data),
    buildForMentor: () => emailTemplates.mentorNewBooking(data),
  });

  res.status(201).json({ success: true, booking, message: 'Session booked successfully!' });
});

/** Students: their bookings, split into upcoming & past. */
export const getMyBookings = asyncHandler(async (req, res) => {
  const bookings = await Booking.find({ student: req.user._id })
    .populate('mentor', 'name email avatar')
    .sort({ createdAt: -1 })
    .lean();

  // Every booking lands in exactly one list: upcoming (confirmed & not yet passed)
  // or past (everything else, including past-dated confirmed ones awaiting auto-complete).
  const enriched = bookings.map((b) => ({ ...b, timeZone: b.timeZone || 'Asia/Kolkata' }));
  const upcoming = enriched.filter((b) => b.status === 'confirmed' && b.date >= todayInZone(b.timeZone));
  const past = enriched.filter((b) => !(b.status === 'confirmed' && b.date >= todayInZone(b.timeZone)));
  res.json({ success: true, upcoming, past });
});

/** Mentors: bookings for their calendar. */
export const getMentorBookings = asyncHandler(async (req, res) => {
  const { status, date } = req.query;
  const filter = { mentor: req.user._id };
  if (status) filter.status = status;
  if (date) filter.date = date;

  const bookings = await Booking.find(filter)
    .populate('student', 'name email avatar')
    .sort({ date: 1, startTime: 1 })
    .lean();

  const profile = await MentorProfile.findOne({ user: req.user._id }).lean();
  const timeZone = profile?.timeZone || 'Asia/Kolkata';

  res.json({ success: true, bookings: bookings.map((b) => ({ ...b, timeZone })) });
});

/** Student or mentor cancels a booking. */
export const cancelBooking = asyncHandler(async (req, res) => {
  const { reason = '' } = req.body;
  const booking = await Booking.findById(req.params.id)
    .populate('mentor', 'name email googleRefreshToken')
    .populate('student', 'name email');
  if (!booking) throw new AppError('Booking not found.', 404);

  const isMentor = booking.mentor._id.toString() === req.user._id.toString();
  const isStudent = booking.student._id.toString() === req.user._id.toString();
  if (!isMentor && !isStudent) throw new AppError('Not your booking.', 403);
  if (booking.status !== 'confirmed') throw new AppError('This booking is already closed.', 400);

  booking.status = 'cancelled';
  booking.cancelledBy = isMentor ? 'mentor' : 'student';
  booking.cancelReason = reason.trim();
  await booking.save();

  if (booking.calendarEventId) {
    await deleteCalendarEvent(booking.mentor, booking.calendarEventId);
  }

  const data = await buildEmailData(booking, booking.mentor, booking.student, booking.timeZone || 'Asia/Kolkata');
  await notifyBoth({
    student: booking.student,
    mentor: booking.mentor,
    buildForStudent: () => emailTemplates.bookingCancelled(data),
    buildForMentor: () =>
      emailTemplates.bookingCancelledForMentor({
        ...data,
        cancelledByName: isMentor ? 'you' : booking.student.name,
      }),
  });

  res.json({ success: true, message: 'Booking cancelled.' });
});

/** Student or mentor reschedules a booking to a new date/time. */
export const rescheduleBooking = asyncHandler(async (req, res) => {
  const { newDate, newStartTime } = req.body;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate || '')) throw new AppError('A valid new date (YYYY-MM-DD) is required.', 400);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(newStartTime || '')) throw new AppError('A valid new start time (HH:mm) is required.', 400);

  const booking = await Booking.findById(req.params.id)
    .populate('mentor', 'name email googleRefreshToken')
    .populate('student', 'name email');
  if (!booking) throw new AppError('Booking not found.', 404);
  if (booking.status !== 'confirmed') throw new AppError('Only confirmed bookings can be rescheduled.', 400);

  const isMentor = booking.mentor._id.toString() === req.user._id.toString();
  const isStudent = booking.student._id.toString() === req.user._id.toString();
  if (!isMentor && !isStudent) throw new AppError('Not your booking.', 403);

  const profile = await MentorProfile.findOne({ user: booking.mentor._id });
  const timeZone = profile?.timeZone || 'Asia/Kolkata';
  const sessionDuration = profile?.sessionDuration || 60;
  const breakDuration = profile?.breakDuration ?? 20;

  if (isSlotInPast(newDate, newStartTime, timeZone)) {
    throw new AppError('The new slot is already in the past.', 400);
  }

  if ((profile.blockedDates || []).some((b) => b.date === newDate)) {
    throw new AppError('This date is blocked by the mentor (time off) and cannot be booked.', 400);
  }

  // Same rule as booking: the new time must be a generated free slot (the
  // booking's own current slot is excluded from the free list automatically).
  const { slots } = await getSlotsForDate(booking.mentor._id, newDate, timeZone, { sessionDuration, breakDuration });
  const match = slots.find((s) => s.startTime === newStartTime);
  if (!match) {
    throw new AppError("The new slot is not available. Please pick one of the mentor's free slots.", 400);
  }
  const newEndTime = match.endTime;
  const conflict = await findSlotConflict(booking.mentor._id, newDate, newStartTime, newEndTime, booking._id, breakDuration);
  if (conflict) {
    if (conflict.type === 'buffer') {
      throw new AppError('The new slot is too close to another session. Please pick another time.', 409);
    }
    throw new AppError('The new slot was just taken. Please pick another time.', 409);
  }

  if (booking.calendarEventId) {
    await deleteCalendarEvent(booking.mentor, booking.calendarEventId);
  }

  booking.date = newDate;
  booking.startTime = newStartTime;
  booking.endTime = newEndTime;
  booking.timeZone = timeZone;
  booking.rescheduleCount += 1;
  booking.reminderSent = false; // new time gets a fresh 20-minute reminder
  booking.reminderSentAt = null;
  booking.calendarEventId = '';
  booking.meetLink = '';
  await booking.save();

  await attachMeetLink(booking, booking.mentor, booking.student, newDate, newStartTime, newEndTime, timeZone);

  const data = await buildEmailData(booking, booking.mentor, booking.student, timeZone);
  await notifyBoth({
    student: booking.student,
    mentor: booking.mentor,
    buildForStudent: () => emailTemplates.bookingRescheduled(data),
    buildForMentor: () => emailTemplates.bookingRescheduledForMentor(data),
  });

  res.json({ success: true, message: 'Booking rescheduled.', booking });
});

/** Mentor marks a confirmed session as completed. */
export const completeBooking = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id)
    .populate('mentor', 'name email')
    .populate('student', 'name email');
  if (!booking) throw new AppError('Booking not found.', 404);
  if (!booking.mentor || !booking.student) throw new AppError('Booking references a missing user.', 404);
  if (booking.mentor._id.toString() !== req.user._id.toString()) {
    throw new AppError('Only the mentor can complete this session.', 403);
  }
  if (booking.status !== 'confirmed') throw new AppError('Only confirmed bookings can be completed.', 400);

  booking.status = 'completed';
  await booking.save();

  // Best-effort completion email to the student — never fails the request.
  try {
    const data = await buildEmailData(booking, booking.mentor, booking.student, booking.timeZone || 'Asia/Kolkata');
    await sendMail({ to: booking.student.email, ...emailTemplates.sessionCompleted(data) });
  } catch (err) {
    console.error('❌ Completion email failed:', err.message);
  }

  res.json({ success: true, message: 'Session marked as completed.' });
});
