import { Router } from 'express';
import { authenticate, optionalAuth } from '../middleware/authenticate.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import {
  getFeed,
  refreshFeed,
  getFeedStats,
  getTrendingFeed,
} from '../controllers/feedController.js';

const router = Router();

// Public routes
router.get('/trending', asyncHandler(getTrendingFeed));

// Protected routes (require authentication)
router.get('/', authenticate, asyncHandler(getFeed));
router.get('/refresh', authenticate, asyncHandler(refreshFeed));
router.get('/stats', authenticate, asyncHandler(getFeedStats));

export default router;
