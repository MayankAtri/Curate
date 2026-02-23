import express from 'express';
import { authenticate, requireAdmin } from '../middleware/authenticate.js';
import {
  addDiscoveryJob,
  addSummarizationJob,
  addFeedGenerationJob,
  getQueueStats,
  cleanupOldJobs,
} from '../jobs/queues.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// All jobs routes are admin-only.
router.use(authenticate, requireAdmin);

/**
 * GET /api/jobs/stats
 * Get queue statistics
 */
router.get('/stats', async (req, res, next) => {
  try {
    const stats = await getQueueStats();
    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/jobs/discover
 * Trigger article discovery job manually
 */
router.post('/discover', async (req, res, next) => {
  try {
    const { sourceTypes } = req.body;

    const job = await addDiscoveryJob({ sourceTypes });

    logger.info('Manual discovery job triggered', { jobId: job.id });

    res.json({
      success: true,
      message: 'Discovery job queued',
      jobId: job.id,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/jobs/summarize
 * Trigger summarization job manually
 */
router.post('/summarize', async (req, res, next) => {
  try {
    const { articleIds, limit = 10 } = req.body;

    const job = await addSummarizationJob(articleIds, { limit });

    logger.info('Manual summarization job triggered', { jobId: job.id });

    res.json({
      success: true,
      message: 'Summarization job queued',
      jobId: job.id,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/jobs/generate-feed
 * Trigger feed generation job manually
 */
router.post('/generate-feed', async (req, res, next) => {
  try {
    const userId = req.headers['x-user-id'] || req.body.userId;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID required (x-user-id header or userId in body)',
      });
    }

    const job = await addFeedGenerationJob(userId);

    logger.info('Manual feed generation job triggered', {
      jobId: job.id,
      userId,
    });

    res.json({
      success: true,
      message: 'Feed generation job queued',
      jobId: job.id,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/jobs/cleanup
 * Clean up old completed/failed jobs
 */
router.post('/cleanup', async (req, res, next) => {
  try {
    await cleanupOldJobs();

    res.json({
      success: true,
      message: 'Old jobs cleaned up',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
