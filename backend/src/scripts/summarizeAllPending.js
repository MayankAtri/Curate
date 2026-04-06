import dotenv from 'dotenv';
import mongoose from 'mongoose';
import SummarizationService from '../services/ai/SummarizationService.js';
import { logger } from '../utils/logger.js';

dotenv.config();

async function main() {
  const batchSize = Math.max(1, parseInt(process.env.SUMMARY_BATCH_SIZE || '25', 10));
  const delayMs = Math.max(0, parseInt(process.env.SUMMARY_DELAY_MS || '1200', 10));

  await mongoose.connect(process.env.MONGODB_URI);
  logger.info('Connected to MongoDB for bulk summarization', { batchSize, delayMs });

  const summarizer = new SummarizationService();
  const statsBefore = await summarizer.getStats();

  let totalSuccess = 0;
  let totalFailed = 0;
  let totalSkipped = 0;
  let batch = 0;

  while (true) {
    batch += 1;
    const result = await summarizer.summarizePendingArticles(batchSize, { delayMs });

    totalSuccess += result.success || 0;
    totalFailed += result.failed || 0;
    totalSkipped += result.skipped || 0;

    logger.info('Bulk summarization batch complete', {
      batch,
      total: result.total,
      success: result.success,
      failed: result.failed,
      skipped: result.skipped,
    });

    if (!result.total) {
      break;
    }
  }

  const statsAfter = await summarizer.getStats();

  console.log(
    JSON.stringify(
      {
        before: statsBefore,
        after: statsAfter,
        processed: {
          success: totalSuccess,
          failed: totalFailed,
          skipped: totalSkipped,
          batches: batch - 1,
        },
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    logger.error('Bulk summarization run failed', { error: error.message });
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await mongoose.connection.close();
  });
