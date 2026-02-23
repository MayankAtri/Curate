import axios from 'axios';
import Article from '../../models/Article.js';
import ContentSource from '../../models/ContentSource.js';
import { SOURCE_TYPE, SOURCE_QUALITY, SUMMARY_STATUS } from '../../config/constants.js';
import { normalizeUrl, sanitizeText, sleep } from '../../utils/helpers.js';
import { logger } from '../../utils/logger.js';
import { validateUrl } from '../../utils/urlValidator.js';

/**
 * RedditFetcher - Fetches posts from Reddit's JSON API
 * No authentication required for reading public subreddits
 */
class RedditFetcher {
  constructor(options = {}) {
    this.baseUrl = 'https://www.reddit.com';
    this.userAgent = options.userAgent || 'Curate/1.0 (News Aggregator)';
    this.delayMs = options.delayMs || 2000; // Reddit rate limiting
  }

  /**
   * Fetch top posts from a subreddit
   * @param {string} subreddit - Subreddit name (without r/)
   * @param {Object} options - Fetch options
   * @returns {Array} - Array of posts
   */
  async fetchSubreddit(subreddit, options = {}) {
    const {
      timeFilter = 'day', // hour, day, week, month, year, all
      limit = 25,
      sort = 'top', // hot, new, top, rising
    } = options;

    const url = `${this.baseUrl}/r/${subreddit}/${sort}.json`;

    try {
      logger.debug(`Fetching Reddit: r/${subreddit}/${sort}`);

      const response = await axios.get(url, {
        params: {
          t: timeFilter,
          limit,
          raw_json: 1, // Get unescaped HTML
        },
        headers: {
          'User-Agent': this.userAgent,
        },
        timeout: 10000,
      });

      const posts = response.data?.data?.children || [];

      logger.info(`Fetched ${posts.length} posts from r/${subreddit}`);

      return posts.map((post) => post.data);
    } catch (error) {
      logger.error(`Error fetching r/${subreddit}`, { error: error.message });
      throw error;
    }
  }

  /**
   * Check if a Reddit post is an external link (not self-post, not image)
   * @param {Object} post - Reddit post data
   * @returns {boolean}
   */
  isExternalLink(post) {
    // Skip self posts (text posts)
    if (post.is_self) return false;

    // Skip Reddit-hosted media
    if (post.is_reddit_media_domain) return false;

    // Skip image posts
    if (post.post_hint === 'image') return false;

    // Skip video posts
    if (post.is_video) return false;

    // Skip Reddit galleries
    if (post.is_gallery) return false;

    // Skip internal Reddit links
    if (post.domain?.includes('reddit.com')) return false;
    if (post.domain?.includes('redd.it')) return false;

    // Skip common image hosts
    const imageHosts = ['imgur.com', 'i.imgur.com', 'gfycat.com', 'giphy.com'];
    if (imageHosts.some((host) => post.domain?.includes(host))) return false;

    return true;
  }

  /**
   * Map a Reddit post to our Article schema
   * @param {Object} post - Reddit post data
   * @param {Object} source - Content source document
   * @returns {Object} - Article-formatted object
   */
  mapRedditPostToArticle(post, source) {
    // Get thumbnail if valid
    let imageUrl = null;
    if (post.thumbnail && post.thumbnail.startsWith('http')) {
      imageUrl = post.thumbnail;
    }
    // Try preview images
    if (!imageUrl && post.preview?.images?.[0]?.source?.url) {
      imageUrl = post.preview.images[0].source.url.replace(/&amp;/g, '&');
    }

    // Build description from selftext or title
    const description = post.selftext
      ? sanitizeText(post.selftext).substring(0, 500)
      : `Shared on r/${post.subreddit} with ${post.score} upvotes`;

    // Infer topics from subreddit and flair
    const topics = this.inferTopics(post, source);

    return {
      url: normalizeUrl(post.url),
      title: sanitizeText(post.title),
      description,
      imageUrl,
      author: post.author !== '[deleted]' ? post.author : null,
      source: {
        name: `r/${post.subreddit}`,
        type: SOURCE_TYPE.REDDIT,
        url: `https://reddit.com/r/${post.subreddit}`,
        quality: source.quality || SOURCE_QUALITY.TIER_2,
      },
      publishedAt: new Date(post.created_utc * 1000),
      discoveredAt: new Date(),
      topics,
      engagement: {
        upvotes: post.score || 0,
        comments: post.num_comments || 0,
        score: post.score || 0,
      },
      summaryStatus: SUMMARY_STATUS.PENDING,
      content: {
        text: null,
        wordCount: 0,
        readingTimeMinutes: 0,
      },
    };
  }

