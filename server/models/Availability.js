import mongoose from 'mongoose';

/**
 * A working-hours window set by a mentor. Bookable slots are generated from
 * these windows on every request (working hours + session duration + break
 * duration - existing bookings); only the windows themselves are stored.
 * type "one-off"   -> for a specific date
 * type "recurring" -> repeats every week on dayOfWeek (0=Sunday ... 6=Saturday)
 */
const availabilitySchema = new mongoose.Schema(
  {
    mentor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['one-off', 'recurring'], required: true },
    date: { type: String, default: null }, // 'YYYY-MM-DD' (one-off)
    dayOfWeek: { type: Number, default: null }, // 0-6 (recurring)
    startTime: { type: String, required: true }, // 'HH:mm'
    endTime: { type: String, required: true }, // 'HH:mm'
    // Per-schedule session & break durations (minutes). When null, the
    // mentor profile's global values are used as the fallback — this keeps
    // windows created before these fields existed fully functional.
    sessionDuration: { type: Number, default: null, min: 10, max: 240 },
    breakDuration: { type: Number, default: null, min: 0, max: 120 },
    isActive: { type: Boolean, default: true }, // mentor can mark a slot unavailable without deleting it
  },
  { timestamps: true }
);

// Prevent duplicate overlapping ranges for the same mentor + kind
availabilitySchema.index({ mentor: 1, type: 1, date: 1, startTime: 1 }, { unique: true });
availabilitySchema.index({ mentor: 1, type: 1, dayOfWeek: 1, startTime: 1 }, { unique: true });

const Availability = mongoose.model('Availability', availabilitySchema);
export default Availability;
