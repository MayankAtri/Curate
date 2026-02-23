/**
 * Script to enrich articles with og:image
 * Run with: node src/scripts/enrichImages.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Article from '../models/Article.js';
import { extractOgImage } from '../utils/imageExtractor.js';
import { logger } from '../utils/logger.js';

dotenv.config();

const BATCH_SIZE = 10;
const DELAY_MS = 500; // Delay between articles to avoid rate limiting

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function enrichImages() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/curate');
    logger.info('Connected to MongoDB');

    // Find articles without images
    const articlesWithoutImages = await Article.find({
      $or: [
        { imageUrl: null },
        { imageUrl: '' },
        { imageUrl: { $exists: false } }
      ]
    }).limit(200).sort({ publishedAt: -1 });

    logger.info(`Found ${articlesWithoutImages.length} articles without images`);

    let enriched = 0;
    let failed = 0;

    for (const article of articlesWithoutImages) {
      try {
        const imageUrl = await extractOgImage(article.url);

        if (imageUrl) {
          await Article.updateOne(
            { _id: article._id },
            { $set: { imageUrl } }
          );
          enriched++;
          logger.info(`Enriched: ${article.title.substring(0, 50)}...`);
        } else {
          failed++;
          logger.debug(`No image found for: ${article.url}`);
        }

        await sleep(DELAY_MS);
      } catch (error) {
        failed++;
        logger.error(`Error enriching ${article.url}`, { error: error.message });
      }
    }

    logger.info('Image enrichment complete', { enriched, failed, total: articlesWithoutImages.length });

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    logger.error('Enrichment failed', { error: error.message });
    console.error(error);
    process.exit(1);
  }
}

enrichImages();