  /**
   * Infer topics from Reddit post and source
   * @param {Object} post - Reddit post
   * @param {Object} source - Content source
   * @returns {Array} - Array of topic objects
   */
  inferTopics(post, source) {
    const topics = new Map();

    // Add source topics
    if (source.topics) {
      for (const topic of source.topics) {
        topics.set(topic.toLowerCase(), { name: topic.toLowerCase(), confidence: 0.7 });
      }
    }

    // Add source category
    if (source.category) {
      topics.set(source.category.toLowerCase(), {
        name: source.category.toLowerCase(),
        confidence: 0.75,
      });
    }

    // Add subreddit name as topic
    const subredditName = post.subreddit?.toLowerCase();
    if (subredditName) {
      topics.set(subredditName, { name: subredditName, confidence: 0.8 });
    }

    // Add link flair as topic
    if (post.link_flair_text) {
      const flair = post.link_flair_text.toLowerCase().trim();
      if (flair.length > 2 && flair.length < 30) {
        topics.set(flair, { name: flair, confidence: 0.85 });
      }
    }

    return Array.from(topics.values());
  }

  /**
   * Fetch articles from a content source and save to database
   * @param {Object} contentSource - ContentSource document
   * @param {Object} options - Fetch options
   * @returns {Object} - Stats about the fetch operation
   */
  async fetchAndSaveArticles(contentSource, options = {}) {
    const { validateUrls = true } = options;

    const stats = {
      source: contentSource.name,
      fetched: 0,
      externalLinks: 0,
      new: 0,
      duplicates: 0,
      invalid: 0,
      errors: [],
    };

    try {
      // Fetch posts
      const posts = await this.fetchSubreddit(contentSource.identifier, {
        timeFilter: 'day',
        limit: 50,
        sort: 'top',
      });

      stats.fetched = posts.length;

      // Filter for external links only
      const externalPosts = posts.filter((post) => this.isExternalLink(post));
      stats.externalLinks = externalPosts.length;

      // Process each post
      for (const post of externalPosts) {
        try {
          const articleData = this.mapRedditPostToArticle(post, contentSource);

          // Validate URL if enabled
          if (validateUrls) {
            const validation = await validateUrl(articleData.url);
            if (!validation.valid) {
              stats.invalid++;
              logger.debug(`Skipping invalid URL: ${articleData.url}`, {
                reason: validation.error,
              });
              continue;
            }
          }

          // Try to insert (upsert to handle duplicates)
          const result = await Article.findOneAndUpdate(
            { url: articleData.url },
            {
              $setOnInsert: articleData,
              // Always update engagement for Reddit (scores change)
              $set: {
                'engagement.upvotes': articleData.engagement.upvotes,
                'engagement.comments': articleData.engagement.comments,
                'engagement.score': articleData.engagement.score,
              },
            },
            { upsert: true, new: true, rawResult: true }
          );

          if (result.lastErrorObject?.updatedExisting) {
            stats.duplicates++;
          } else {
            stats.new++;
          }
        } catch (itemError) {
          stats.errors.push({
            url: post.url,
            error: itemError.message,
          });
        }
      }

      // Update source stats
      await contentSource.markSuccess(stats.new);

      logger.info(`Reddit fetch complete: ${contentSource.name}`, stats);

    } catch (error) {
      await contentSource.markFailure(error);
      stats.errors.push({ error: error.message });
      logger.error(`Reddit fetch failed: ${contentSource.name}`, { error: error.message });
    }

    return stats;
  }

  /**
   * Fetch from all active Reddit sources
   * @returns {Object} - Aggregated stats
   */
  async fetchFromAllSources() {
    const sources = await ContentSource.getActiveByType(SOURCE_TYPE.REDDIT);

    logger.info(`Fetching from ${sources.length} Reddit sources`);

    const results = {
      totalSources: sources.length,
      totalFetched: 0,
      totalNew: 0,
      totalDuplicates: 0,
      errors: [],
      bySource: [],
    };

    for (const source of sources) {
      // Check if source needs checking
      if (!source.needsCheck()) {
        logger.debug(`Skipping ${source.name} - checked recently`);
        continue;
      }

      const stats = await this.fetchAndSaveArticles(source);

      results.totalFetched += stats.fetched;
      results.totalNew += stats.new;
      results.totalDuplicates += stats.duplicates;
      results.errors.push(...stats.errors);
      results.bySource.push(stats);

      // Rate limiting - wait between subreddits
      await sleep(this.delayMs);
    }

    logger.info('Reddit fetch from all sources complete', {
      sources: results.totalSources,
      new: results.totalNew,
    });

    return results;
  }

  /**
   * Search Reddit for a specific query
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Array} - Array of posts
   */
  async searchReddit(query, options = {}) {
    const { limit = 25, sort = 'relevance', timeFilter = 'week' } = options;

    const url = `${this.baseUrl}/search.json`;

    try {
      const response = await axios.get(url, {
        params: {
          q: query,
          sort,
          t: timeFilter,
          limit,
          raw_json: 1,
        },
        headers: {
          'User-Agent': this.userAgent,
        },
        timeout: 10000,
      });

      const posts = response.data?.data?.children || [];
      return posts.map((post) => post.data);
    } catch (error) {
      logger.error(`Reddit search failed: ${query}`, { error: error.message });
      throw error;
    }
  }
}

