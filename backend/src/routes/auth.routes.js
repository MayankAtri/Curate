import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import {
  register,
  login,
  refreshToken,
  getMe,
  logout,
} from '../controllers/authController.js';

const router = Router();

// Public routes
router.post('/register', asyncHandler(register));
router.post('/login', asyncHandler(login));
router.post('/refresh', asyncHandler(refreshToken));

// Protected routes (require authentication)
router.get('/me', authenticate, asyncHandler(getMe));
router.post('/logout', authenticate, asyncHandler(logout));

export default router;
