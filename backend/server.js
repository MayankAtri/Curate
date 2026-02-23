import 'dotenv/config';
import app from './src/app.js';
import { connectDB } from './src/config/database.js';
import { createRedisClient } from './src/config/redis.js';
import { startLearningJob, stopLearningJob } from './src/jobs/learning.job.js';
import { logger } from './src/utils/logger.js';

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    // Connect to MongoDB
    await connectDB();

    // Connect to Redis
    const redis = createRedisClient();

    // Test Redis connection
    await redis.ping();
    logger.info('Redis connection verified');

    // Start Express server
    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`, {
        env: process.env.NODE_ENV || 'development',
        port: PORT,
      });
      logger.info(`Health check: http://localhost:${PORT}/health`);
      logger.info(`API root: http://localhost:${PORT}/api`);

      // Start background learning job
      startLearningJob();
    });

    // Graceful shutdown
    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);

  } catch (error) {
    logger.error('Failed to start server', { error: error.message });
    process.exit(1);
  }
}

async function gracefulShutdown(signal) {
  logger.info(`${signal} received. Shutting down gracefully...`);

  try {
    // Stop learning job
    stopLearningJob();

    // Close Redis connection
    const { closeRedis } = await import('./src/config/redis.js');
    await closeRedis();

    // Close MongoDB connection
    const { disconnectDB } = await import('./src/config/database.js');
    await disconnectDB();

    logger.info('Graceful shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', { error: error.message });
    process.exit(1);
  }
}

startServer();
