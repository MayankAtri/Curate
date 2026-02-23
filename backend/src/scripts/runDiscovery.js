/**
 * Script to manually run article discovery
 * Run with: node src/scripts/runDiscovery.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import ContentRouter from '../services/discovery/ContentRouter.js';
import { logger } from '../utils/logger.js';

dotenv.config();

async function runDiscovery() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/curate');
    logger.info('Connected to MongoDB');

    const contentRouter = new ContentRouter();

    // First seed the new sources
    logger.info('Seeding content sources...');
    await contentRouter.seedContentSources();

    // Then fetch articles from all sources
    logger.info('Fetching articles from all sources...');
    const results = await contentRouter.discoverFromAllSources();

    logger.info('Discovery complete', results);

    // Close connection
    await mongoose.connection.close();
    logger.info('MongoDB connection closed');

    process.exit(0);
  } catch (error) {
    logger.error('Discovery failed', { error: error.message });
    console.error(error);
    process.exit(1);
  }
}

runDiscovery();
