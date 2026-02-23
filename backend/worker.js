/**
 * Background Worker Process
 * Run with: node worker.js
 *
 * This can be run separately from the main server to process background jobs.
 * For development, workers are also started with the main server.
 */

import 'dotenv/config';
import { connectDB, disconnectDB } from './src/config/database.js';
import { createRedisClient, closeRedis } from './src/config/redis.js';
import { startWorkers, stopWorkers, scheduleRecurringJobs, getQueueStats } from './src/jobs/index.js';
import { logger } from './src/utils/logger.js';

async function startWorkerProcess() {
  logger.info('========================================');
  logger.info('CURATE - Background Worker Process');
  logger.info('========================================');

  try {
    // Connect to databases
    await connectDB();
    createRedisClient();

    // Start workers
    startWorkers();

    // Schedule recurring jobs
    await scheduleRecurringJobs();

    // Log initial stats
    const stats = await getQueueStats();
    logger.info('Queue statistics:', stats);

    logger.info('Worker process running. Press Ctrl+C to stop.');

  } catch (error) {
    logger.error('Failed to start worker process', { error: error.message });
    process.exit(1);
  }
}

// Graceful shutdown
async function shutdown() {
  logger.info('Shutting down worker process...');

  try {
    await stopWorkers();
    await closeRedis();
    await disconnectDB();
    logger.info('Worker process stopped gracefully');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', { error: error.message });
    process.exit(1);
  }
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error: error.message });
  shutdown();
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', { reason });
});

// Start
startWorkerProcess();
