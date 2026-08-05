import mongoose from 'mongoose';

/**
 * A free time slot set by a mentor.
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
    isActive: { type: Boolean, default: true }, // mentor can mark a slot unavailable without deleting it
  },
  { timestamps: true }
);

// Prevent duplicate overlapping ranges for the same mentor + kind
availabilitySchema.index({ mentor: 1, type: 1, date: 1, startTime: 1 }, { unique: true });
availabilitySchema.index({ mentor: 1, type: 1, dayOfWeek: 1, startTime: 1 }, { unique: true });

const Availability = mongoose.model('Availability', availabilitySchema);
export default Availability;
