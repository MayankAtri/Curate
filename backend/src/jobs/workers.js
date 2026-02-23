import { Worker } from 'bullmq';
import { redisConnection } from '../config/redis.js';
import { QUEUE_NAMES } from './queues.js';
import { processArticleDiscovery } from './articleDiscovery.job.js';
import { processSummarization } from './summarization.job.js';
import { processFeedGeneration } from './feedGeneration.job.js';
import { logger } from '../utils/logger.js';

/**
 * Worker definitions for processing background jobs
 */

const workers = [];

/**
 * Create and start all workers
 */
export function startWorkers() {
  logger.info('Starting background job workers...');

  // Article Discovery Worker
  const discoveryWorker = new Worker(
    QUEUE_NAMES.ARTICLE_DISCOVERY,
    processArticleDiscovery,
    {
      connection: redisConnection,
      concurrency: 1, // Only one discovery job at a time
    }
  );

  discoveryWorker.on('completed', (job, result) => {
    logger.info(`Discovery job ${job.id} completed`, {
      newArticles: result?.results?.rss?.new + result?.results?.reddit?.new || 0,
    });
  });

  discoveryWorker.on('failed', (job, error) => {
    logger.error(`Discovery job ${job?.id} failed`, { error: error.message });
  });

  workers.push(discoveryWorker);
  logger.info('Article discovery worker started');

  // Summarization Worker
  const summarizationWorker = new Worker(
    QUEUE_NAMES.SUMMARIZATION,
    processSummarization,
    {
      connection: redisConnection,
      concurrency: 1, // One at a time due to API rate limits
    }
  );

  summarizationWorker.on('completed', (job, result) => {
    logger.info(`Summarization job ${job.id} completed`, {
      success: result?.results?.success || 0,
      failed: result?.results?.failed || 0,
    });
  });

  summarizationWorker.on('failed', (job, error) => {
    logger.error(`Summarization job ${job?.id} failed`, { error: error.message });
  });

  workers.push(summarizationWorker);
  logger.info('Summarization worker started');

  // Feed Generation Worker
  const feedWorker = new Worker(
    QUEUE_NAMES.FEED_GENERATION,
    processFeedGeneration,
    {
      connection: redisConnection,
      concurrency: 2, // Can process multiple users in parallel
    }
  );

  feedWorker.on('completed', (job, result) => {
    logger.info(`Feed generation job ${job.id} completed`, {
      usersProcessed: result?.results?.usersProcessed || 0,
    });
  });

  feedWorker.on('failed', (job, error) => {
    logger.error(`Feed generation job ${job?.id} failed`, { error: error.message });
  });

  workers.push(feedWorker);
  logger.info('Feed generation worker started');

  logger.info(`All ${workers.length} workers started successfully`);

  return workers;
}

/**
 * Stop all workers gracefully
 */
export async function stopWorkers() {
  logger.info('Stopping background job workers...');

  await Promise.all(
    workers.map(async (worker) => {
      await worker.close();
    })
  );

  workers.length = 0;
  logger.info('All workers stopped');
}

/**
 * Get worker status
 */
export function getWorkerStatus() {
  return workers.map((worker) => ({
    name: worker.name,
    running: worker.isRunning(),
    paused: worker.isPaused(),
  }));
}

export default {
  startWorkers,
  stopWorkers,
  getWorkerStatus,
};
