import mongoose from 'mongoose';

const mentorProfileSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    headline: { type: String, default: '', maxlength: 120 },
    bio: { type: String, default: '', maxlength: 2000 },
    expertise: { type: [String], default: [] },
    experienceYears: { type: Number, default: 0, min: 0, max: 60 },
    sessionDuration: { type: Number, default: 60, min: 15, max: 240 }, // minutes
    timeZone: { type: String, default: 'Asia/Kolkata' },
    location: { type: String, default: '' },
    languages: { type: [String], default: [] },
    // Denormalized rating data (updated when reviews are added)
    ratingAvg: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const MentorProfile = mongoose.model('MentorProfile', mentorProfileSchema);
export default MentorProfile;
