/**
 * Test script for content fetchers
 * Run with: node src/scripts/testFetchers.js
 */

import 'dotenv/config';
import { connectDB, disconnectDB } from '../config/database.js';
import RSSFetcher from '../services/discovery/RSSFetcher.js';
import RedditFetcher from '../services/discovery/RedditFetcher.js';
import GoogleNewsFetcher from '../services/discovery/GoogleNewsFetcher.js';
import ContentRouter from '../services/discovery/ContentRouter.js';
import ArticleExtractor from '../services/content/ArticleExtractor.js';
import Article from '../models/Article.js';

async function testRSSFetcher() {
  console.log('\n========================================');
  console.log('Testing RSS Fetcher');
  console.log('========================================');

  const fetcher = new RSSFetcher();

  try {
    // Test fetching a feed
    const feed = await fetcher.fetchFeed('https://techcrunch.com/feed/');
    console.log(`✓ Fetched feed: ${feed.title}`);
    console.log(`  Items: ${feed.items.length}`);

    if (feed.items.length > 0) {
      const sample = feed.items[0];
      console.log(`  Sample: "${sample.title?.substring(0, 50)}..."`);
    }

    return true;
  } catch (error) {
    console.log(`✗ RSS Fetcher failed: ${error.message}`);
    return false;
  }
}

async function testRedditFetcher() {
  console.log('\n========================================');
  console.log('Testing Reddit Fetcher');
  console.log('========================================');

  const fetcher = new RedditFetcher();

  try {
    // Test fetching a subreddit
    const posts = await fetcher.fetchSubreddit('technology', {
      timeFilter: 'day',
      limit: 10,
    });

    console.log(`✓ Fetched r/technology`);
    console.log(`  Posts: ${posts.length}`);

    // Count external links
    const externalLinks = posts.filter(p => fetcher.isExternalLink(p));
    console.log(`  External links: ${externalLinks.length}`);

    if (externalLinks.length > 0) {
      const sample = externalLinks[0];
      console.log(`  Sample: "${sample.title?.substring(0, 50)}..."`);
      console.log(`  URL: ${sample.url?.substring(0, 60)}...`);
      console.log(`  Score: ${sample.score}`);
    }

    return true;
  } catch (error) {
    console.log(`✗ Reddit Fetcher failed: ${error.message}`);
    return false;
  }
}

async function testGoogleNewsFetcher() {
  console.log('\n========================================');
  console.log('Testing Google News Fetcher');
  console.log('========================================');

  const fetcher = new GoogleNewsFetcher();

  try {
    // Test searching for news
    const result = await fetcher.searchNews('artificial intelligence', {
      when: '1d',
    });

    console.log(`✓ Searched Google News: "artificial intelligence"`);
    console.log(`  Results: ${result.items.length}`);

    if (result.items.length > 0) {
      const sample = result.items[0];
      console.log(`  Sample: "${sample.title?.substring(0, 60)}..."`);
    }

    return true;
  } catch (error) {
    console.log(`✗ Google News Fetcher failed: ${error.message}`);
    return false;
  }
}

async function testArticleExtractor() {
  console.log('\n========================================');
  console.log('Testing Article Extractor');
  console.log('========================================');

  const extractor = new ArticleExtractor();

  try {
    // Test extracting content from a known article
    const testUrl = 'https://www.bbc.com/news';
    const result = await extractor.extract(testUrl);

    if (result.success) {
      console.log(`✓ Extracted content from ${testUrl}`);
      console.log(`  Word count: ${result.wordCount}`);
      console.log(`  Reading time: ${result.readingTimeMinutes} min`);
      if (result.title) {
        console.log(`  Title: ${result.title.substring(0, 50)}...`);
      }
    } else {
      console.log(`✗ Extraction failed: ${result.error}`);
    }

    return result.success;
  } catch (error) {
    console.log(`✗ Article Extractor failed: ${error.message}`);
    return false;
  }
}

async function testContentRouter() {
  console.log('\n========================================');
  console.log('Testing Content Router');
  console.log('========================================');

  const router = new ContentRouter();

  try {
    // First seed content sources
    console.log('Seeding content sources...');
    const seeded = await router.seedContentSources();
    console.log(`✓ Seeded ${seeded} content sources`);

    // Get summary
    const summary = await router.getSourcesSummary();
    console.log(`  Total sources: ${summary.total}`);
    console.log(`  Active: ${summary.active}`);
    console.log(`  By type:`, summary.byType);

    return true;
  } catch (error) {
    console.log(`✗ Content Router failed: ${error.message}`);
    return false;
  }
}

async function testFullDiscovery() {
  console.log('\n========================================');
  console.log('Testing Full Discovery (RSS only for speed)');
  console.log('========================================');

  const rssFetcher = new RSSFetcher();

  try {
    // Fetch from just one RSS source to test the full flow
    const result = await rssFetcher.fetchFromAllSources();

    console.log(`✓ Discovery complete`);
    console.log(`  Sources checked: ${result.totalSources}`);
    console.log(`  Articles fetched: ${result.totalFetched}`);
    console.log(`  New articles: ${result.totalNew}`);
    console.log(`  Duplicates: ${result.totalDuplicates}`);

    // Check database
    const articleCount = await Article.countDocuments();
    console.log(`  Total articles in DB: ${articleCount}`);

    return true;
  } catch (error) {
    console.log(`✗ Full Discovery failed: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('========================================');
  console.log('CURATE - Content Fetchers Test Suite');
  console.log('========================================');

  await connectDB();

  const results = {
    rss: false,
    reddit: false,
    googleNews: false,
    articleExtractor: false,
    contentRouter: false,
    fullDiscovery: false,
  };

  // Run tests
  results.rss = await testRSSFetcher();
  results.reddit = await testRedditFetcher();
  results.googleNews = await testGoogleNewsFetcher();
  results.articleExtractor = await testArticleExtractor();
  results.contentRouter = await testContentRouter();
  results.fullDiscovery = await testFullDiscovery();

  // Summary
  console.log('\n========================================');
  console.log('TEST RESULTS SUMMARY');
  console.log('========================================');

  const passed = Object.values(results).filter(r => r).length;
  const total = Object.keys(results).length;

  for (const [test, passed] of Object.entries(results)) {
    console.log(`  ${passed ? '✓' : '✗'} ${test}`);
  }

  console.log(`\n  ${passed}/${total} tests passed`);
  console.log('========================================\n');

  await disconnectDB();
}

main().catch(console.error);
