import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema(
  {
    mentor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    date: { type: String, required: true }, // 'YYYY-MM-DD'
    startTime: { type: String, required: true }, // 'HH:mm'
    endTime: { type: String, required: true }, // 'HH:mm'
    status: { type: String, enum: ['confirmed', 'cancelled', 'completed'], default: 'confirmed' },
    rescheduleCount: { type: Number, default: 0 },
    meetLink: { type: String, default: '' },
    calendarEventId: { type: String, default: '' },
    // Timezone the session is scheduled in (snapshotted from the mentor's profile)
    timeZone: { type: String, default: 'Asia/Kolkata' },
    notes: { type: String, default: '', maxlength: 500 },
    cancelledBy: { type: String, enum: ['', 'student', 'mentor'], default: '' },
    cancelReason: { type: String, default: '' },
    reminderSent: { type: Boolean, default: false }, // true once the 20-minute reminder emails are sent
    reminderSentAt: { type: Date, default: null }, // when the 20-minute reminder was sent
  },
  { timestamps: true }
);

/**
 * Concurrency safety: a unique partial index guarantees only ONE active
 * booking can occupy a given (mentor, date, startTime) slot. If two students
 * book the exact same slot at the same time, MongoDB rejects the second
 * insert with a duplicate-key error (E11000) -> the API returns 409 and the
 * UI shows "this slot was just taken by someone else".
 */
bookingSchema.index(
  { mentor: 1, date: 1, startTime: 1 },
  { unique: true, partialFilterExpression: { status: 'confirmed' } }
);

// Speeds up the every-minute reminder cron (status + reminderSent + date-range
// pre-filter) and the daily auto-complete scan (status + date).
bookingSchema.index({ status: 1, reminderSent: 1, date: 1 });

const Booking = mongoose.model('Booking', bookingSchema);
export default Booking;
