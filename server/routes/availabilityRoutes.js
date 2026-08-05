import { Router } from 'express';
import {
  getMentorAvailability,
  getMyAvailability,
  addSlot,
  updateSlot,
  deleteSlot,
} from '../controllers/availabilityController.js';
import { protect, restrictTo } from '../middlewares/auth.js';

const router = Router();

// Public: free slots of a mentor for a date
router.get('/mentors/:id', getMentorAvailability);

// Mentor-only
router.get('/me', protect, restrictTo('mentor'), getMyAvailability);
router.post('/', protect, restrictTo('mentor'), addSlot);
router.patch('/:id', protect, restrictTo('mentor'), updateSlot);
router.delete('/:id', protect, restrictTo('mentor'), deleteSlot);

export default router;
