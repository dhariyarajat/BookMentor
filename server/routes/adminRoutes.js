import { Router } from 'express';
import { getStats, getUsers, updateUser, getAllBookings } from '../controllers/adminController.js';
import { protect, restrictTo } from '../middlewares/auth.js';

const router = Router();

router.use(protect, restrictTo('admin'));

router.get('/stats', getStats);
router.get('/users', getUsers);
router.patch('/users/:id', updateUser);
router.get('/bookings', getAllBookings);

export default router;
