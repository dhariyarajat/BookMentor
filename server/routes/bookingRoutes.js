import { Router } from 'express';
import {
  createBooking,
  getMyBookings,
  getMentorBookings,
  cancelBooking,
  rescheduleBooking,
  completeBooking,
} from '../controllers/bookingController.js';
import { protect, restrictTo } from '../middlewares/auth.js';

const router = Router();

router.use(protect);

router.post('/', restrictTo('student'), createBooking);
router.get('/my-bookings', restrictTo('student'), getMyBookings);
router.get('/mentor-bookings', restrictTo('mentor'), getMentorBookings);
router.post('/:id/cancel', cancelBooking); // student or mentor
router.post('/:id/reschedule', rescheduleBooking); // student or mentor
router.post('/:id/complete', restrictTo('mentor'), completeBooking);

export default router;
