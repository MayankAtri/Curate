import learningService from '../services/learning/LearningService.js';
import User from '../models/User.js';
import { JOB_SCHEDULES } from '../config/constants.js';
import { logger } from '../utils/logger.js';

let isRunning = false;
let jobInterval = null;

/**
 * Process unprocessed interactions in batches
 * Runs frequently to keep up with incoming interactions
 */
async function processInteractions() {
  if (isRunning) {
    logger.debug('Learning job already running, skipping');
    return;
  }

  isRunning = true;
  const startTime = Date.now();

  try {
    logger.info('Starting interaction processing job');

    let totalProcessed = 0;
    let batchCount = 0;
    const maxBatches = 10; // Process max 10 batches per run

    // Process in batches until no more unprocessed interactions
    while (batchCount < maxBatches) {
      const stats = await learningService.processInteractionBatch(500);

      if (stats.processed === 0) {
        break;
      }

      totalProcessed += stats.processed;
      batchCount++;
    }

    const duration = Date.now() - startTime;
    logger.info('Interaction processing complete', {
      totalProcessed,
      batches: batchCount,
      duration,
    });

    return { totalProcessed, batches: batchCount, duration };
  } catch (error) {
    logger.error('Error in interaction processing job', { error: error.message });
    throw error;
  } finally {
    isRunning = false;
  }
}

/**
 * Run comprehensive learning analysis for active users
 * Runs less frequently (e.g., daily)
 */
async function runComprehensiveLearning() {
  const startTime = Date.now();

  try {
    logger.info('Starting comprehensive learning job');

    // Find active users (active in last 7 days)
    const activeUsers = await User.findActiveUsers(7);
    logger.info(`Found ${activeUsers.length} active users for learning analysis`);

    let processed = 0;
    let errors = 0;

    for (const user of activeUsers) {
      try {
        await learningService.runUserAnalysis(user._id.toString(), 30);
        processed++;
      } catch (error) {
        logger.error('Error in user learning analysis', {
          error: error.message,
          userId: user._id,
        });
        errors++;
      }
    }

    const duration = Date.now() - startTime;
    logger.info('Comprehensive learning complete', {
      totalUsers: activeUsers.length,
      processed,
      errors,
      duration,
    });

    return { totalUsers: activeUsers.length, processed, errors, duration };
  } catch (error) {
    logger.error('Error in comprehensive learning job', { error: error.message });
    throw error;
  }
}

/**
 * Start the learning job scheduler
 */
function startLearningJob() {
  // Process interactions every 5 minutes
  const interactionInterval = 5 * 60 * 1000;

  logger.info(`Starting learning job scheduler (interval: ${interactionInterval / 1000}s)`);

  // Run immediately on start
  processInteractions().catch(err => {
    logger.error('Initial interaction processing failed', { error: err.message });
  });

  // Schedule regular runs
  jobInterval = setInterval(() => {
    processInteractions().catch(err => {
      logger.error('Scheduled interaction processing failed', { error: err.message });
    });
  }, interactionInterval);

  return jobInterval;
}

/**
 * Stop the learning job scheduler
 */
function stopLearningJob() {
  if (jobInterval) {
    clearInterval(jobInterval);
    jobInterval = null;
    logger.info('Learning job scheduler stopped');
  }
}

export {
  processInteractions,
  runComprehensiveLearning,
  startLearningJob,
  stopLearningJob,
};
