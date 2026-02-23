import FeedGenerator from '../services/feed/FeedGenerator.js';
import FeedCache from '../services/feed/FeedCache.js';
import { PAGINATION } from '../config/constants.js';
import { logger } from '../utils/logger.js';

const feedGenerator = new FeedGenerator();
const feedCache = new FeedCache();

/**
 * GET /api/feed
 * Get personalized feed for authenticated user
 * Supports optional topic filter via ?topic=name
 */
export async function getFeed(req, res, next) {
  try {
    const userId = req.userId;
    const {
      limit = PAGINATION.DEFAULT_LIMIT,
      cursor = null,
      topic = null,
      strictTopic = 'false',
      liveSearch = 'false',
    } = req.query;

    const parsedLimit = Math.min(
      Math.max(1, parseInt(limit) || PAGINATION.DEFAULT_LIMIT),
      PAGINATION.MAX_LIMIT
    );

    const parsedTopic = topic ? topic.toLowerCase().trim() : null;
    const parsedStrictTopic = strictTopic === 'true' || strictTopic === '1';
    const parsedLiveSearch = liveSearch === 'true' || liveSearch === '1';

    logger.info(`Getting feed for user ${userId}`, {
      limit: parsedLimit,
      cursor,
      topic: parsedTopic,
      strictTopic: parsedStrictTopic,
      liveSearch: parsedLiveSearch,
    });

    // Get feed (will generate if needed)
    const feed = await feedGenerator.getFeed(userId, {
      limit: parsedLimit,
      cursor,
      topic: parsedTopic,
      strictTopic: parsedStrictTopic,
      liveSearch: parsedLiveSearch,
    });

    // Format response
    const response = {
      items: feed.items.map((item) => ({
        article: item.article
          ? {
              _id: item.article._id,
              url: item.article.url,
              title: item.article.title,
              description: item.article.description,
              imageUrl: item.article.imageUrl,
              author: item.article.author,
              source: item.article.source,
              publishedAt: item.article.publishedAt,
              summary: item.article.summary,
              topics: item.article.topics,
              readingTimeMinutes: item.article.content?.readingTimeMinutes,
            }
          : null,
        relevance: {
          score: item.relevance.score,
          matchedPreferences: item.relevance.matchedPreferences,
          scoreBreakdown: item.relevance.scoreBreakdown,
        },
        position: item.position,
      })),
      nextCursor: feed.nextCursor,
      hasMore: feed.hasMore,
    };

    res.json(response);
  } catch (error) {
    logger.error('Error getting feed', { error: error.message, userId: req.userId });
    next(error);
  }
}

/**
 * GET /api/feed/refresh
 * Force regenerate feed for authenticated user
 */
export async function refreshFeed(req, res, next) {
  try {
    const userId = req.userId;
    const { limit = PAGINATION.DEFAULT_LIMIT } = req.query;

    logger.info(`Refreshing feed for user ${userId}`);

    // Invalidate caches
    await feedGenerator.invalidateCache(userId);
    await feedCache.invalidateFeed(userId);

    // Generate fresh feed
    const result = await feedGenerator.generateFeedForUser(userId);

    // Get paginated response
    const feed = await feedGenerator.getUserFeedFromCache(userId, {
      limit: Math.min(parseInt(limit) || PAGINATION.DEFAULT_LIMIT, PAGINATION.MAX_LIMIT),
    });

    const response = {
      items: feed.items.map((item) => ({
        article: item.article
          ? {
              _id: item.article._id,
              url: item.article.url,
              title: item.article.title,
              description: item.article.description,
              imageUrl: item.article.imageUrl,
              author: item.article.author,
              source: item.article.source,
              publishedAt: item.article.publishedAt,
              summary: item.article.summary,
              topics: item.article.topics,
              readingTimeMinutes: item.article.content?.readingTimeMinutes,
            }
          : null,
        relevance: {
          score: item.relevance.score,
          matchedPreferences: item.relevance.matchedPreferences,
          scoreBreakdown: item.relevance.scoreBreakdown,
        },
        position: item.position,
      })),
      nextCursor: feed.nextCursor,
      hasMore: feed.hasMore,
      refreshed: true,
      metadata: result.metadata,
    };

    res.json(response);
  } catch (error) {
    logger.error('Error refreshing feed', { error: error.message, userId: req.userId });
    next(error);
  }
}

/**
 * GET /api/feed/stats
 * Get feed statistics (for debugging)
 */
export async function getFeedStats(req, res, next) {
  try {
    const userId = req.userId;

    const [cacheAge, cacheTTL, cacheStats] = await Promise.all([
      feedCache.getFeedAge(userId),
      feedCache.getFeedTTL(userId),
      feedCache.getStats(),
    ]);

    res.json({
      userId,
      cache: {
        ageSeconds: cacheAge,
        ttlSeconds: cacheTTL,
        isStale: cacheAge === null || cacheAge > 1800,
      },
      globalStats: cacheStats,
    });
  } catch (error) {
    logger.error('Error getting feed stats', { error: error.message });
    next(error);
  }
}

/**
 * GET /api/feed/trending
 * Get trending articles (no authentication required)
 */
export async function getTrendingFeed(req, res, next) {
  try {
    const { limit = 20 } = req.query;

    const parsedLimit = Math.min(Math.max(1, parseInt(limit) || 20), 50);

    const result = await feedGenerator.generateTrendingFeed({
      feedSize: parsedLimit,
      maxArticleAgeDays: 1,
    });

    const response = {
      items: result.items.map((item) => ({
        article: {
          _id: item.article._id,
          url: item.article.url,
          title: item.article.title,
          description: item.article.description,
          imageUrl: item.article.imageUrl,
          source: item.article.source,
          publishedAt: item.article.publishedAt,
          summary: item.article.summary,
          topics: item.article.topics,
        },
        relevance: item.relevance,
      })),
      metadata: result.metadata,
    };

    res.json(response);
  } catch (error) {
    logger.error('Error getting trending feed', { error: error.message });
    next(error);
  }
}