// Default subreddits for news
export const DEFAULT_SUBREDDITS = [
  // Technology
  {
    name: 'r/technology',
    identifier: 'technology',
    category: 'technology',
    topics: ['tech', 'news', 'gadgets'],
    quality: SOURCE_QUALITY.TIER_2,
  },
  {
    name: 'r/MachineLearning',
    identifier: 'MachineLearning',
    category: 'artificial intelligence',
    topics: ['AI', 'machine learning', 'deep learning', 'research'],
    quality: SOURCE_QUALITY.TIER_2,
  },
  {
    name: 'r/science',
    identifier: 'science',
    category: 'science',
    topics: ['science', 'research', 'studies'],
    quality: SOURCE_QUALITY.TIER_2,
  },
  {
    name: 'r/programming',
    identifier: 'programming',
    category: 'programming',
    topics: ['programming', 'coding', 'software'],
    quality: SOURCE_QUALITY.TIER_2,
  },
  {
    name: 'r/Futurology',
    identifier: 'Futurology',
    category: 'technology',
    topics: ['future', 'technology', 'innovation'],
    quality: SOURCE_QUALITY.TIER_2,
  },
  {
    name: 'r/business',
    identifier: 'business',
    category: 'business',
    topics: ['business', 'finance', 'economics'],
    quality: SOURCE_QUALITY.TIER_2,
  },
  // Gaming
  {
    name: 'r/gaming',
    identifier: 'gaming',
    category: 'gaming',
    topics: ['gaming', 'video games', 'game news'],
    quality: SOURCE_QUALITY.TIER_2,
  },
  {
    name: 'r/pcgaming',
    identifier: 'pcgaming',
    category: 'gaming',
    topics: ['gaming', 'pc gaming', 'hardware', 'reviews'],
    quality: SOURCE_QUALITY.TIER_2,
  },
  {
    name: 'r/Games',
    identifier: 'Games',
    category: 'gaming',
    topics: ['gaming', 'video games', 'industry news', 'reviews'],
    quality: SOURCE_QUALITY.TIER_2,
  },
  {
    name: 'r/truegaming',
    identifier: 'truegaming',
    category: 'gaming',
    topics: ['gaming', 'game design', 'discussion'],
    quality: SOURCE_QUALITY.TIER_2,
  },
  // AI Tools
  {
    name: 'r/OpenAI',
    identifier: 'OpenAI',
    category: 'ai',
    topics: ['AI', 'AI tools', 'ChatGPT', 'GPT'],
    quality: SOURCE_QUALITY.TIER_2,
  },
  {
    name: 'r/ChatGPT',
    identifier: 'ChatGPT',
    category: 'ai',
    topics: ['AI', 'AI tools', 'ChatGPT', 'prompts'],
    quality: SOURCE_QUALITY.TIER_2,
  },
  {
    name: 'r/LocalLLaMA',
    identifier: 'LocalLLaMA',
    category: 'ai',
    topics: ['AI', 'AI tools', 'open source AI', 'LLMs'],
    quality: SOURCE_QUALITY.TIER_2,
  },
  {
    name: 'r/StableDiffusion',
    identifier: 'StableDiffusion',
    category: 'ai',
    topics: ['AI', 'AI tools', 'image generation', 'AI art'],
    quality: SOURCE_QUALITY.TIER_2,
  },
  {
    name: 'r/artificial',
    identifier: 'artificial',
    category: 'ai',
    topics: ['AI', 'AI tools', 'artificial intelligence', 'news'],
    quality: SOURCE_QUALITY.TIER_2,
  },
  // Claude AI & Anthropic
  {
    name: 'r/ClaudeAI',
    identifier: 'ClaudeAI',
    category: 'ai',
    topics: ['Claude', 'Anthropic', 'AI', 'Claude AI', 'chatbot'],
    quality: SOURCE_QUALITY.TIER_1,
  },
  {
    name: 'r/Anthropic',
    identifier: 'Anthropic',
    category: 'ai',
    topics: ['Anthropic', 'Claude', 'AI safety', 'Claude AI'],
    quality: SOURCE_QUALITY.TIER_1,
  },
  // More Gaming
  {
    name: 'r/PS5',
    identifier: 'PS5',
    category: 'gaming',
    topics: ['gaming', 'PlayStation', 'PS5', 'console gaming'],
    quality: SOURCE_QUALITY.TIER_2,
  },
  {
    name: 'r/XboxSeriesX',
    identifier: 'XboxSeriesX',
    category: 'gaming',
    topics: ['gaming', 'Xbox', 'console gaming', 'Game Pass'],
    quality: SOURCE_QUALITY.TIER_2,
  },
  {
    name: 'r/NintendoSwitch',
    identifier: 'NintendoSwitch',
    category: 'gaming',
    topics: ['gaming', 'Nintendo', 'Switch', 'Nintendo games'],
    quality: SOURCE_QUALITY.TIER_2,
  },
  {
    name: 'r/Steam',
    identifier: 'Steam',
    category: 'gaming',
    topics: ['gaming', 'Steam', 'PC gaming', 'game deals'],
    quality: SOURCE_QUALITY.TIER_2,
  },
  {
    name: 'r/GameDeals',
    identifier: 'GameDeals',
    category: 'gaming',
    topics: ['gaming', 'deals', 'game sales', 'discounts'],
    quality: SOURCE_QUALITY.TIER_2,
  },
];

export default RedditFetcher;
