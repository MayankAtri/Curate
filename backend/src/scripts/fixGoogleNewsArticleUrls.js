import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Article from '../models/Article.js';
import GoogleNewsFetcher from '../services/discovery/GoogleNewsFetcher.js';
import { logger } from '../utils/logger.js';

dotenv.config();

function isLikelyCorruptedGoogleUrl(url) {
  const match = url.match(/\/rss\/articles\/([^?]+)/);
  if (!match) return false;
  const token = match[1];
  // Valid Google token usually contains uppercase chars.
  // Fully-lowercase tokens are commonly produced by accidental URL lowercasing.
  return !/[A-Z]/.test(token) && /[a-z]/.test(token);
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  logger.info('Connected to MongoDB');

  const fetcher = new GoogleNewsFetcher({ timeout: 10000, delayMs: 0 });
  const limit = Math.max(1, parseInt(process.env.FIX_GOOGLE_URL_LIMIT || '1000', 10));

  const googleArticles = await Article.find({
    url: /news\.google\.com\/rss\/articles\//,
  }).select('_id url title').limit(limit).lean();

  logger.info('Found Google News article URLs to check', {
    total: googleArticles.length,
    limit,
  });

  let updated = 0;
  let deleted = 0;
  let skipped = 0;
  let failed = 0;

  for (const article of googleArticles) {
    try {
      // Fast decode path only (no network redirect resolution).
      const resolved = fetcher.decodeGoogleNewsUrl(article.url);

      if (resolved && !resolved.includes('news.google.com')) {
        const duplicate = await Article.findOne({
          url: resolved,
          _id: { $ne: article._id },
        }).select('_id').lean();

        if (duplicate) {
          await Article.deleteOne({ _id: article._id });
          deleted++;
          continue;
        }

        await Article.updateOne(
          { _id: article._id },
          { $set: { url: resolved } }
        );
        updated++;
        continue;
      }

      if (isLikelyCorruptedGoogleUrl(article.url)) {
        await Article.deleteOne({ _id: article._id });
        deleted++;
      } else {
        skipped++;
      }
    } catch (error) {
      failed++;
      logger.warn('Failed to process Google News URL', {
        articleId: article._id.toString(),
        error: error.message,
      });
    }
  }

  logger.info('Google News URL repair complete', {
    total: googleArticles.length,
    updated,
    deleted,
    skipped,
    failed,
  });

  await mongoose.disconnect();
}

main().catch((error) => {
  logger.error('Google News URL repair failed', { error: error.message });
  process.exit(1);
});
