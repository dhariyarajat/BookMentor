import mongoose from 'mongoose';
import Review from '../models/Review.js';
import Booking from '../models/Booking.js';
import MentorProfile from '../models/MentorProfile.js';
import AppError from '../utils/appError.js';
import asyncHandler from '../utils/asyncHandler.js';

const MAX_COMMENT_LENGTH = 500;

/** Validates rating + comment. Returns { ratingNum, commentText } for valid input. */
function validateReviewInput({ rating, comment }) {
  let ratingNum = null;
  if (rating !== undefined) {
    ratingNum = Number(rating);
    if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      throw new AppError('Rating must be an integer between 1 and 5.', 400);
    }
  }
  let commentText = null;
  if (comment != null) {
    commentText = String(comment).trim();
    if (commentText.length > MAX_COMMENT_LENGTH) {
      throw new AppError(`Review text must be under ${MAX_COMMENT_LENGTH} characters.`, 400);
    }
  }
  return { ratingNum, commentText };
}

/**
 * Recomputes a mentor's denormalized rating aggregates (ratingAvg / ratingCount)
 * straight from the Review collection, so the profile always stays in sync
 * after create / update / delete. Safe to call when the mentor profile is missing.
 */
async function recalcMentorRating(mentorId) {
  const [stats] = await Review.aggregate([
    { $match: { mentor: new mongoose.Types.ObjectId(mentorId) } },
    { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  const avg = stats?.avg || 0;
  const count = stats?.count || 0;

  const profile = await MentorProfile.findOne({ user: mentorId });
  if (profile) {
    profile.ratingAvg = Math.round(avg * 10) / 10;
    profile.ratingCount = count;
    await profile.save();
  }
}

/** A student can review a mentor after a completed session (once per booking). */
export const createReview = asyncHandler(async (req, res) => {
  const { bookingId } = req.body;
  const { ratingNum, commentText } = validateReviewInput(req.body);
  if (ratingNum === null) throw new AppError('Rating is required.', 400);
  if (!mongoose.isValidObjectId(bookingId)) throw new AppError('Invalid booking id.', 400);

  const booking = await Booking.findById(bookingId);
  if (!booking) throw new AppError('Booking not found.', 404);
  if (booking.student.toString() !== req.user._id.toString()) {
    throw new AppError('Only the student of this session can review it.', 403);
  }
  if (booking.status !== 'completed') {
    throw new AppError('You can review a session only after it is completed.', 400);
  }
  const existing = await Review.findOne({ booking: booking._id });
  if (existing) throw new AppError('You have already reviewed this session.', 409);

  let review;
  try {
    review = await Review.create({
      booking: booking._id,
      mentor: booking.mentor,
      student: booking.student,
      rating: ratingNum,
      comment: commentText ?? '',
    });
  } catch (err) {
    // E11000 -> unique index on `booking`: a concurrent request created a review first.
    if (err.code === 11000) {
      throw new AppError('You have already reviewed this session.', 409);
    }
    throw err;
  }

  await recalcMentorRating(booking.mentor);

  res.status(201).json({ success: true, review });
});

/**
 * Public list of a mentor's reviews with summary stats:
 * average rating, total count and the 5★..1★ rating distribution.
 * Supports `?rating=5` filtering and `?sort=oldest` (default: latest first).
 */
export const getMentorReviews = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new AppError('Invalid mentor id.', 400);
  const { rating = '', sort = 'latest' } = req.query;

  const filter = { mentor: req.params.id };
  const ratingNum = Number(rating);
  if (rating !== '' && Number.isInteger(ratingNum) && ratingNum >= 1 && ratingNum <= 5) {
    filter.rating = ratingNum;
  }

  const [reviews, statsData] = await Promise.all([
    Review.find(filter)
      .populate('student', 'name avatar')
      .sort(sort === 'oldest' ? { createdAt: 1 } : { createdAt: -1 })
      .limit(100)
      .lean(),
    Review.aggregate([
      { $match: { mentor: new mongoose.Types.ObjectId(req.params.id) } },
      {
        $facet: {
          summary: [{ $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } }],
          distribution: [{ $group: { _id: '$rating', count: { $sum: 1 } } }],
        },
      },
    ]),
  ]);

  const facet = statsData[0] || {};
  const summary = facet.summary?.[0];
  const stats = {
    avg: summary?.avg ? Math.round(summary.avg * 10) / 10 : 0,
    count: summary?.count || 0,
    distribution: [5, 4, 3, 2, 1].map((r) => ({ rating: r, count: 0 })),
  };
  for (const d of facet.distribution || []) {
    const row = stats.distribution.find((x) => x.rating === d._id);
    if (row) row.count = d.count;
  }

  res.json({ success: true, reviews, stats });
});

/** The logged-in student's own reviews (used to show write/edit/delete state). */
export const getMyReviews = asyncHandler(async (req, res) => {
  const reviews = await Review.find({ student: req.user._id })
    .populate('mentor', 'name avatar')
    .populate('booking', '_id')
    .sort({ createdAt: -1 })
    .lean();
  res.json({ success: true, reviews });
});

/** A student can edit only their own review. Recalculates the mentor's rating. */
export const updateReview = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id);
  if (!review) throw new AppError('Review not found.', 404);
  if (review.student.toString() !== req.user._id.toString()) {
    throw new AppError('You can only edit your own review.', 403);
  }

  const { ratingNum, commentText } = validateReviewInput(req.body);
  if (ratingNum !== null) review.rating = ratingNum;
  if (commentText !== null) review.comment = commentText;
  await review.save();

  await recalcMentorRating(review.mentor);

  res.json({ success: true, review });
});

/** A student can delete only their own review. Recalculates the mentor's rating. */
export const deleteReview = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id);
  if (!review) throw new AppError('Review not found.', 404);
  if (review.student.toString() !== req.user._id.toString()) {
    throw new AppError('You can only delete your own review.', 403);
  }

  const mentorId = review.mentor;
  await review.deleteOne();
  await recalcMentorRating(mentorId);

  res.json({ success: true, message: 'Review deleted.' });
});
