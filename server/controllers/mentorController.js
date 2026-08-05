import mongoose from 'mongoose';
import User from '../models/User.js';
import MentorProfile from '../models/MentorProfile.js';
import Availability from '../models/Availability.js';
import Booking from '../models/Booking.js';
import AppError from '../utils/appError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { todayInZone } from '../utils/time.js';

export function toPublicMentor(doc) {
  const p = doc.profile || {};
  return {
    id: doc._id,
    name: doc.name,
    email: doc.email,
    avatar: doc.avatar,
    headline: p.headline || '',
    bio: p.bio || '',
    expertise: p.expertise || [],
    experienceYears: p.experienceYears || 0,
    hourlyRate: p.hourlyRate || 0,
    sessionDuration: p.sessionDuration || 60,
    timeZone: p.timeZone || 'Asia/Kolkata',
    location: p.location || '',
    languages: p.languages || [],
    ratingAvg: p.ratingAvg || 0,
    ratingCount: p.ratingCount || 0,
    isApproved: doc.isApproved,
    isOnline: doc.isOnline === true,
    totalSessions: doc.totalSessions || 0,
  };
}

/**
 * "Online" = the mentor has at least one active future slot (recurring
 * schedule or a one-off slot on a date >= today). Pure function of slots.
 */
export async function computeOnlineStatus(mentorId, timeZone = 'Asia/Kolkata') {
  const today = todayInZone(timeZone);
  const active = await Availability.findOne({
    mentor: mentorId,
    isActive: true,
    $or: [{ type: 'recurring' }, { type: 'one-off', date: { $gte: today } }],
  }).select('_id').lean();
  return Boolean(active);
}

/** Total sessions conducted by the mentor (completed bookings). */
export async function computeTotalSessions(mentorId) {
  return Booking.countDocuments({ mentor: mentorId, status: 'completed' });
}

const SORTS = {
  rating: { 'profile.ratingAvg': -1 },
  rate_low: { 'profile.hourlyRate': 1 },
  rate_high: { 'profile.hourlyRate': -1 },
  experience: { 'profile.experienceYears': -1 },
  newest: { createdAt: -1 },
};

/** Public mentor directory with search, filters, sorting and pagination. */
export const getMentors = asyncHandler(async (req, res) => {
  const {
    search = '',
    expertise = '',
    minRating = 0,
    sort = 'rating',
    online = '',
    page = 1,
    limit = 9,
  } = req.query;

  const pPage = Math.max(1, parseInt(page, 10) || 1);
  const pLimit = Math.min(30, Math.max(1, parseInt(limit, 10) || 9));

  const match = { role: 'mentor', isActive: true, isApproved: true };
  if (search) match.name = { $regex: search.trim(), $options: 'i' };

  const pipeline = [
    { $match: match },
    {
      $lookup: {
        from: 'mentorprofiles',
        localField: '_id',
        foreignField: 'user',
        as: 'profile',
      },
    },
    { $unwind: { path: '$profile', preserveNullAndEmptyArrays: true } },
  ];

  const profileMatch = {};
  if (expertise) {
    profileMatch['profile.expertise'] = { $in: expertise.split(',').map((e) => e.trim()).filter(Boolean) };
  }
  const minR = parseFloat(minRating);
  if (!Number.isNaN(minR) && minR > 0) {
    profileMatch['profile.ratingAvg'] = { $gte: minR };
  }
  if (Object.keys(profileMatch).length) pipeline.push({ $match: profileMatch });

  // Attach a flag: does this mentor have any active future slot?
  pipeline.push({
    $lookup: {
      from: 'availabilities',
      let: { mentorId: '$_id' },
      pipeline: [
        {
          $match: {
            $expr: { $eq: ['$mentor', '$$mentorId'] },
            isActive: true,
            $or: [{ type: 'recurring' }, { type: 'one-off', date: { $gte: todayInZone('Asia/Kolkata') } }],
          },
        },
        { $limit: 1 },
      ],
      as: 'onlineSlot',
    },
  });
  pipeline.push({ $addFields: { isOnline: { $gt: [{ $size: '$onlineSlot' }, 0] } } });
  if (online === 'true') pipeline.push({ $match: { isOnline: true } });

  const sortStage = SORTS[sort] || SORTS.rating;
  pipeline.push(
    { $addFields: { 'profile.ratingAvg': { $ifNull: ['$profile.ratingAvg', 0] } } },
    { $sort: sortStage },
    {
      $facet: {
        metadata: [{ $count: 'total' }],
        data: [{ $skip: (pPage - 1) * pLimit }, { $limit: pLimit }],
      },
    }
  );

  const [{ metadata, data }] = await User.aggregate(pipeline);

  const total = metadata[0]?.total || 0;
  res.json({
    success: true,
    mentors: data.map(toPublicMentor),
    total,
    page: pPage,
    pages: Math.ceil(total / pLimit) || 1,
  });
});

export const getMentorById = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new AppError('Invalid mentor id.', 400);
  const user = await User.findById(req.params.id).lean();
  if (!user || user.role !== 'mentor' || !user.isActive || !user.isApproved) {
    throw new AppError('Mentor not found.', 404);
  }
  const profile = await MentorProfile.findOne({ user: user._id }).lean();
  const [isOnline, totalSessions] = await Promise.all([
    computeOnlineStatus(user._id, profile?.timeZone),
    computeTotalSessions(user._id),
  ]);
  res.json({ success: true, mentor: toPublicMentor({ ...user, profile: profile || {}, isOnline, totalSessions }) });
});

export const getMyProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).lean();
  const profile = await MentorProfile.findOne({ user: user._id }).lean();
  const [isOnline, totalSessions] = await Promise.all([
    computeOnlineStatus(user._id, profile?.timeZone),
    computeTotalSessions(user._id),
  ]);
  res.json({ success: true, mentor: toPublicMentor({ ...user, profile: profile || {}, isOnline, totalSessions }) });
});

export const updateMyProfile = asyncHandler(async (req, res) => {
  const allowed = [
    'headline',
    'bio',
    'expertise',
    'experienceYears',
    'hourlyRate',
    'sessionDuration',
    'timeZone',
    'location',
    'languages',
  ];
  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }
  if (updates.sessionDuration && (updates.sessionDuration < 15 || updates.sessionDuration > 240)) {
    throw new AppError('Session duration must be between 15 and 240 minutes.');
  }
  if (updates.expertise !== undefined) {
    updates.expertise = updates.expertise.map((e) => e.trim()).filter(Boolean);
  }
  if (updates.languages !== undefined) {
    updates.languages = updates.languages.map((e) => e.trim()).filter(Boolean);
  }

  let profile = await MentorProfile.findOne({ user: req.user._id });
  if (!profile) profile = await MentorProfile.create({ user: req.user._id });
  Object.assign(profile, updates);
  await profile.save();

  const user = await User.findById(req.user._id).lean();
  res.json({ success: true, mentor: toPublicMentor({ ...user, profile }) });
});
