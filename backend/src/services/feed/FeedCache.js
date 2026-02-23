import {
  getCache,
  setCache,
  deleteCache,
  deleteCachePattern,
  getRedisClient,
} from '../../config/redis.js';
import { CACHE_TTL } from '../../config/constants.js';
import { logger } from '../../utils/logger.js';

/**
 * FeedCache - Redis caching layer for feed data
 * Provides fast access to frequently requested feed data
 */
class FeedCache {
  constructor() {
    // Key prefixes
    this.FEED_PREFIX = 'feed:';
    this.FEED_META_PREFIX = 'feed:meta:';
    this.ARTICLE_PREFIX = 'article:';
  }

  /**
   * Get the Redis key for a user's feed
   * @param {string} userId - User ID
   * @returns {string} - Redis key
   */
  getFeedKey(userId) {
    return `${this.FEED_PREFIX}${userId}`;
  }

  /**
   * Get the Redis key for feed metadata
   * @param {string} userId - User ID
   * @returns {string} - Redis key
   */
  getFeedMetaKey(userId) {
    return `${this.FEED_META_PREFIX}${userId}`;
  }

  /**
   * Get the Redis key for an article
   * @param {string} articleId - Article ID
   * @returns {string} - Redis key
   */
  getArticleKey(articleId) {
    return `${this.ARTICLE_PREFIX}${articleId}`;
  }

  /**
   * Get cached feed for a user
   * @param {string} userId - User ID
   * @returns {Object|null} - Cached feed data or null
   */
  async getCachedFeed(userId) {
    try {
      const feedKey = this.getFeedKey(userId);
      const metaKey = this.getFeedMetaKey(userId);

      const [feedData, metaData] = await Promise.all([
        getCache(feedKey),
        getCache(metaKey),
      ]);

      if (!feedData) {
        return null;
      }

      return {
        items: feedData,
        metadata: metaData,
      };
    } catch (error) {
      logger.error(`Error getting cached feed for user ${userId}`, {
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Cache a user's feed
   * @param {string} userId - User ID
   * @param {Array} feedItems - Array of feed items
   * @param {Object} metadata - Feed metadata
   */
  async setCachedFeed(userId, feedItems, metadata = {}) {
    try {
      const feedKey = this.getFeedKey(userId);
      const metaKey = this.getFeedMetaKey(userId);

      // Prepare feed data (only essential fields to keep cache small)
      const cacheData = feedItems.map((item) => ({
        articleId: item.article._id.toString(),
        score: item.relevance.score,
        matchedPreferences: item.relevance.matchedPreferences,
        position: item.position || 0,
      }));

      const metaData = {
        generatedAt: new Date().toISOString(),
        totalItems: feedItems.length,
        ...metadata,
      };

      await Promise.all([
        setCache(feedKey, cacheData, CACHE_TTL.FEED),
        setCache(metaKey, metaData, CACHE_TTL.FEED),
      ]);

      // Also cache individual articles for quick access
      await this.cacheArticles(feedItems.map((item) => item.article));

      logger.debug(`Feed cached for user ${userId}`, {
        itemCount: feedItems.length,
      });
    } catch (error) {
      logger.error(`Error caching feed for user ${userId}`, {
        error: error.message,
      });
    }
  }

  /**
   * Cache multiple articles
   * @param {Array} articles - Array of article documents
   */
  async cacheArticles(articles) {
    try {
      const promises = articles.map((article) => {
        const key = this.getArticleKey(article._id.toString());
        // Cache only essential fields
        const cacheData = {
          _id: article._id,
          url: article.url,
          title: article.title,
          description: article.description,
          imageUrl: article.imageUrl,
          source: article.source,
          publishedAt: article.publishedAt,
          summary: article.summary,
          topics: article.topics,
        };
        return setCache(key, cacheData, CACHE_TTL.ARTICLE);
      });

      await Promise.all(promises);
    } catch (error) {
      logger.error('Error caching articles', { error: error.message });
    }
  }

  /**
   * Get a cached article by ID
   * @param {string} articleId - Article ID
   * @returns {Object|null} - Cached article or null
   */
  async getCachedArticle(articleId) {
    try {
      const key = this.getArticleKey(articleId);
      return await getCache(key);
    } catch (error) {
      logger.error(`Error getting cached article ${articleId}`, {
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Invalidate a user's feed cache
   * @param {string} userId - User ID
   */
  async invalidateFeed(userId) {
    try {
      const feedKey = this.getFeedKey(userId);
      const metaKey = this.getFeedMetaKey(userId);

      await Promise.all([deleteCache(feedKey), deleteCache(metaKey)]);

      logger.debug(`Feed cache invalidated for user ${userId}`);
    } catch (error) {
      logger.error(`Error invalidating feed cache for user ${userId}`, {
        error: error.message,
      });
    }
  }

  /**
   * Check how old a user's feed cache is
   * @param {string} userId - User ID
   * @returns {number|null} - Age in seconds, or null if no cache
   */
  async getFeedAge(userId) {
    try {
      const metaKey = this.getFeedMetaKey(userId);
      const meta = await getCache(metaKey);

      if (!meta || !meta.generatedAt) {
        return null;
      }

      const generatedAt = new Date(meta.generatedAt);
      return Math.floor((Date.now() - generatedAt.getTime()) / 1000);
    } catch (error) {
      logger.error(`Error getting feed age for user ${userId}`, {
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Check if a user's feed cache is stale
   * @param {string} userId - User ID
   * @param {number} maxAgeSeconds - Maximum age in seconds
   * @returns {boolean} - True if stale or non-existent
   */
  async isFeedStale(userId, maxAgeSeconds = 1800) {
    const age = await this.getFeedAge(userId);
    if (age === null) return true;
    return age > maxAgeSeconds;
  }

  /**
   * Get TTL remaining for a user's feed cache
   * @param {string} userId - User ID
   * @returns {number|null} - TTL in seconds, or null
   */
  async getFeedTTL(userId) {
    try {
      const client = getRedisClient();
      const feedKey = this.getFeedKey(userId);
      const ttl = await client.ttl(feedKey);
      return ttl > 0 ? ttl : null;
    } catch (error) {
      logger.error(`Error getting feed TTL for user ${userId}`, {
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Clear all feed caches (admin operation)
   */
  async clearAllFeeds() {
    try {
      await deleteCachePattern(`${this.FEED_PREFIX}*`);
      await deleteCachePattern(`${this.FEED_META_PREFIX}*`);
      logger.info('All feed caches cleared');
    } catch (error) {
      logger.error('Error clearing all feed caches', { error: error.message });
    }
  }

  /**
   * Get cache statistics
   * @returns {Object} - Cache statistics
   */
  async getStats() {
    try {
      const client = getRedisClient();

      const feedKeys = await client.keys(`${this.FEED_PREFIX}*`);
      const articleKeys = await client.keys(`${this.ARTICLE_PREFIX}*`);

      return {
        cachedFeeds: feedKeys.filter((k) => !k.includes(':meta:')).length,
        cachedArticles: articleKeys.length,
      };
    } catch (error) {
      logger.error('Error getting cache stats', { error: error.message });
      return { cachedFeeds: 0, cachedArticles: 0 };
    }
  }
}

export default FeedCache;
