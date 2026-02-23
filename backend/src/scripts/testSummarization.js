/**
 * Test script for Gemini AI summarization
 * Run with: node src/scripts/testSummarization.js
 */

import 'dotenv/config';
import { connectDB, disconnectDB } from '../config/database.js';
import SummarizationService from '../services/ai/SummarizationService.js';
import Article from '../models/Article.js';
import { SUMMARY_STATUS } from '../config/constants.js';

async function testBasicSummarization() {
  console.log('\n========================================');
  console.log('Testing Basic Summarization');
  console.log('========================================');

  const summarizer = new SummarizationService();

  // Test with sample text
  const sampleText = `
    OpenAI has announced the release of GPT-5, their most advanced language model to date.
    The new model demonstrates significant improvements in reasoning capabilities, particularly
    in multi-step problem solving and mathematical reasoning. According to OpenAI, GPT-5
    achieves human-level performance on several benchmark tests that previous models struggled with.

    The model is now available through the OpenAI API and will be rolling out to ChatGPT Plus
    subscribers over the coming weeks. Pricing remains competitive with GPT-4, though the company
    notes that inference costs have been reduced by approximately 30% due to architectural improvements.

    Industry analysts suggest this release could accelerate AI adoption in enterprise applications,
    particularly in areas requiring complex reasoning such as legal analysis, scientific research,
    and financial modeling.
  `;

  try {
    const result = await summarizer.generateSummary(sampleText, 'OpenAI Releases GPT-5');

    if (result.success) {
      console.log('✓ Summary generated successfully\n');
      console.log('Summary:', result.text);
      console.log('\nKey Points:');
      result.keyPoints.forEach((point, i) => {
        console.log(`  ${i + 1}. ${point}`);
      });
      return true;
    } else {
      console.log('✗ Summary generation failed:', result.error);
      return false;
    }
  } catch (error) {
    console.log('✗ Error:', error.message);
    return false;
  }
}

async function testArticleSummarization() {
  console.log('\n========================================');
  console.log('Testing Article Summarization');
  console.log('========================================');

  const summarizer = new SummarizationService();

  // Find an article without a summary
  const article = await Article.findOne({
    summaryStatus: SUMMARY_STATUS.PENDING,
    description: { $exists: true, $ne: '' },
  }).sort({ publishedAt: -1 });

  if (!article) {
    console.log('No pending articles found to summarize');
    return true;
  }

  console.log(`\nArticle: ${article.title?.substring(0, 60)}...`);
  console.log(`Source: ${article.source?.name}`);
  console.log(`URL: ${article.url?.substring(0, 60)}...`);

  try {
    const updatedArticle = await summarizer.summarizeArticle(article, {
      extractContent: true,
    });

    if (updatedArticle.summaryStatus === SUMMARY_STATUS.COMPLETED) {
      console.log('\n✓ Article summarized successfully\n');
      console.log('Summary:', updatedArticle.summary?.text);
      console.log('\nKey Points:');
      updatedArticle.summary?.keyPoints?.forEach((point, i) => {
        console.log(`  ${i + 1}. ${point}`);
      });
      return true;
    } else {
      console.log('✗ Article summarization failed');
      return false;
    }
  } catch (error) {
    console.log('✗ Error:', error.message);
    return false;
  }
}

async function testBatchSummarization() {
  console.log('\n========================================');
  console.log('Testing Batch Summarization (3 articles)');
  console.log('========================================');

  const summarizer = new SummarizationService();

  try {
    const results = await summarizer.summarizePendingArticles(3, {
      delayMs: 1500, // Slightly longer delay to avoid rate limits
    });

    console.log('\n✓ Batch summarization complete');
    console.log(`  Total: ${results.total}`);
    console.log(`  Success: ${results.success}`);
    console.log(`  Failed: ${results.failed}`);
    console.log(`  Skipped: ${results.skipped}`);

    if (results.errors.length > 0) {
      console.log('  Errors:', results.errors);
    }

    return results.failed === 0;
  } catch (error) {
    console.log('✗ Batch summarization error:', error.message);
    return false;
  }
}

async function showStats() {
  console.log('\n========================================');
  console.log('Summarization Statistics');
  console.log('========================================');

  const summarizer = new SummarizationService();
  const stats = await summarizer.getStats();

  console.log(`  Total articles: ${stats.total}`);
  console.log(`  Completed: ${stats.completed}`);
  console.log(`  Pending: ${stats.pending}`);
  console.log(`  Failed: ${stats.failed}`);
  console.log(`  Completion rate: ${stats.completionRate}`);
}

async function main() {
  console.log('========================================');
  console.log('CURATE - Gemini AI Summarization Test');
  console.log('========================================');
  console.log(`Model: ${process.env.GEMINI_MODEL || 'gemini-2.0-flash'}`);

  await connectDB();

  const results = {
    basic: false,
    article: false,
    batch: false,
  };

  // Run tests
  results.basic = await testBasicSummarization();

  if (results.basic) {
    results.article = await testArticleSummarization();
  }

  if (results.article) {
    results.batch = await testBatchSummarization();
  }

  // Show stats
  await showStats();

  // Summary
  console.log('\n========================================');
  console.log('TEST RESULTS');
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
