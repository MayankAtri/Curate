import Article from '../../models/Article.js';
import UserPreference from '../../models/UserPreference.js';
import UserFeedCache from '../../models/UserFeedCache.js';
import RankingEngine from './RankingEngine.js';
import GoogleNewsFetcher from '../discovery/GoogleNewsFetcher.js';
import { PAGINATION, SUMMARY_STATUS } from '../../config/constants.js';
import { generateCursor, parseCursor } from '../../utils/helpers.js';
import { logger } from '../../utils/logger.js';

function escapeRegex(input = '') {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildTopicAliases(topic) {
  const normalized = (topic || '').toLowerCase().trim();
  if (!normalized) return [];

  const aliases = new Set([normalized]);

  // Common aliases / shorthand
  if (normalized.includes('formula one')) {
    aliases.add(normalized.replace('formula one', 'formula 1'));
    aliases.add('f1');
  }
  if (normalized.includes('formula 1')) {
    aliases.add(normalized.replace('formula 1', 'formula one'));
    aliases.add('f1');
  }
  if (normalized.includes('f1')) {
    aliases.add(normalized.replace(/\bf1\b/g, 'formula 1'));
    aliases.add(normalized.replace(/\bf1\b/g, 'formula one'));
  }
  if (normalized.includes('gta vi')) {
    aliases.add(normalized.replace('gta vi', 'gta 6'));
  }
  if (normalized.includes('gta 6')) {
    aliases.add(normalized.replace('gta 6', 'gta vi'));
  }

  const stopwords = new Set(['new', 'latest', 'release', 'releases', 'news', 'update', 'updates']);
  const tokens = normalized
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !stopwords.has(token));
  for (const token of tokens) {
    aliases.add(token);
  }

  return [...aliases];
}

function buildTopicRegexes(topic) {
  const aliases = buildTopicAliases(topic);
  if (aliases.length === 0) return [];

  return aliases.map((value) => new RegExp(escapeRegex(value), 'i'));
}

/**
 * FeedGenerator - Generates personalized article feeds for users
 * Uses RankingEngine to score and rank articles based on preferences
 */
class FeedGenerator {
  constructor(options = {}) {
    this.rankingEngine = new RankingEngine(options.rankingOptions);
    this.googleNewsFetcher = new GoogleNewsFetcher(options.googleNewsOptions);
    this.topicDiscoveryCooldownMs = options.topicDiscoveryCooldownMs || 10 * 60 * 1000;
    this.topicDiscoveryAttempts = new Map();
    this.defaultOptions = {
      maxArticleAgeDays: 7,
      feedSize: PAGINATION.FEED_CACHE_SIZE,
      requireSummary: false, // Set to true once summarization is working
    };
  }

