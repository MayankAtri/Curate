import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { getTopicPreferences, updateTopicPreferences } from '../controllers/preferencesController.js';

const router = Router();

router.use(authenticate);

router.get('/topics', asyncHandler(getTopicPreferences));
router.put('/topics', asyncHandler(updateTopicPreferences));

export default router;

