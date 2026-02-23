// Source quality tiers
export const SOURCE_QUALITY = {
  TIER_1: 'TIER_1', // Premium sources (TechCrunch, The Verge, etc.)
  TIER_2: 'TIER_2', // Good sources (Reddit popular, etc.)
  TIER_3: 'TIER_3', // Other sources
};

// Source types
export const SOURCE_TYPE = {
  RSS: 'RSS',
  GOOGLE_NEWS: 'GOOGLE_NEWS',
  REDDIT: 'REDDIT',
};

// Preference types
export const PREFERENCE_TYPE = {
  TOPIC: 'TOPIC',
  SOURCE: 'SOURCE',
  KEYWORD: 'KEYWORD',
  AUTHOR: 'AUTHOR',
  LENGTH: 'LENGTH', // short, medium, long
};

// Preference sources (how the preference was created)
export const PREFERENCE_SOURCE = {
  EXPLICIT: 'EXPLICIT', // User explicitly selected
  IMPLICIT: 'IMPLICIT', // Learned from behavior
};

// User interaction types
export const INTERACTION_TYPE = {
  VIEW: 'VIEW',
  CLICK: 'CLICK',
  DISMISS: 'DISMISS',
  BOOKMARK: 'BOOKMARK',
  SHARE: 'SHARE',
  LIKE: 'LIKE',
  DISLIKE: 'DISLIKE',
};

// Article length categories (based on reading time in minutes)
export const ARTICLE_LENGTH = {
  SHORT: 'short',     // < 3 minutes
  MEDIUM: 'medium',   // 3-7 minutes
  LONG: 'long',       // > 7 minutes
};

// Learning configuration
export const LEARNING_CONFIG = {
  // Minimum read time ratio to count as positive engagement
  POSITIVE_READ_RATIO: 0.6,       // 60% of estimated read time
  // Weight adjustments (gradual learning)
  POSITIVE_WEIGHT_INCREMENT: 0.015,
  NEGATIVE_WEIGHT_DECREMENT: 0.02,
  // Minimum interactions before creating implicit preference
  MIN_INTERACTIONS_FOR_PREFERENCE: 3,
  // Weight decay for old interactions
  INTERACTION_DECAY_DAYS: 30,
  // Starting weight for implicit preferences
  IMPLICIT_STARTING_WEIGHT: 0.3,
  // Maximum weight for implicit preferences
  IMPLICIT_MAX_WEIGHT: 0.85,
};

// Article summary status
export const SUMMARY_STATUS = {
  PENDING: 'PENDING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
};

// Ranking weights
export const RANKING_WEIGHTS = {
  preferenceMatch: 0.4,
  recency: 0.3,
  sourceQuality: 0.2,
  engagement: 0.1,
};

// Recency scoring thresholds (in hours)
export const RECENCY_THRESHOLDS = {
  VERY_FRESH: 6,    // 1.0 score
  FRESH: 24,        // 0.7 score
  RECENT: 72,       // 0.4 score
  OLD: Infinity,    // 0.1 score
};

// Pagination defaults
export const PAGINATION = {
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 50,
  FEED_CACHE_SIZE: 100,
};

// Cache TTL (in seconds)
export const CACHE_TTL = {
  FEED: 60 * 60,           // 1 hour
  ARTICLE: 60 * 60 * 24,   // 24 hours
  USER_PREFERENCES: 60 * 30, // 30 minutes
};

// Job schedules (in milliseconds)
export const JOB_SCHEDULES = {
  ARTICLE_DISCOVERY: 30 * 60 * 1000,  // 30 minutes
  SUMMARIZATION: 5 * 60 * 1000,       // 5 minutes
  FEED_GENERATION: 30 * 60 * 1000,    // 30 minutes
  PREFERENCE_LEARNING: 24 * 60 * 60 * 1000, // 24 hours
};

// API rate limits
export const RATE_LIMITS = {
  GEMINI_REQUESTS_PER_DAY: 1500,
  GEMINI_DELAY_MS: 1000,
  REDDIT_DELAY_MS: 2000,
};

