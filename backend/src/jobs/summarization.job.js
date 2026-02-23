import SummarizationService from '../services/ai/SummarizationService.js';
import { logger } from '../utils/logger.js';

/**
 * Summarization Job Processor
 * Generates AI summaries for pending articles
 */

export async function processSummarization(job) {
  const startTime = Date.now();
  const { type, articleIds, limit = 10 } = job.data;

  logger.info(`Starting summarization job`, {
    jobId: job.id,
    type,
    articleCount: articleIds?.length || limit,
  });

  try {
    const summarizer = new SummarizationService();

    await job.updateProgress(10);

    let results;

    if (articleIds && articleIds.length > 0) {
      // Summarize specific articles
      results = await summarizer.summarizeBatch(articleIds, {
        delayMs: 1500, // Rate limiting
      });
    } else {
      // Summarize pending articles
      results = await summarizer.summarizePendingArticles(limit, {
        delayMs: 1500,
      });
    }

    await job.updateProgress(90);

    const duration = Date.now() - startTime;

    logger.info(`Summarization job completed`, {
      jobId: job.id,
      duration: `${duration}ms`,
      results: {
        total: results.total,
        success: results.success,
        failed: results.failed,
        skipped: results.skipped,
      },
    });

    await job.updateProgress(100);

    return {
      success: true,
      duration,
      results: {
        total: results.total,
        success: results.success,
        failed: results.failed,
        skipped: results.skipped,
        errors: results.errors?.slice(0, 5), // Only keep first 5 errors
      },
    };

  } catch (error) {
    logger.error(`Summarization job failed`, {
      jobId: job.id,
      error: error.message,
    });
    throw error;
  }
}

export default processSummarization;