  /**
   * Fetch on-demand articles for a search topic when DB has no matches.
   * Uses Google News query search and avoids hammering for repeated misses.
   * @param {string} topic - Search query
   * @returns {boolean} - True when fetch was attempted and may have added matches
   */
  async discoverTopicOnDemand(topic, options = {}) {
    const { force = false, fast = false } = options;
    const topicKey = (topic || '').toLowerCase().trim();
    if (!topicKey) return false;

    const lastAttempt = this.topicDiscoveryAttempts.get(topicKey);
    if (!force && lastAttempt && Date.now() - lastAttempt < this.topicDiscoveryCooldownMs) {
      logger.debug(`Skipping on-demand discovery for "${topicKey}" (cooldown active)`);
      return false;
    }

    this.topicDiscoveryAttempts.set(topicKey, Date.now());

    let queries = buildTopicAliases(topicKey)
      .filter((query) => query.length >= 2)
      .slice(0, 4);
    if (fast) {
      queries = queries.slice(0, 1);
    }

    if (queries.length === 0) return false;

    logger.info(`Running on-demand discovery for topic "${topicKey}"`, { queries });

    try {
      const results = await this.googleNewsFetcher.fetchForQueries(queries, {
        resolveUrls: true,
        when: '7d',
        maxItems: fast ? 12 : 40,
        delayMs: fast ? 0 : 250,
      });

      logger.info(`On-demand discovery complete for "${topicKey}"`, {
        totalFetched: results.totalFetched,
        totalNew: results.totalNew,
        totalDuplicates: results.totalDuplicates,
      });

      return results.totalFetched > 0;
    } catch (error) {
      logger.warn(`On-demand discovery failed for "${topicKey}"`, {
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Generate a personalized feed for a user
   * @param {string} userId - User's MongoDB ObjectId
   * @param {Object} options - Generation options
   * @returns {Object} - Generated feed with articles and metadata
   */
  async generateFeedForUser(userId, options = {}) {
    const opts = { ...this.defaultOptions, ...options };

    logger.info(`Generating feed for user ${userId}`, { options: opts });

    try {
      // 1. Get user's active preferences
      const preferences = await UserPreference.getActivePreferences(userId);

      if (preferences.length === 0 && !opts.topic) {
        logger.warn(`User ${userId} has no preferences, returning trending feed`);
        const trendingFeed = await this.generateTrendingFeed({
          ...opts,
          maxArticleAgeDays: null,
        });
        // Cache the trending feed so getFeed can retrieve it
        await this.cacheFeed(userId, trendingFeed.items);
        return trendingFeed;
      }

      // 2. Get recent articles (with optional topic filter)
      const articles = await this.getRecentArticles(opts);

      if (articles.length === 0) {
        logger.warn('No articles found for feed generation');
        return {
          items: [],
          metadata: {
            generatedAt: new Date(),
            totalArticles: 0,
            userPreferences: preferences.length,
          },
        };
      }

      // 3. Rank articles using the ranking engine
      const rankedArticles = this.rankingEngine.rankArticles(
        articles,
        preferences,
        { diversify: true, maxPerSource: 5 }
      );

      // 4. Take top N articles for the feed
      const feedArticles = rankedArticles.slice(0, opts.feedSize);

      // 5. Cache only default (non-topic) feeds.
      // Topic/search feeds are request-scoped and should not overwrite regular cached feed.
      if (!opts.skipCache) {
        await this.cacheFeed(userId, feedArticles);
      }

      logger.info(`Feed generated for user ${userId}`, {
        totalArticles: articles.length,
        feedSize: feedArticles.length,
        topScore: feedArticles[0]?.relevance.score,
      });

      return {
        items: feedArticles,
        metadata: {
          generatedAt: new Date(),
          totalArticles: articles.length,
          feedSize: feedArticles.length,
          userPreferences: preferences.length,
        },
      };
    } catch (error) {
      logger.error(`Error generating feed for user ${userId}`, {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get recent articles from the database
   * @param {Object} options - Query options
   * @returns {Array} - Array of article documents
   */
  async getRecentArticles(options = {}) {
    const { maxArticleAgeDays, requireSummary, topic, excludeGoogleNews = false } = options;

    const query = {};
    if (typeof maxArticleAgeDays === 'number' && maxArticleAgeDays > 0) {
      query.publishedAt = {
        $gte: new Date(Date.now() - maxArticleAgeDays * 24 * 60 * 60 * 1000),
      };
    }

    // Exclude Google News redirect URLs (they often return 400 errors)
    if (excludeGoogleNews) {
      query.url = { $not: /news\.google\.com\/rss\/articles/ };
    }

    // Filter by topic using flexible matching across tags and text.
    if (topic) {
      const topicRegexes = buildTopicRegexes(topic);
      query.$or = topicRegexes.flatMap((topicRegex) => ([
        { 'topics.name': topicRegex },
        { title: topicRegex },
        { description: topicRegex },
      ]));
    }

    // Only require completed summaries if specified
    if (requireSummary) {
      query.summaryStatus = SUMMARY_STATUS.COMPLETED;
    }

    const articles = await Article.find(query)
      .sort({ publishedAt: -1 })
      .limit(500) // Get more than we need for better ranking diversity
      .lean();

    return articles;
  }

  /**
   * Generate a trending feed (for users without preferences)
   * @param {Object} options - Generation options
   * @returns {Object} - Trending feed
   */
  async generateTrendingFeed(options = {}) {
    const { feedSize = PAGINATION.FEED_CACHE_SIZE, maxArticleAgeDays = 7 } =
      options;

    const query = {};
    if (typeof maxArticleAgeDays === 'number' && maxArticleAgeDays > 0) {
      query.publishedAt = {
        $gte: new Date(Date.now() - maxArticleAgeDays * 24 * 60 * 60 * 1000),
      };
    }

    // Get articles sorted by engagement/recency
    const articles = await Article.find(query)
      .sort({ 'engagement.score': -1, publishedAt: -1 })
      .limit(feedSize)
      .lean();

    // Create simple relevance scores for trending
    const trendingArticles = articles.map((article, index) => ({
      article,
      relevance: {
        score: 1 - index * 0.01, // Simple declining score
        matchedPreferences: [],
        scoreBreakdown: {
          preferenceMatch: 0,
          recency: this.rankingEngine.calculateRecencyScore(article.publishedAt),
          sourceQuality: this.rankingEngine.calculateSourceQualityScore(
            article.source?.quality
          ),
          engagement: this.rankingEngine.calculateEngagementScore(article),
        },
      },
    }));

    return {
      items: trendingArticles,
      metadata: {
        generatedAt: new Date(),
        totalArticles: articles.length,
        feedSize: trendingArticles.length,
        isTrending: true,
      },
    };
  }

  /**
   * Cache the generated feed in MongoDB
   * @param {string} userId - User's ID
   * @param {Array} feedItems - Ranked feed items
   */
  async cacheFeed(userId, feedItems) {
    try {
      await UserFeedCache.bulkInsertFeed(userId, feedItems);
      logger.debug(`Feed cached for user ${userId}`, {
        itemCount: feedItems.length,
      });
    } catch (error) {
      logger.error(`Error caching feed for user ${userId}`, {
        error: error.message,
      });
      // Don't throw - caching failure shouldn't break feed generation
    }
  }

  /**
   * Get user's feed from cache with pagination
   * @param {string} userId - User's ID
   * @param {Object} options - Pagination options
   * @returns {Object} - Paginated feed response
   */
  async getUserFeedFromCache(userId, options = {}) {
    const { limit = PAGINATION.DEFAULT_LIMIT, cursor = null } = options;

    // Parse cursor if provided
    let parsedCursor = null;
    if (cursor) {
      parsedCursor = parseCursor(cursor);
    }

    // Get from cache
    const result = await UserFeedCache.getCachedFeed(userId, {
      limit: Math.min(limit, PAGINATION.MAX_LIMIT),
      cursor: parsedCursor,
    });

    // Format response
    const items = result.items.map((cacheItem) => ({
      article: cacheItem.articleId, // Populated article
      relevance: cacheItem.relevance,
      position: cacheItem.position,
    }));

    // Generate next cursor
    let nextCursor = null;
    if (result.nextCursor) {
      nextCursor = generateCursor(
        result.nextCursor.score,
        result.nextCursor.id
      );
    }

    return {
      items,
      nextCursor,
      hasMore: result.hasMore,
    };
  }

  /**
   * Check if user has a fresh cached feed
   * @param {string} userId - User's ID
   * @param {number} maxAgeMinutes - Maximum cache age in minutes
   * @returns {boolean} - True if fresh cache exists
   */
  async hasFreshCache(userId, maxAgeMinutes = 30) {
    return UserFeedCache.hasFreshCache(userId, maxAgeMinutes);
  }

  /**
   * Invalidate user's feed cache
   * @param {string} userId - User's ID
   */
  async invalidateCache(userId) {
    await UserFeedCache.clearUserCache(userId);
    logger.info(`Feed cache invalidated for user ${userId}`);
  }

  /**
   * Get feed for user - checks cache first, generates if needed
   * @param {string} userId - User's ID
   * @param {Object} options - Options
   * @returns {Object} - Feed response
   */
  async getFeed(userId, options = {}) {
    const {
      limit = PAGINATION.DEFAULT_LIMIT,
      cursor = null,
      forceRefresh = false,
      topic = null,
      strictTopic = false,
      liveSearch = false,
    } = options;

    // For topic-filtered requests, generate fresh feed (skip cache)
    if (topic) {
      if (liveSearch) {
        await this.discoverTopicOnDemand(topic, { force: true, fast: true });
      }

      let result = await this.generateFeedForUser(userId, {
        topic,
        maxArticleAgeDays: null,
        skipCache: true,
      });

      if (result.items.length === 0) {
        const discovered = await this.discoverTopicOnDemand(topic);
        if (discovered) {
          result = await this.generateFeedForUser(userId, {
            topic,
            maxArticleAgeDays: null,
            skipCache: true,
          });
        }
      }

      if (result.items.length === 0 && !strictTopic) {
        logger.warn(`No topic matches for "${topic}", falling back to default feed`);
        const fallback = await this.generateFeedForUser(userId, {
          maxArticleAgeDays: null,
        });
        return this.paginateResults(fallback.items, { limit, cursor });
      }

      return this.paginateResults(result.items, { limit, cursor });
    }

    // Check if we need to regenerate
    const hasFresh = await this.hasFreshCache(userId);

    if (!hasFresh || forceRefresh) {
      // Generate new feed
      await this.generateFeedForUser(userId);
    }

    // Return paginated feed from cache
    return this.getUserFeedFromCache(userId, { limit, cursor });
  }

  /**
   * Paginate in-memory results (used for topic-filtered feeds)
   * @param {Array} items - Feed items
   * @param {Object} options - Pagination options
   * @returns {Object} - Paginated response
   */
  paginateResults(items, options = {}) {
    const { limit = PAGINATION.DEFAULT_LIMIT, cursor = null } = options;

    let startIndex = 0;
    if (cursor) {
      const parsed = parseCursor(cursor);
      if (parsed && parsed.id) {
        const idx = items.findIndex(
          (item) => item.article._id.toString() === parsed.id
        );
        if (idx !== -1) {
          startIndex = idx + 1;
        }
      }
    }

    const paginatedItems = items.slice(startIndex, startIndex + limit);
    const hasMore = startIndex + limit < items.length;

    let nextCursor = null;
    if (hasMore && paginatedItems.length > 0) {
      const lastItem = paginatedItems[paginatedItems.length - 1];
      nextCursor = generateCursor(
        lastItem.relevance.score,
        lastItem.article._id.toString()
      );
    }

    return {
      items: paginatedItems.map((item, idx) => ({
        article: item.article,
        relevance: item.relevance,
        position: startIndex + idx + 1,
      })),
      nextCursor,
      hasMore,
    };
  }
}

export default FeedGenerator;
