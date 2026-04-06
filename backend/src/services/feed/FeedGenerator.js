import Article from '../../models/Article.js';
import UserPreference from '../../models/UserPreference.js';
import UserFeedCache from '../../models/UserFeedCache.js';
import RankingEngine from './RankingEngine.js';
import GoogleNewsFetcher from '../discovery/GoogleNewsFetcher.js';
import {
  PAGINATION,
  SUMMARY_STATUS,
  PREFERENCE_TYPE,
  PREFERENCE_SOURCE,
} from '../../config/constants.js';
import { generateCursor, parseCursor } from '../../utils/helpers.js';
import { logger } from '../../utils/logger.js';

function escapeRegex(input = '') {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeHeadline(title = '') {
  return title
    .toLowerCase()
    .replace(/['’"]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(live|update|updates|analysis|report|reports|review|reviews|breaking|exclusive)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildTopicAliases(topic) {
  const normalized = (topic || '').toLowerCase().trim();
  if (!normalized) return [];

  const aliases = new Set([normalized]);
  for (const mappedQuery of TOPIC_DISCOVERY_QUERY_MAP[normalized] || []) {
    aliases.add(mappedQuery);
  }

  if (normalized === 'ai') {
    aliases.add('artificial intelligence');
    aliases.add('machine learning');
    aliases.add('llm');
    aliases.add('llms');
  }
  if (normalized === 'gaming') {
    aliases.delete('gaming');
    aliases.add('video games');
    aliases.add('pc gaming');
    aliases.add('console gaming');
  }

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

  return aliases.map((value) => {
    // Prevent broad false-positive matches for short tokens like "ai".
    if (value.length <= 3) {
      return new RegExp(`\\b${escapeRegex(value)}\\b`, 'i');
    }
    return new RegExp(escapeRegex(value), 'i');
  });
}

const TOPIC_DISCOVERY_QUERY_MAP = {
  ai: ['artificial intelligence', 'ai tools'],
  anime: ['anime'],
  business: ['business'],
  crypto: ['crypto'],
  entertainment: ['entertainment'],
  environment: ['environment', 'climate'],
  esports: ['esports', 'competitive gaming'],
  finance: ['finance', 'markets'],
  food: ['food', 'recipes', 'restaurants'],
  gadgets: ['gadgets', 'consumer tech'],
  gaming: ['video games', 'pc gaming', 'console gaming'],
  health: ['health'],
  movies: ['movies', 'film'],
  music: ['music'],
  news: ['world news'],
  politics: ['politics'],
  programming: ['programming', 'software development'],
  science: ['science'],
  space: ['space'],
  sports: ['sports'],
  startups: ['startups', 'venture capital'],
  technology: ['technology', 'tech'],
  travel: ['travel'],
};

const TOPIC_STRICT_SIGNALS = {
  ai: ['artificial intelligence', 'machine learning', 'llm', 'llms', 'chatgpt', 'gemini'],
  business: ['business', 'company', 'companies', 'earnings', 'revenue', 'market', 'markets'],
  crypto: ['crypto', 'bitcoin', 'ethereum', 'blockchain', 'token'],
  food: ['food', 'recipe', 'recipes', 'restaurant', 'restaurants', 'chef', 'cooking', 'kitchen', 'nutrition'],
  gaming: ['video game', 'video games', 'gameplay', 'xbox', 'playstation', 'nintendo', 'steam', 'pc gaming', 'console gaming', 'gamer', 'gamers'],
  health: ['health', 'medical', 'medicine', 'hospital', 'doctor', 'disease', 'wellness'],
  movies: ['movie', 'movies', 'film', 'cinema', 'box office', 'director'],
  music: ['music', 'album', 'song', 'songs', 'artist', 'concert'],
  politics: ['politics', 'policy', 'election', 'senate', 'congress', 'government', 'white house'],
  science: ['research', 'study', 'scientist', 'scientists', 'nasa', 'physics', 'chemistry', 'biology', 'astronomy', 'space', 'laboratory', 'experiment'],
  space: ['space', 'nasa', 'spacex', 'rocket', 'orbit', 'astronomy', 'moon', 'mars'],
  sports: ['sports', 'game', 'match', 'season', 'league', 'tournament', 'player', 'players'],
  technology: ['technology', 'tech', 'software', 'hardware', 'device', 'devices', 'startup', 'startups'],
  travel: ['travel', 'trip', 'trips', 'tourism', 'flight', 'flights', 'hotel', 'hotels', 'destination'],
};

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
    this.topicDiscoveryInFlight = new Map();
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

    const mappedQueries = TOPIC_DISCOVERY_QUERY_MAP[topicKey] || [];
    let queries = [
      ...(mappedQueries.length > 0 ? mappedQueries : buildTopicAliases(topicKey)),
    ]
      .filter((query) => query.length >= 2)
      .filter((query, index, allQueries) => allQueries.indexOf(query) === index)
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

  triggerTopicDiscovery(topic, options = {}) {
    const topicKey = (topic || '').toLowerCase().trim();
    if (!topicKey) return;

    const existingTask = this.topicDiscoveryInFlight.get(topicKey);
    if (existingTask) {
      logger.debug(`Topic discovery already running for "${topicKey}"`);
      return;
    }

    const task = this.discoverTopicOnDemand(topicKey, options)
      .catch((error) => {
        logger.warn(`Background topic discovery failed for "${topicKey}"`, {
          error: error.message,
        });
      })
      .finally(() => {
        this.topicDiscoveryInFlight.delete(topicKey);
      });

    this.topicDiscoveryInFlight.set(topicKey, task);
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
      const rankingPreferences = this.getRankingPreferences(preferences);

      if (rankingPreferences.length === 0 && !opts.topic) {
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
      let articles = await this.getRecentArticles(opts);

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

      const explicitTopicValues = this.getExplicitTopicValues(preferences);
      if (!opts.topic && explicitTopicValues.length > 0) {
        const matchingCount = articles.filter((article) =>
          this.articleMatchesAnyTopics(article, explicitTopicValues)
        ).length;

        // If current corpus has very low coverage for explicit topics, fetch
        // topic-specific articles on demand so onboarding changes are reflected.
        if (matchingCount < Math.max(12, Math.floor(opts.feedSize * 0.35))) {
          let discoveredAny = false;
          for (const topicValue of explicitTopicValues.slice(0, 4)) {
            // Keep this fast for interactive refreshes.
            const discovered = await this.discoverTopicOnDemand(topicValue, { fast: true });
            discoveredAny = discoveredAny || discovered;
          }

          if (discoveredAny) {
            articles = await this.getRecentArticles({
              ...opts,
              maxArticleAgeDays: null,
            });
          }
        }
      }

      // 3. Rank articles using the ranking engine
      const rankedArticles = this.rankingEngine.rankArticles(
        articles,
        rankingPreferences,
        { diversify: true, maxPerSource: 5 }
      );
      const uniqueRankedArticles = this.dedupeRankedArticles(rankedArticles);

      // 4. Take top N articles for the feed.
      // If the user has explicit topic preferences, prioritize items that match
      // those topics so onboarding/preferences changes are immediately visible.
      let feedArticles;
      if (!opts.topic && explicitTopicValues.length > 0) {
        const matching = [];
        const nonMatching = [];

        for (const item of uniqueRankedArticles) {
          if (this.articleMatchesAnyTopics(item.article, explicitTopicValues)) {
            matching.push(item);
          } else {
            nonMatching.push(item);
          }
        }

        feedArticles = matching.slice(0, opts.feedSize);
        if (feedArticles.length < opts.feedSize) {
          feedArticles = feedArticles.concat(
            nonMatching.slice(0, opts.feedSize - feedArticles.length)
          );
        }
      } else {
        feedArticles = uniqueRankedArticles.slice(0, opts.feedSize);
      }

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
          userPreferences: rankingPreferences.length,
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
   * Build the preference set used by ranking.
   * If explicit topic preferences exist, ignore implicit topic preferences so
   * onboarding/preferences updates affect the feed immediately.
   * @param {Array} preferences
   * @returns {Array}
   */
  getRankingPreferences(preferences = []) {
    const explicitTopicCount = preferences.filter(
      (pref) =>
        pref.preferenceType === PREFERENCE_TYPE.TOPIC &&
        pref.source === PREFERENCE_SOURCE.EXPLICIT &&
        pref.active !== false
    ).length;

    if (explicitTopicCount === 0) {
      return preferences;
    }

    return preferences.filter(
      (pref) =>
        pref.preferenceType !== PREFERENCE_TYPE.TOPIC ||
        pref.source === PREFERENCE_SOURCE.EXPLICIT
    );
  }

  /**
   * Get explicit topic preference values.
   * @param {Array} preferences
   * @returns {Array<string>}
   */
  getExplicitTopicValues(preferences = []) {
    return preferences
      .filter(
        (pref) =>
          pref.preferenceType === PREFERENCE_TYPE.TOPIC &&
          pref.source === PREFERENCE_SOURCE.EXPLICIT &&
          pref.active !== false &&
          typeof pref.preferenceValue === 'string'
      )
      .map((pref) => pref.preferenceValue.toLowerCase().trim())
      .filter(Boolean);
  }

  /**
   * Check whether an article matches any topic string.
   * @param {Object} article
   * @param {Array<string>} topics
   * @returns {boolean}
   */
  articleMatchesAnyTopics(article, topics = []) {
    if (!article || !topics.length) return false;

    return topics.some((topic) => {
      const regexes = buildTopicRegexes(topic);
      if (regexes.length === 0) return false;

      return regexes.some((regex) => {
        const inTags = (article.topics || []).some((t) =>
          regex.test((t?.name || '').toLowerCase())
        );
        if (inTags) return true;

        return (
          regex.test((article.title || '').toLowerCase()) ||
          regex.test((article.description || '').toLowerCase())
        );
      });
    });
  }

  articlePassesTopicStrictFilter(article, topic) {
    if (!article || !topic) return false;

    const normalizedTopic = topic.toLowerCase().trim();
    const signals = TOPIC_STRICT_SIGNALS[normalizedTopic] || [];
    if (signals.length === 0) {
      return this.articleMatchesAnyTopics(article, [normalizedTopic]);
    }

    const haystack = [
      article.title || '',
      article.description || '',
      ...(article.topics || []).map((entry) => entry?.name || ''),
    ]
      .join(' ')
      .toLowerCase();

    return signals.some((signal) => haystack.includes(signal));
  }

  dedupeRankedArticles(rankedArticles = []) {
    const seenKeys = new Set();
    const deduped = [];

    for (const item of rankedArticles) {
      const article = item?.article;
      if (!article) continue;

      const normalizedTitle = normalizeHeadline(article.title || '');
      const dedupeKey = normalizedTitle || article.url || article._id?.toString();

      if (!dedupeKey || !seenKeys.has(dedupeKey)) {
        if (dedupeKey) {
          seenKeys.add(dedupeKey);
        }
        deduped.push(item);
      }
    }

    return deduped;
  }

  /**
   * Get recent articles from the database
   * @param {Object} options - Query options
   * @returns {Array} - Array of article documents
   */
  async getRecentArticles(options = {}) {
    const {
      maxArticleAgeDays,
      requireSummary,
      topic,
      excludeGoogleNews = false,
      topicMatchMode = 'broad',
    } = options;

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
      if (topicMatchMode === 'query-tag') {
        query.$or = topicRegexes.map((topicRegex) => ({
          topics: {
            $elemMatch: {
              name: topicRegex,
              confidence: { $gte: 0.85 },
            },
          },
        }));
      } else {
        query.$or = topicRegexes.flatMap((topicRegex) => ([
          { 'topics.name': topicRegex },
          { title: topicRegex },
          { description: topicRegex },
        ]));
      }
    }

    // Only require completed summaries if specified
    if (requireSummary) {
      query.summaryStatus = SUMMARY_STATUS.COMPLETED;
    }

    const articles = await Article.find(query)
      .sort({ publishedAt: -1 })
      .limit(500) // Get more than we need for better ranking diversity
      .lean();

    if (topic && topicMatchMode === 'query-tag') {
      return articles.filter((article) => this.articlePassesTopicStrictFilter(article, topic));
    }

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
      requireSummary = false,
    } = options;

    const needsRequestScopedFeed = Boolean(topic || requireSummary);

    // Topic-filtered and summary-filtered requests are request-scoped.
    if (needsRequestScopedFeed) {
      let result = await this.generateFeedForUser(userId, {
        topic,
        requireSummary,
        maxArticleAgeDays: null,
        skipCache: true,
        topicMatchMode: 'query-tag',
      });

      const minimumTopicResults = Math.min(limit, 6);
      const hasEnoughTopicResults = result.items.length >= minimumTopicResults;

      if (!hasEnoughTopicResults) {
        // Live search can justify waiting briefly for a targeted refresh.
        // Topic-tab clicks should never block on discovery.
        const shouldBlockForBootstrap = liveSearch;

        if (shouldBlockForBootstrap) {
          const discovered = await this.discoverTopicOnDemand(topic, {
            force: true,
            fast: true,
          });

          if (discovered) {
            result = await this.generateFeedForUser(userId, {
              topic,
              requireSummary,
              maxArticleAgeDays: null,
              skipCache: true,
              topicMatchMode: 'query-tag',
            });
          }
        } else {
          this.triggerTopicDiscovery(topic, {
            force: true,
            fast: true,
          });
        }
      }

      if (result.items.length < minimumTopicResults && !liveSearch) {
        this.triggerTopicDiscovery(topic, {
          force: true,
          fast: false,
        });
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
