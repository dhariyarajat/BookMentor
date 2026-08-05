import { Router } from 'express';
import {
  createReview,
  getMentorReviews,
  getMyReviews,
  updateReview,
  deleteReview,
} from '../controllers/reviewController.js';
import { protect, restrictTo } from '../middlewares/auth.js';

const router = Router();

// Public: reviews for a mentor's public profile (kept as a legacy alias too)
router.get('/mentors/:id', getMentorReviews);
router.get('/mentor/:id', getMentorReviews);

// Student-only: list the logged-in student's own reviews
router.get('/mine', protect, restrictTo('student'), getMyReviews);

// Student-only: create a review for a completed booking
router.post('/', protect, restrictTo('student'), createReview);

// Student-only: edit / delete their own review
router.patch('/:id', protect, restrictTo('student'), updateReview);
router.delete('/:id', protect, restrictTo('student'), deleteReview);

export default router;
