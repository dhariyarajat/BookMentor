import { Router } from 'express';
import {
  getMentors,
  getMentorById,
  getMyProfile,
  updateMyProfile,
} from '../controllers/mentorController.js';
import { protect, restrictTo } from '../middlewares/auth.js';

const router = Router();

// Public
router.get('/', getMentors);
router.get('/me', protect, restrictTo('mentor'), getMyProfile);
router.get('/:id', getMentorById);
router.patch('/me', protect, restrictTo('mentor'), updateMyProfile);

export default router;
