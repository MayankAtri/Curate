import { Queue } from 'bullmq';
import { redisConnection } from '../config/redis.js';
import { logger } from '../utils/logger.js';

/**
 * Queue definitions for background jobs
 */

// Queue names
export const QUEUE_NAMES = {
  ARTICLE_DISCOVERY: 'article-discovery',
  SUMMARIZATION: 'summarization',
  FEED_GENERATION: 'feed-generation',
};

// Default job options
const defaultJobOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 1000,
  },
  removeOnComplete: {
    count: 100, // Keep last 100 completed jobs
  },
  removeOnFail: {
    count: 50, // Keep last 50 failed jobs
  },
};

// Create queues
export const articleDiscoveryQueue = new Queue(QUEUE_NAMES.ARTICLE_DISCOVERY, {
  connection: redisConnection,
  defaultJobOptions,
});

export const summarizationQueue = new Queue(QUEUE_NAMES.SUMMARIZATION, {
  connection: redisConnection,
  defaultJobOptions,
});

export const feedGenerationQueue = new Queue(QUEUE_NAMES.FEED_GENERATION, {
  connection: redisConnection,
  defaultJobOptions,
});

/**
 * Schedule recurring jobs
 */
export async function scheduleRecurringJobs() {
  try {
    // Article Discovery - every 30 minutes
    await articleDiscoveryQueue.add(
      'discover-articles',
      { type: 'scheduled' },
      {
        repeat: {
          pattern: '*/30 * * * *', // Every 30 minutes
        },
        jobId: 'scheduled-discovery',
      }
    );
    logger.info('Scheduled article discovery job (every 30 minutes)');

    // Summarization - every 5 minutes
    await summarizationQueue.add(
      'summarize-pending',
      { type: 'scheduled', limit: 10 },
      {
        repeat: {
          pattern: '*/5 * * * *', // Every 5 minutes
        },
        jobId: 'scheduled-summarization',
      }
    );
    logger.info('Scheduled summarization job (every 5 minutes)');

    // Feed Generation - every 30 minutes (for active users)
    await feedGenerationQueue.add(
      'regenerate-feeds',
      { type: 'scheduled' },
      {
        repeat: {
          pattern: '*/30 * * * *', // Every 30 minutes
        },
        jobId: 'scheduled-feed-generation',
      }
    );
    logger.info('Scheduled feed generation job (every 30 minutes)');

  } catch (error) {
    logger.error('Error scheduling recurring jobs', { error: error.message });
    throw error;
  }
}

/**
 * Add a one-time article discovery job
 */
export function addDiscoveryJob(options = {}) {
  return articleDiscoveryQueue.add('discover-articles', {
    type: 'manual',
    ...options,
  });
}

/**
 * Add a summarization job for specific articles
 */
export function addSummarizationJob(articleIds = [], options = {}) {
  return summarizationQueue.add('summarize-articles', {
    type: 'manual',
    articleIds,
    ...options,
  });
}

/**
 * Add a feed generation job for a specific user
 */
export function addFeedGenerationJob(userId, options = {}) {
  return feedGenerationQueue.add('generate-feed', {
    type: 'manual',
    userId,
    ...options,
  });
}

/**
 * Get queue statistics
 */
export async function getQueueStats() {
  const [discoveryStats, summarizationStats, feedStats] = await Promise.all([
    getQueueJobCounts(articleDiscoveryQueue),
    getQueueJobCounts(summarizationQueue),
    getQueueJobCounts(feedGenerationQueue),
  ]);

  return {
    articleDiscovery: discoveryStats,
    summarization: summarizationStats,
    feedGeneration: feedStats,
  };
}

async function getQueueJobCounts(queue) {
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
  ]);

  return { waiting, active, completed, failed, delayed };
}

/**
 * Clean up old jobs
 */
export async function cleanupOldJobs() {
  const gracePeriod = 24 * 60 * 60 * 1000; // 24 hours

  await Promise.all([
    articleDiscoveryQueue.clean(gracePeriod, 1000, 'completed'),
    articleDiscoveryQueue.clean(gracePeriod, 1000, 'failed'),
    summarizationQueue.clean(gracePeriod, 1000, 'completed'),
    summarizationQueue.clean(gracePeriod, 1000, 'failed'),
    feedGenerationQueue.clean(gracePeriod, 1000, 'completed'),
    feedGenerationQueue.clean(gracePeriod, 1000, 'failed'),
  ]);

  logger.info('Cleaned up old jobs');
}

export default {
  QUEUE_NAMES,
  articleDiscoveryQueue,
  summarizationQueue,
  feedGenerationQueue,
  scheduleRecurringJobs,
  addDiscoveryJob,
  addSummarizationJob,
  addFeedGenerationJob,
  getQueueStats,
  cleanupOldJobs,
};
