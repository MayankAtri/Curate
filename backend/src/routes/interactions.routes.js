import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import {
  trackInteraction,
  trackBatchInteractions,
  getInteractionHistory,
  getInteractionStats,
  getLearningInsights,
  triggerLearning,
} from '../controllers/interactionController.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Track interactions
router.post('/track', asyncHandler(trackInteraction));
router.post('/batch', asyncHandler(trackBatchInteractions));

// Get interaction data
router.get('/history', asyncHandler(getInteractionHistory));
router.get('/stats', asyncHandler(getInteractionStats));

// Learning insights
router.get('/insights', asyncHandler(getLearningInsights));
router.post('/learn', asyncHandler(triggerLearning));

export default router;
