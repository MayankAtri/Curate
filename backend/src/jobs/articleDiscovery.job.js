import ContentRouter from '../services/discovery/ContentRouter.js';
import { logger } from '../utils/logger.js';

/**
 * Article Discovery Job Processor
 * Fetches new articles from all configured content sources
 */

export async function processArticleDiscovery(job) {
  const startTime = Date.now();
  const { type, sourceTypes } = job.data;

  logger.info(`Starting article discovery job`, {
    jobId: job.id,
    type,
    sourceTypes,
  });

  try {
    const router = new ContentRouter();

    // Update job progress
    await job.updateProgress(10);

    // Fetch from all sources (ContentRouter exposes discoverFromAllSources)
    const results = await router.discoverFromAllSources();

    await job.updateProgress(90);

    const duration = Date.now() - startTime;

    logger.info(`Article discovery job completed`, {
      jobId: job.id,
      duration: `${duration}ms`,
      results: {
        totalNew: results.rss?.totalNew + results.reddit?.totalNew || 0,
        totalDuplicates: results.rss?.totalDuplicates + results.reddit?.totalDuplicates || 0,
      },
    });

    await job.updateProgress(100);

    return {
      success: true,
      duration,
      results: {
        rss: {
          new: results.rss?.totalNew || 0,
          duplicates: results.rss?.totalDuplicates || 0,
        },
        reddit: {
          new: results.reddit?.totalNew || 0,
          duplicates: results.reddit?.totalDuplicates || 0,
        },
      },
    };

  } catch (error) {
    logger.error(`Article discovery job failed`, {
      jobId: job.id,
      error: error.message,
    });
    throw error;
  }
}

export default processArticleDiscovery;
