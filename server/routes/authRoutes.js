import { Router } from 'express';
import {
  register,
  login,
  googleAuth,
  googleTokens,
  forgotPassword,
  resetPassword,
  changePassword,
  getMe,
  updateProfile,
} from '../controllers/authController.js';
import { protect } from '../middlewares/auth.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/google', googleAuth);
router.post('/google/tokens', protect, googleTokens);
router.get('/me', protect, getMe);
router.patch('/me', protect, updateProfile);

// Password recovery (public)
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);
// Change password (logged in)
router.patch('/change-password', protect, changePassword);

export default router;
