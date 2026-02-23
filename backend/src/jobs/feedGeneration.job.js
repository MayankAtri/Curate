import FeedGenerator from '../services/feed/FeedGenerator.js';
import User from '../models/User.js';
import { logger } from '../utils/logger.js';

/**
 * Feed Generation Job Processor
 * Regenerates personalized feeds for users
 */

export async function processFeedGeneration(job) {
  const startTime = Date.now();
  const { type, userId } = job.data;

  logger.info(`Starting feed generation job`, {
    jobId: job.id,
    type,
    userId,
  });

  try {
    const feedGenerator = new FeedGenerator();

    await job.updateProgress(10);

    let results;

    if (userId) {
      // Generate feed for specific user
      const feed = await feedGenerator.generateFeedForUser(userId);
      results = {
        usersProcessed: 1,
        feeds: [{ userId, itemCount: feed.items?.length || 0 }],
      };
    } else {
      // Generate feeds for all active users
      // Get users who have been active in the last 24 hours
      const activeUsers = await User.find({
        lastActiveAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      }).select('_id');

      results = {
        usersProcessed: 0,
        feeds: [],
      };

      const totalUsers = activeUsers.length;

      for (let i = 0; i < activeUsers.length; i++) {
        const user = activeUsers[i];
        try {
          const feed = await feedGenerator.generateFeedForUser(user._id);
          results.feeds.push({
            userId: user._id.toString(),
            itemCount: feed.items?.length || 0,
          });
          results.usersProcessed++;
        } catch (error) {
          logger.warn(`Failed to generate feed for user ${user._id}`, {
            error: error.message,
          });
        }

        // Update progress
        const progress = Math.round(10 + (i / totalUsers) * 80);
        await job.updateProgress(progress);
      }
    }

    await job.updateProgress(90);

    const duration = Date.now() - startTime;

    logger.info(`Feed generation job completed`, {
      jobId: job.id,
      duration: `${duration}ms`,
      usersProcessed: results.usersProcessed,
    });

    await job.updateProgress(100);

    return {
      success: true,
      duration,
      results,
    };

  } catch (error) {
    logger.error(`Feed generation job failed`, {
      jobId: job.id,
      error: error.message,
    });
    throw error;
  }
}

export default processFeedGeneration;
