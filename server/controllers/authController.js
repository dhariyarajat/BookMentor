import { createHash, randomBytes } from 'node:crypto';
import User from '../models/User.js';
import MentorProfile from '../models/MentorProfile.js';
import { signToken } from '../utils/jwt.js';
import { sendMail, emailTemplates } from '../services/mailer.js';
import AppError from '../utils/appError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { verifyGoogleIdToken } from '../config/google.js';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);
const AUTO_APPROVE = process.env.AUTO_APPROVE_MENTORS !== 'false';

function autoApproveFor(role) {
  return role === 'student' ? true : AUTO_APPROVE;
}

function publicUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatar: user.avatar,
    isApproved: user.isApproved,
  };
}

async function ensureMentorProfile(user) {
  if (user.role !== 'mentor') return null;
  let profile = await MentorProfile.findOne({ user: user._id });
  if (!profile) {
    profile = await MentorProfile.create({ user: user._id });
  }
  return profile;
}

export const register = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password) {
    throw new AppError('Name, email and password are required.');
  }
  if (password.length < 6) {
    throw new AppError('Password must be at least 6 characters long.');
  }
  if (!['student', 'mentor'].includes(role)) {
    throw new AppError('Role must be either student or mentor.');
  }

  const exists = await User.findOne({ email: email.toLowerCase() });
  if (exists) {
    throw new AppError('An account with this email already exists. Please login.', 409);
  }

  const finalRole = ADMIN_EMAILS.includes(email.toLowerCase()) ? 'admin' : role;
  const user = await User.create({
    name,
    email,
    password,
    role: finalRole,
    isApproved: finalRole === 'admin' ? true : autoApproveFor(role),
  });
  await ensureMentorProfile(user);

  const token = signToken(user);
  res.status(201).json({ success: true, token, user: publicUser(user) });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) throw new AppError('Email and password are required.');

  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
  if (!user || !(await user.matchPassword(password))) {
    throw new AppError('Invalid email or password.', 401);
  }
  if (!user.isActive) {
    throw new AppError('This account has been disabled. Contact support.', 403);
  }

  const token = signToken(user);
  res.json({ success: true, token, user: publicUser(user) });
});

/**
 * Google sign-in (Google Identity Services -> id_token).
 * Creates the account on first sign-in; role comes from the request body
 * for brand-new accounts only.
 */
export const googleAuth = asyncHandler(async (req, res) => {
  const { idToken, role } = req.body;
  if (!idToken) throw new AppError('Google id token is required.');

  const payload = await verifyGoogleIdToken(idToken);
  const email = payload.email.toLowerCase();
  const googleId = payload.sub;

  let user = await User.findOne({ $or: [{ googleId }, { email }] });

  if (!user) {
    const finalRole = ADMIN_EMAILS.includes(email) ? 'admin' : role === 'mentor' ? 'mentor' : 'student';
    user = await User.create({
      name: payload.name || email.split('@')[0],
      email,
      googleId,
      avatar: payload.picture || '',
      role: finalRole,
      isApproved: finalRole === 'admin' ? true : autoApproveFor(finalRole),
    });
    await ensureMentorProfile(user);
  } else {
    // Link the googleId if the account was created with email/password
    if (!user.googleId) {
      user.googleId = googleId;
      if (payload.picture && !user.avatar) user.avatar = payload.picture;
      await user.save();
    }
  }

  if (!user.isActive) {
    throw new AppError('This account has been disabled. Contact support.', 403);
  }

  const token = signToken(user);
  res.json({ success: true, token, user: publicUser(user) });
});

/**
 * Stores Google OAuth access/refresh tokens (used by mentors to
 * auto-generate Google Meet links). Called from the client after the
 * "Connect Google Calendar" consent prompt.
 */
export const googleTokens = asyncHandler(async (req, res) => {
  const { accessToken, refreshToken, expiryDate } = req.body;
  if (!accessToken) throw new AppError('Access token is required.');

  const user = await User.findById(req.user._id);
  user.googleAccessToken = accessToken;
  if (refreshToken) user.googleRefreshToken = refreshToken;
  user.googleTokenExpiry = expiryDate || Date.now() + 3600_000;
  await user.save({ validateBeforeSave: false });

  res.json({ success: true, message: 'Google calendar connected. Meeting links will be generated automatically.' });
});