// Default RSS feeds
export const DEFAULT_RSS_FEEDS = [
  // Technology
  {
    name: 'TechCrunch',
    url: 'https://techcrunch.com/feed/',
    category: 'technology',
    topics: ['tech', 'startups', 'AI'],
    quality: SOURCE_QUALITY.TIER_1,
  },
  {
    name: 'The Verge',
    url: 'https://www.theverge.com/rss/index.xml',
    category: 'technology',
    topics: ['tech', 'gadgets', 'reviews'],
    quality: SOURCE_QUALITY.TIER_1,
  },
  {
    name: 'Ars Technica',
    url: 'https://feeds.arstechnica.com/arstechnica/technology-lab',
    category: 'technology',
    topics: ['tech', 'science', 'policy'],
    quality: SOURCE_QUALITY.TIER_1,
  },
  {
    name: 'Wired',
    url: 'https://www.wired.com/feed/rss',
    category: 'technology',
    topics: ['tech', 'culture', 'science'],
    quality: SOURCE_QUALITY.TIER_1,
  },
  {
    name: 'MIT Technology Review',
    url: 'https://www.technologyreview.com/feed/',
    category: 'ai',
    topics: ['AI', 'technology', 'science'],
    quality: SOURCE_QUALITY.TIER_1,
  },
  // Gaming News
  {
    name: 'IGN',
    url: 'https://feeds.feedburner.com/ign/all',
    category: 'gaming',
    topics: ['gaming', 'video games', 'reviews', 'esports'],
    quality: SOURCE_QUALITY.TIER_1,
  },
  {
    name: 'Kotaku',
    url: 'https://kotaku.com/rss',
    category: 'gaming',
    topics: ['gaming', 'video games', 'game culture'],
    quality: SOURCE_QUALITY.TIER_1,
  },
  {
    name: 'Polygon',
    url: 'https://www.polygon.com/rss/index.xml',
    category: 'gaming',
    topics: ['gaming', 'video games', 'entertainment'],
    quality: SOURCE_QUALITY.TIER_1,
  },
  {
    name: 'PC Gamer',
    url: 'https://www.pcgamer.com/rss/',
    category: 'gaming',
    topics: ['gaming', 'pc gaming', 'hardware', 'reviews'],
    quality: SOURCE_QUALITY.TIER_1,
  },
  {
    name: 'GameSpot',
    url: 'https://www.gamespot.com/feeds/mashup/',
    category: 'gaming',
    topics: ['gaming', 'video games', 'reviews', 'news'],
    quality: SOURCE_QUALITY.TIER_1,
  },
  {
    name: 'Rock Paper Shotgun',
    url: 'https://www.rockpapershotgun.com/feed',
    category: 'gaming',
    topics: ['gaming', 'pc gaming', 'indie games'],
    quality: SOURCE_QUALITY.TIER_2,
  },
  // AI Tools & AI News
  {
    name: 'OpenAI Blog',
    url: 'https://openai.com/blog/rss/',
    category: 'ai',
    topics: ['AI', 'AI tools', 'ChatGPT', 'large language models'],
    quality: SOURCE_QUALITY.TIER_1,
  },
  {
    name: 'Hugging Face Blog',
    url: 'https://huggingface.co/blog/feed.xml',
    category: 'ai',
    topics: ['AI', 'AI tools', 'machine learning', 'open source AI'],
    quality: SOURCE_QUALITY.TIER_1,
  },
  {
    name: 'AI News',
    url: 'https://www.artificialintelligence-news.com/feed/',
    category: 'ai',
    topics: ['AI', 'AI tools', 'machine learning', 'deep learning'],
    quality: SOURCE_QUALITY.TIER_2,
  },
  {
    name: 'VentureBeat AI',
    url: 'https://venturebeat.com/category/ai/feed/',
    category: 'ai',
    topics: ['AI', 'AI tools', 'enterprise AI', 'startups'],
    quality: SOURCE_QUALITY.TIER_1,
  },
  {
    name: 'The AI Blog',
    url: 'https://blogs.microsoft.com/ai/feed/',
    category: 'ai',
    topics: ['AI', 'AI tools', 'Microsoft AI', 'enterprise'],
    quality: SOURCE_QUALITY.TIER_1,
  },
  {
    name: 'Google AI Blog',
    url: 'https://blog.google/technology/ai/rss/',
    category: 'ai',
    topics: ['AI', 'AI tools', 'Google AI', 'machine learning'],
    quality: SOURCE_QUALITY.TIER_1,
  },
];

// Reddit subreddit to topic mapping
export const SUBREDDIT_TOPIC_MAP = {
  technology: ['technology', 'gadgets', 'tech'],
  'artificial intelligence': ['MachineLearning', 'artificial', 'LocalLLaMA'],
  science: ['science', 'Physics', 'biology'],
  space: ['space', 'SpaceX', 'nasa'],
  programming: ['programming', 'webdev', 'javascript'],
  business: ['business', 'entrepreneur', 'startups'],
  gaming: ['gaming', 'pcgaming', 'Games', 'truegaming'],
  'ai tools': ['OpenAI', 'ChatGPT', 'ClaudeAI', 'LocalLLaMA', 'StableDiffusion'],
};

// Default Google News queries for discovery
export const DEFAULT_GOOGLE_NEWS_QUERIES = [
  // Technology
  'artificial intelligence',
  'machine learning',
  'technology news',
  'startup funding',
  'cybersecurity',
  // Gaming
  'video game releases',
  'gaming news',
  'esports',
  'PlayStation Xbox Nintendo',
  // AI Tools
  'AI tools',
  'ChatGPT',
  'large language models',
  'generative AI',
  'AI startups',
  // General
  'climate technology',
  'electric vehicles',
];
