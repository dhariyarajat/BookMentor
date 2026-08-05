import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, select: false }, // hashed; absent for Google-only accounts
    role: { type: String, enum: ['student', 'mentor', 'admin'], default: 'student' },
    avatar: { type: String, default: '' },
    googleId: { type: String },
    // Google OAuth tokens used to auto-create Google Meet links (mentors only)
    googleAccessToken: { type: String, select: false },
    googleRefreshToken: { type: String, select: false },
    googleTokenExpiry: { type: Number },
    // Password reset (hashed token + 15-minute expiry), only set while a reset is pending
    resetPasswordToken: { type: String, select: false },
    resetPasswordExpires: { type: Date },
    isActive: { type: Boolean, default: true },
    // Mentors must be approved by an admin before appearing in search
    isApproved: { type: Boolean, default: true },
  },
  { timestamps: true }
);

userSchema.methods.matchPassword = async function (enteredPassword) {
  if (!this.password) return false;
  return bcrypt.compare(enteredPassword, this.password);
};

userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

const User = mongoose.model('User', userSchema);
export default User;
