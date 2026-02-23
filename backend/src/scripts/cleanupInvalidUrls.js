/**
 * Cleanup script to remove articles with invalid/dead URLs
 * Run with: node src/scripts/cleanupInvalidUrls.js
 */

import 'dotenv/config';
import { connectDB, disconnectDB } from '../config/database.js';
import Article from '../models/Article.js';
import { validateUrl } from '../utils/urlValidator.js';

async function cleanupInvalidUrls() {
  console.log('========================================');
  console.log('CURATE - Invalid URL Cleanup');
  console.log('========================================\n');

  await connectDB();

  const stats = {
    total: 0,
    valid: 0,
    invalid: 0,
    deleted: 0,
  };

  try {
    // Get all articles
    const articles = await Article.find({}).select('_id url title').lean();
    stats.total = articles.length;

    console.log(`Found ${stats.total} articles to check\n`);

    const invalidArticles = [];

    // Check each URL (in batches for performance)
    const batchSize = 10;
    for (let i = 0; i < articles.length; i += batchSize) {
      const batch = articles.slice(i, i + batchSize);

      const results = await Promise.all(
        batch.map(async (article) => {
          const validation = await validateUrl(article.url);
          return { article, validation };
        })
      );

      for (const { article, validation } of results) {
        if (validation.valid) {
          stats.valid++;
        } else {
          stats.invalid++;
          invalidArticles.push({
            id: article._id,
            url: article.url,
            title: article.title?.substring(0, 50),
            reason: validation.error,
          });
        }
      }

      // Progress
      const progress = Math.min(i + batchSize, stats.total);
      process.stdout.write(`\rProgress: ${progress}/${stats.total} (${invalidArticles.length} invalid)`);
    }

    console.log('\n');

    if (invalidArticles.length > 0) {
      console.log(`\nFound ${invalidArticles.length} invalid URLs:\n`);

      // Show sample of invalid URLs
      const sample = invalidArticles.slice(0, 10);
      for (const item of sample) {
        console.log(`  - ${item.title}...`);
        console.log(`    URL: ${item.url.substring(0, 60)}...`);
        console.log(`    Reason: ${item.reason}\n`);
      }

      if (invalidArticles.length > 10) {
        console.log(`  ... and ${invalidArticles.length - 10} more\n`);
      }

      // Delete invalid articles
      const idsToDelete = invalidArticles.map((item) => item.id);
      const deleteResult = await Article.deleteMany({ _id: { $in: idsToDelete } });
      stats.deleted = deleteResult.deletedCount;

      console.log(`Deleted ${stats.deleted} articles with invalid URLs`);
    } else {
      console.log('No invalid URLs found!');
    }

    console.log('\n========================================');
    console.log('SUMMARY');
    console.log('========================================');
    console.log(`  Total checked: ${stats.total}`);
    console.log(`  Valid: ${stats.valid}`);
    console.log(`  Invalid: ${stats.invalid}`);
    console.log(`  Deleted: ${stats.deleted}`);
    console.log('========================================\n');

  } catch (error) {
    console.error('Error:', error.message);
  }

  await disconnectDB();
}

cleanupInvalidUrls().catch(console.error);
