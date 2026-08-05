import User from '../models/User.js';
import Booking from '../models/Booking.js';
import Availability from '../models/Availability.js';
import MentorProfile from '../models/MentorProfile.js';
import AppError from '../utils/appError.js';
import asyncHandler from '../utils/asyncHandler.js';

export const getStats = asyncHandler(async (req, res) => {
  const [students, mentors, bookings, confirmedBookings, cancelledBookings, totalSlots] =
    await Promise.all([
      User.countDocuments({ role: 'student' }),
      User.countDocuments({ role: 'mentor' }),
      Booking.countDocuments(),
      Booking.countDocuments({ status: 'confirmed' }),
      Booking.countDocuments({ status: 'cancelled' }),
      Availability.countDocuments(),
    ]);

  const recentBookings = await Booking.find()
    .populate('mentor', 'name')
    .populate('student', 'name')
    .sort({ createdAt: -1 })
    .limit(6)
    .lean();

  res.json({
    success: true,
    stats: { students, mentors, bookings, confirmedBookings, cancelledBookings, totalSlots },
    recentBookings,
  });
});

export const getUsers = asyncHandler(async (req, res) => {
  const { role = '', search = '', page = 1, limit = 12 } = req.query;
  const filter = {};
  if (role && ['student', 'mentor', 'admin'].includes(role)) filter.role = role;
  if (search) filter.name = { $regex: search.trim(), $options: 'i' };

  const pPage = Math.max(1, parseInt(page, 10) || 1);
  const pLimit = Math.min(50, Math.max(1, parseInt(limit, 10) || 12));

  const [total, users] = await Promise.all([
    User.countDocuments(filter),
    User.find(filter).sort({ createdAt: -1 }).skip((pPage - 1) * pLimit).limit(pLimit).lean(),
  ]);

  res.json({
    success: true,
    users: users.map((u) => ({
      id: u._id,
      name: u.name,
      email: u.email,
      role: u.role,
      avatar: u.avatar,
      isActive: u.isActive,
      isApproved: u.isApproved,
      createdAt: u.createdAt,
    })),
    total,
    page: pPage,
    pages: Math.ceil(total / pLimit) || 1,
  });
});

export const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new AppError('User not found.', 404);
  if (user._id.toString() === req.user._id.toString()) {
    throw new AppError('You cannot modify your own account here.', 400);
  }

  const { isActive, isApproved, role } = req.body;
  if (typeof isActive === 'boolean') user.isActive = isActive;
  if (typeof isApproved === 'boolean') user.isApproved = isApproved;
  if (role && ['student', 'mentor', 'admin'].includes(role)) user.role = role;
  await user.save();

  res.json({ success: true, message: 'User updated.' });
});

export const getAllBookings = asyncHandler(async (req, res) => {
  const { status = '', page = 1, limit = 20 } = req.query;
  const filter = {};
  if (status && ['confirmed', 'cancelled', 'completed'].includes(status)) filter.status = status;

  const pPage = Math.max(1, parseInt(page, 10) || 1);
  const pLimit = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));

  const [total, bookings] = await Promise.all([
    Booking.countDocuments(filter),
    Booking.find(filter)
      .populate('mentor', 'name email')
      .populate('student', 'name email')
      .sort({ createdAt: -1 })
      .skip((pPage - 1) * pLimit)
      .limit(pLimit)
      .lean(),
  ]);

  res.json({
    success: true,
    bookings,
    total,
    page: pPage,
    pages: Math.ceil(total / pLimit) || 1,
  });
});