const RESET_TOKEN_BYTES = 32; // 64 hex chars
const RESET_TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes

/** Hashes a raw reset token so only the hash is ever persisted. */
function hashResetToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Sends a password reset email if the email belongs to an active account.
 * Always answers with the same generic message to avoid leaking which emails
 * are registered (prevents account enumeration).
 */
export const forgotPassword = asyncHandler(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AppError('Please enter a valid email address.', 400);
  }

  const user = await User.findOne({ email });
  if (user && user.isActive) {
    const token = randomBytes(RESET_TOKEN_BYTES).toString('hex');
    user.resetPasswordToken = hashResetToken(token);
    user.resetPasswordExpires = new Date(Date.now() + RESET_TOKEN_TTL_MS);
    await user.save();

    // Best-effort: never fail the request if the email cannot be delivered.
    try {
      const resetUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/reset-password/${token}`;
      const result = await sendMail({ to: user.email, ...emailTemplates.passwordReset({ name: user.name, resetUrl }) });
      // Dev mode (EMAIL_ENABLED=false) only logs the subject — print the link so
      // the flow stays testable locally. Never returned in API responses.
      if (result?.dev) console.log(`[dev] Password reset link for ${user.email}: ${resetUrl}`);
    } catch (err) {
      console.error('❌ Password reset email failed:', err.message);
    }
  }

  res.json({
    success: true,
    message: 'If an account exists for that email, a password reset link has been sent. It expires in 15 minutes.',
  });
});

/** Validates the reset token from the URL, then sets the new password. */
export const resetPassword = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { password, confirmPassword } = req.body;

  if (!password || String(password).length < 6) {
    throw new AppError('Password must be at least 6 characters long.', 400);
  }
  if (password !== confirmPassword) {
    throw new AppError('Passwords do not match.', 400);
  }

  const user = await User.findOne({
    resetPasswordToken: hashResetToken(token),
    resetPasswordExpires: { $gt: Date.now() },
  });
  if (!user) {
    throw new AppError('This password reset link is invalid or has expired. Please request a new one.', 400);
  }
  if (!user.isActive) {
    throw new AppError('This account has been disabled. Please contact support.', 403);
  }

  // The pre-save hook re-hashes the password; clearing the token fields
  // invalidates this (and any previously issued) reset link.
  user.password = String(password);
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();

  res.json({ success: true, message: 'Password reset successful. You can now log in with your new password.' });
});

/** Logged-in users verify their current password and set a new one. */
export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;

  if (!currentPassword) throw new AppError('Please enter your current password.', 400);
  if (!newPassword || String(newPassword).length < 6) {
    throw new AppError('New password must be at least 6 characters long.', 400);
  }
  if (newPassword !== confirmPassword) {
    throw new AppError('Passwords do not match.', 400);
  }

  const user = await User.findById(req.user._id).select('+password');
  if (!user || !user.isActive) throw new AppError('This account no longer exists or has been disabled.', 401);

  if (!user.password) {
    throw new AppError('Your account uses Google sign-in and does not have a password to change.', 400);
  }
  if (!(await user.matchPassword(String(currentPassword)))) {
    throw new AppError('Current password is incorrect.', 401);
  }
  if (await user.matchPassword(String(newPassword))) {
    throw new AppError('New password must be different from your current password.', 400);
  }

  user.password = String(newPassword);
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();

  res.json({ success: true, message: 'Password changed successfully.' });
});

export const getMe = asyncHandler(async (req, res) => {
  const user = req.user;
  const profile = user.role === 'mentor' ? await MentorProfile.findOne({ user: user._id }) : null;
  res.json({ success: true, user: publicUser(user), profile });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const { name, avatar } = req.body;
  const user = req.user;
  if (name) user.name = name;
  if (avatar !== undefined) user.avatar = avatar;
  await user.save();
  res.json({ success: true, user: publicUser(user) });
});
