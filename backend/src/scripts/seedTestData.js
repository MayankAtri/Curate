/**
 * Seed script to create test data for the feed engine
 * Run with: node src/scripts/seedTestData.js
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../config/database.js';
import User from '../models/User.js';
import Article from '../models/Article.js';
import UserPreference from '../models/UserPreference.js';
import ContentSource from '../models/ContentSource.js';
import {
  SOURCE_TYPE,
  SOURCE_QUALITY,
  SUMMARY_STATUS,
  PREFERENCE_TYPE,
  PREFERENCE_SOURCE,
} from '../config/constants.js';

// Sample articles for testing
const SAMPLE_ARTICLES = [
  {
    url: 'https://techcrunch.com/2024/01/15/openai-gpt5-release',
    title: 'OpenAI Announces GPT-5 with Breakthrough Reasoning Capabilities',
    description: 'OpenAI has unveiled GPT-5, featuring significant improvements in reasoning and multi-step problem solving.',
    imageUrl: 'https://techcrunch.com/wp-content/uploads/2024/01/openai-gpt5.jpg',
    author: 'Kyle Wiggers',
    source: {
      name: 'TechCrunch',
      type: SOURCE_TYPE.RSS,
      url: 'https://techcrunch.com/feed/',
      quality: SOURCE_QUALITY.TIER_1,
    },
    publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    topics: [
      { name: 'artificial intelligence', confidence: 0.95 },
      { name: 'openai', confidence: 0.9 },
      { name: 'technology', confidence: 0.8 },
    ],
    summary: {
      text: 'OpenAI has released GPT-5, their most advanced language model yet. The new model shows significant improvements in reasoning and can solve complex multi-step problems.',
      keyPoints: [
        'GPT-5 features breakthrough reasoning capabilities',
        'Significant improvements in multi-step problem solving',
        'Available through API and ChatGPT Plus',
      ],
      generatedAt: new Date(),
    },
    summaryStatus: SUMMARY_STATUS.COMPLETED,
  },
  {
    url: 'https://www.theverge.com/2024/01/15/apple-vision-pro-launch',
    title: 'Apple Vision Pro Ships to First Customers This Week',
    description: 'Apple\'s spatial computing device is finally reaching customers after months of anticipation.',
    imageUrl: 'https://www.theverge.com/images/vision-pro-shipping.jpg',
    author: 'Nilay Patel',
    source: {
      name: 'The Verge',
      type: SOURCE_TYPE.RSS,
      url: 'https://www.theverge.com/rss/index.xml',
      quality: SOURCE_QUALITY.TIER_1,
    },
    publishedAt: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 hours ago
    topics: [
      { name: 'apple', confidence: 0.95 },
      { name: 'technology', confidence: 0.85 },
      { name: 'gadgets', confidence: 0.8 },
    ],
    summary: {
      text: 'Apple Vision Pro begins shipping to customers this week. The $3,499 spatial computing device represents Apple\'s biggest product launch since the Apple Watch.',
      keyPoints: [
        'Vision Pro starts shipping to customers',
        'Priced at $3,499',
        'Biggest Apple launch since Apple Watch',
      ],
      generatedAt: new Date(),
    },
    summaryStatus: SUMMARY_STATUS.COMPLETED,
  },
  {
    url: 'https://reddit.com/r/MachineLearning/comments/abc123',
    title: 'New paper: Efficient Fine-tuning Methods for Large Language Models',
    description: 'Researchers propose a new method that reduces fine-tuning costs by 90%.',
    source: {
      name: 'r/MachineLearning',
      type: SOURCE_TYPE.REDDIT,
      url: 'https://reddit.com/r/MachineLearning',
      quality: SOURCE_QUALITY.TIER_2,
    },
    publishedAt: new Date(Date.now() - 8 * 60 * 60 * 1000), // 8 hours ago
    topics: [
      { name: 'machine learning', confidence: 0.95 },
      { name: 'artificial intelligence', confidence: 0.85 },
      { name: 'research', confidence: 0.8 },
    ],
    engagement: {
      upvotes: 1523,
      comments: 234,
      score: 1523,
    },
    summary: {
      text: 'A new research paper proposes efficient fine-tuning methods for LLMs that reduce computational costs by 90% while maintaining performance.',
      keyPoints: [
        '90% reduction in fine-tuning costs',
        'Maintains model performance',
        'Works with various LLM architectures',
      ],
      generatedAt: new Date(),
    },
    summaryStatus: SUMMARY_STATUS.COMPLETED,
  },
  {
    url: 'https://arstechnica.com/2024/01/quantum-computing-breakthrough',
    title: 'Google Achieves New Quantum Computing Milestone',
    description: 'Google\'s quantum computer solves problems previously thought impossible.',
    imageUrl: 'https://arstechnica.com/quantum-computer.jpg',
    author: 'John Timmer',
    source: {
      name: 'Ars Technica',
      type: SOURCE_TYPE.RSS,
      url: 'https://feeds.arstechnica.com/arstechnica/technology-lab',
      quality: SOURCE_QUALITY.TIER_1,
    },
    publishedAt: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 hours ago
    topics: [
      { name: 'quantum computing', confidence: 0.95 },
      { name: 'google', confidence: 0.85 },
      { name: 'science', confidence: 0.8 },
      { name: 'technology', confidence: 0.75 },
    ],
    summary: {
      text: 'Google has announced a major breakthrough in quantum computing. Their latest quantum processor can solve certain problems exponentially faster than classical computers.',
      keyPoints: [
        'Major quantum computing breakthrough',
        'Exponential speedup for certain problems',
        'Advances towards practical quantum applications',
      ],
      generatedAt: new Date(),
    },
    summaryStatus: SUMMARY_STATUS.COMPLETED,
  },
  {
    url: 'https://wired.com/2024/01/startup-funding-trends',
    title: 'AI Startups Dominate Q4 Funding as Tech Investment Rebounds',
    description: 'Venture capital flows heavily into AI companies as the tech funding winter thaws.',
    imageUrl: 'https://wired.com/ai-funding.jpg',
    author: 'Lauren Goode',
    source: {
      name: 'Wired',
      type: SOURCE_TYPE.RSS,
      url: 'https://www.wired.com/feed/rss',
      quality: SOURCE_QUALITY.TIER_1,
    },
    publishedAt: new Date(Date.now() - 18 * 60 * 60 * 1000), // 18 hours ago
    topics: [
      { name: 'startups', confidence: 0.9 },
      { name: 'artificial intelligence', confidence: 0.85 },
      { name: 'business', confidence: 0.8 },
      { name: 'technology', confidence: 0.75 },
    ],
    summary: {
      text: 'AI startups captured the majority of venture funding in Q4, signaling a rebound in tech investment. The trend shows investors betting big on artificial intelligence.',
      keyPoints: [
        'AI startups dominate Q4 funding',
        'Tech investment showing recovery',
        'Strong investor confidence in AI sector',
      ],
      generatedAt: new Date(),
    },
    summaryStatus: SUMMARY_STATUS.COMPLETED,
  },
  {
    url: 'https://mit.edu/2024/01/climate-ai-research',
    title: 'MIT Researchers Use AI to Predict Climate Patterns with 95% Accuracy',
    description: 'New AI model outperforms traditional climate models in weather prediction.',
    imageUrl: 'https://mit.edu/climate-ai.jpg',
    author: 'MIT News',
    source: {
      name: 'MIT Technology Review',
      type: SOURCE_TYPE.RSS,
      url: 'https://www.technologyreview.com/feed/',
      quality: SOURCE_QUALITY.TIER_1,
    },
    publishedAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
    topics: [
      { name: 'artificial intelligence', confidence: 0.9 },
      { name: 'climate', confidence: 0.9 },
      { name: 'science', confidence: 0.85 },
      { name: 'research', confidence: 0.8 },
    ],
    summary: {
      text: 'MIT researchers have developed an AI model that predicts climate patterns with 95% accuracy. The breakthrough could significantly improve long-term weather forecasting.',
      keyPoints: [
        '95% accuracy in climate prediction',
        'Outperforms traditional models',
        'Implications for weather forecasting',
      ],
      generatedAt: new Date(),
    },
    summaryStatus: SUMMARY_STATUS.COMPLETED,
  },
  {
    url: 'https://techcrunch.com/2024/01/14/cybersecurity-trends',
    title: 'Cybersecurity Threats Rise as AI-Powered Attacks Become More Sophisticated',
    description: 'Security experts warn of new AI-driven attack vectors targeting businesses.',
    author: 'Zack Whittaker',
    source: {
      name: 'TechCrunch',
      type: SOURCE_TYPE.RSS,
      url: 'https://techcrunch.com/feed/',
      quality: SOURCE_QUALITY.TIER_1,
    },
    publishedAt: new Date(Date.now() - 30 * 60 * 60 * 1000), // 30 hours ago
    topics: [
      { name: 'cybersecurity', confidence: 0.95 },
      { name: 'artificial intelligence', confidence: 0.8 },
      { name: 'technology', confidence: 0.75 },
    ],
    summary: {
      text: 'Cybersecurity threats are evolving rapidly with AI-powered attacks becoming more sophisticated. Experts recommend businesses update their security strategies.',
      keyPoints: [
        'AI-powered attacks on the rise',
        'New attack vectors targeting businesses',
        'Need for updated security strategies',
      ],
      generatedAt: new Date(),
    },
    summaryStatus: SUMMARY_STATUS.COMPLETED,
  },
  {
    url: 'https://reddit.com/r/technology/comments/xyz789',
    title: 'Tesla unveils next-generation self-driving chip',
    description: 'Tesla announces custom AI chip designed specifically for autonomous driving.',
    source: {
      name: 'r/technology',
      type: SOURCE_TYPE.REDDIT,
      url: 'https://reddit.com/r/technology',
      quality: SOURCE_QUALITY.TIER_2,
    },
    publishedAt: new Date(Date.now() - 36 * 60 * 60 * 1000), // 36 hours ago
    topics: [
      { name: 'tesla', confidence: 0.95 },
      { name: 'autonomous vehicles', confidence: 0.9 },
      { name: 'artificial intelligence', confidence: 0.85 },
      { name: 'technology', confidence: 0.8 },
    ],
    engagement: {
      upvotes: 892,
      comments: 156,
      score: 892,
    },
    summary: {
      text: 'Tesla has unveiled their next-generation self-driving chip. The custom AI hardware is designed to significantly improve autonomous driving capabilities.',
      keyPoints: [
        'Custom AI chip for self-driving',
        'Significant performance improvements',
        'Part of Tesla\'s FSD development',
      ],
      generatedAt: new Date(),
    },
    summaryStatus: SUMMARY_STATUS.COMPLETED,
  },
];

// Sample content sources
const CONTENT_SOURCES = [
  {
    type: SOURCE_TYPE.RSS,
    name: 'TechCrunch',
    identifier: 'https://techcrunch.com/feed/',
    category: 'technology',
    topics: ['tech', 'startups', 'AI'],
    quality: SOURCE_QUALITY.TIER_1,
  },
  {
    type: SOURCE_TYPE.RSS,
    name: 'The Verge',
    identifier: 'https://www.theverge.com/rss/index.xml',
    category: 'technology',
    topics: ['tech', 'gadgets', 'reviews'],
    quality: SOURCE_QUALITY.TIER_1,
  },
  {
    type: SOURCE_TYPE.RSS,
    name: 'Ars Technica',
    identifier: 'https://feeds.arstechnica.com/arstechnica/technology-lab',
    category: 'technology',
    topics: ['tech', 'science', 'policy'],
    quality: SOURCE_QUALITY.TIER_1,
  },
  {
    type: SOURCE_TYPE.REDDIT,
    name: 'r/MachineLearning',
    identifier: 'MachineLearning',
    category: 'ai',
    topics: ['AI', 'ML', 'research'],
    quality: SOURCE_QUALITY.TIER_2,
  },
  {
    type: SOURCE_TYPE.REDDIT,
    name: 'r/technology',
    identifier: 'technology',
    category: 'technology',
    topics: ['tech', 'news'],
    quality: SOURCE_QUALITY.TIER_2,
  },
];

async function seedTestData() {
  try {
    await connectDB();
    console.log('Connected to MongoDB');

    // 1. Create test user
    console.log('\n--- Creating test user ---');
    const user = await User.findOneAndUpdate(
      { email: 'test@example.com' },
      {
        email: 'test@example.com',
        username: 'Test User',
        passwordHash: 'placeholder_hash_for_testing',
        settings: {
          articlesPerPage: 20,
          theme: 'light',
          emailDigest: false,
        },
        onboardingCompleted: true,
        lastActiveAt: new Date(),
      },
      { upsert: true, new: true }
    );
    console.log(`Created user: ${user._id} (${user.email})`);

    // 2. Create user preferences
    console.log('\n--- Creating user preferences ---');
    const preferences = [
      { type: PREFERENCE_TYPE.TOPIC, value: 'artificial intelligence', weight: 0.9 },
      { type: PREFERENCE_TYPE.TOPIC, value: 'technology', weight: 0.8 },
      { type: PREFERENCE_TYPE.TOPIC, value: 'startups', weight: 0.7 },
      { type: PREFERENCE_TYPE.TOPIC, value: 'science', weight: 0.6 },
      { type: PREFERENCE_TYPE.TOPIC, value: 'machine learning', weight: 0.85 },
    ];

    for (const pref of preferences) {
      await UserPreference.findOneAndUpdate(
        { userId: user._id, preferenceType: pref.type, preferenceValue: pref.value },
        {
          userId: user._id,
          preferenceType: pref.type,
          preferenceValue: pref.value,
          weight: pref.weight,
          source: PREFERENCE_SOURCE.EXPLICIT,
          active: true,
        },
        { upsert: true }
      );
      console.log(`  - Added preference: ${pref.value} (weight: ${pref.weight})`);
    }

    // 3. Create content sources
    console.log('\n--- Creating content sources ---');
    for (const source of CONTENT_SOURCES) {
      await ContentSource.upsertSource({
        ...source,
        active: true,
        checkInterval: 30,
      });
      console.log(`  - Added source: ${source.name}`);
    }

    // 4. Create sample articles
    console.log('\n--- Creating sample articles ---');
    for (const articleData of SAMPLE_ARTICLES) {
      try {
        await Article.findOneAndUpdate(
          { url: articleData.url },
          {
            ...articleData,
            discoveredAt: new Date(),
          },
          { upsert: true }
        );
        console.log(`  - Added article: ${articleData.title.substring(0, 50)}...`);
      } catch (error) {
        console.log(`  - Skipped (duplicate): ${articleData.title.substring(0, 40)}...`);
      }
    }

    // Print summary
    console.log('\n========================================');
    console.log('SEED DATA CREATED SUCCESSFULLY');
    console.log('========================================');
    console.log(`Test User ID: ${user._id}`);
    console.log(`User Email: ${user.email}`);
    console.log(`Preferences: ${preferences.length}`);
    console.log(`Articles: ${SAMPLE_ARTICLES.length}`);
    console.log(`Content Sources: ${CONTENT_SOURCES.length}`);
    console.log('\nTo test the feed API, run:');
    console.log(`curl -H "x-user-id: ${user._id}" http://localhost:5001/api/feed`);
    console.log('========================================\n');

  } catch (error) {
    console.error('Error seeding data:', error);
  } finally {
    await disconnectDB();
  }
}

// Run if executed directly
seedTestData();
