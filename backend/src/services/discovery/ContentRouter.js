import RSSFetcher, { DEFAULT_RSS_FEEDS } from './RSSFetcher.js';
import RedditFetcher, { DEFAULT_SUBREDDITS } from './RedditFetcher.js';
import GoogleNewsFetcher, { DEFAULT_NEWS_QUERIES } from './GoogleNewsFetcher.js';
import ContentSource from '../../models/ContentSource.js';
import UserPreference from '../../models/UserPreference.js';
import { SOURCE_TYPE, SUBREDDIT_TOPIC_MAP } from '../../config/constants.js';
import { looksLikeProperNoun, sleep } from '../../utils/helpers.js';
import { logger } from '../../utils/logger.js';

/**
 * ContentRouter - Orchestrates content discovery across all sources
 * Intelligently routes queries to the most appropriate sources
 */
class ContentRouter {
  constructor(options = {}) {
    this.rssFetcher = new RSSFetcher(options.rss);
    this.redditFetcher = new RedditFetcher(options.reddit);
    this.googleNewsFetcher = new GoogleNewsFetcher(options.googleNews);
  }

  /**
   * Determine which sources to use for a preference
   * @param {Object} preference - User preference
   * @returns {Array} - Array of source configs
   */
  determineSourcesForPreference(preference) {
    const value = preference.preferenceValue.toLowerCase();
    const sources = [];

    // Person/company names -> Google News only
    if (looksLikeProperNoun(preference.preferenceValue)) {
      sources.push({
        type: 'GOOGLE_NEWS',
        query: preference.preferenceValue,
        priority: 1,
      });
      return sources;
    }

    // Check if we have matching RSS sources
    const matchingRSS = this.findMatchingRSSSources(value);
    if (matchingRSS.length > 0) {
      sources.push({
        type: 'RSS',
        sources: matchingRSS,
        priority: 1,
      });
    }

    // Check if we have matching subreddits
    const matchingSubreddits = this.findMatchingSubreddits(value);
    if (matchingSubreddits.length > 0) {
      sources.push({
        type: 'REDDIT',
        subreddits: matchingSubreddits,
        priority: 2,
      });
    }

    // Always add Google News for specific topics
    sources.push({
      type: 'GOOGLE_NEWS',
      query: preference.preferenceValue,
      priority: matchingRSS.length > 0 ? 3 : 1,
    });

    return sources;
  }

  /**
   * Find RSS sources matching a topic
   * @param {string} topic - Topic to match
   * @returns {Array} - Matching RSS source identifiers
   */
  findMatchingRSSSources(topic) {
    const matches = [];

    for (const feed of DEFAULT_RSS_FEEDS) {
      // Check if topic matches category or topics
      if (feed.category?.toLowerCase().includes(topic) ||
          feed.topics?.some(t => t.toLowerCase().includes(topic) || topic.includes(t.toLowerCase()))) {
        matches.push(feed.identifier);
      }
    }

    return matches;
  }

  /**
   * Find subreddits matching a topic
   * @param {string} topic - Topic to match
   * @returns {Array} - Matching subreddit names
   */
  findMatchingSubreddits(topic) {
    // Check the topic map
    for (const [key, subreddits] of Object.entries(SUBREDDIT_TOPIC_MAP)) {
      if (key.includes(topic) || topic.includes(key)) {
        return subreddits;
      }
    }

    // Check default subreddits
    const matches = [];
    for (const sub of DEFAULT_SUBREDDITS) {
      if (sub.category?.toLowerCase().includes(topic) ||
          sub.topics?.some(t => t.toLowerCase().includes(topic))) {
        matches.push(sub.identifier);
      }
    }

    return matches;
  }

  /**
   * Discover content based on user preferences
   * @param {Array} preferences - User preferences
   * @param {Object} options - Options
   * @returns {Object} - Discovery results
   */
  async discoverForPreferences(preferences, options = {}) {
    const { maxPerSource = 50 } = options;

    const results = {
      totalNew: 0,
      sources: [],
      errors: [],
    };

    // Get unique queries from preferences
    const googleNewsQueries = new Set();
    const rssSourceIds = new Set();
    const subreddits = new Set();

    for (const pref of preferences) {
      const sources = this.determineSourcesForPreference(pref);

      for (const source of sources) {
        if (source.type === 'GOOGLE_NEWS') {
          googleNewsQueries.add(source.query);
        } else if (source.type === 'RSS') {
          source.sources.forEach(s => rssSourceIds.add(s));
        } else if (source.type === 'REDDIT') {
          source.subreddits.forEach(s => subreddits.add(s));
        }
      }
    }

    // Fetch from RSS sources
    if (rssSourceIds.size > 0) {
      try {
        const rssSources = await ContentSource.find({
          identifier: { $in: Array.from(rssSourceIds) },
          active: true,
        });

        for (const source of rssSources) {
          const stats = await this.rssFetcher.fetchAndSaveArticles(source);
          results.totalNew += stats.new;
          results.sources.push({ type: 'RSS', name: source.name, ...stats });
        }
      } catch (error) {
        results.errors.push({ type: 'RSS', error: error.message });
      }
    }

    // Fetch from Reddit
    if (subreddits.size > 0) {
      try {
        const redditSources = await ContentSource.find({
          identifier: { $in: Array.from(subreddits) },
          type: SOURCE_TYPE.REDDIT,
          active: true,
        });

        for (const source of redditSources) {
          const stats = await this.redditFetcher.fetchAndSaveArticles(source);
          results.totalNew += stats.new;
          results.sources.push({ type: 'REDDIT', name: source.name, ...stats });
          await sleep(2000); // Rate limiting
        }
      } catch (error) {
        results.errors.push({ type: 'REDDIT', error: error.message });
      }
    }

    // Fetch from Google News
    if (googleNewsQueries.size > 0) {
      try {
        const queries = Array.from(googleNewsQueries).slice(0, 10); // Limit queries
        const stats = await this.googleNewsFetcher.fetchForQueries(queries);
        results.totalNew += stats.totalNew;
        results.sources.push({ type: 'GOOGLE_NEWS', ...stats });
      } catch (error) {
        results.errors.push({ type: 'GOOGLE_NEWS', error: error.message });
      }
    }

    logger.info('Content discovery complete', {
      totalNew: results.totalNew,
      sourceCount: results.sources.length,
      errorCount: results.errors.length,
    });

    return results;
  }

  /**
   * Discover content from all active sources
   * @returns {Object} - Discovery results
   */
  async discoverFromAllSources() {
    const results = {
      rss: null,
      reddit: null,
      googleNews: null,
      totalNew: 0,
      errors: [],
    };

    logger.info('Starting discovery from all sources');

    // Fetch from RSS
    try {
      results.rss = await this.rssFetcher.fetchFromAllSources();
      results.totalNew += results.rss.totalNew;
    } catch (error) {
      results.errors.push({ source: 'RSS', error: error.message });
      logger.error('RSS discovery failed', { error: error.message });
    }

    // Fetch from Reddit
    try {
      results.reddit = await this.redditFetcher.fetchFromAllSources();
      results.totalNew += results.reddit.totalNew;
    } catch (error) {
      results.errors.push({ source: 'Reddit', error: error.message });
      logger.error('Reddit discovery failed', { error: error.message });
    }

    // Fetch from Google News (use default queries)
    try {
      results.googleNews = await this.googleNewsFetcher.fetchForQueries(DEFAULT_NEWS_QUERIES);
      results.totalNew += results.googleNews.totalNew;
    } catch (error) {
      results.errors.push({ source: 'Google News', error: error.message });
      logger.error('Google News discovery failed', { error: error.message });
    }

    logger.info('Discovery from all sources complete', {
      totalNew: results.totalNew,
      rssNew: results.rss?.totalNew || 0,
      redditNew: results.reddit?.totalNew || 0,
      googleNewsNew: results.googleNews?.totalNew || 0,
    });

    return results;
  }

  /**
   * Seed initial content sources to the database
   */
  async seedContentSources() {
    logger.info('Seeding content sources');

    let seeded = 0;

    // Seed RSS sources
    for (const feed of DEFAULT_RSS_FEEDS) {
      await ContentSource.upsertSource({
        type: SOURCE_TYPE.RSS,
        ...feed,
        active: true,
        checkInterval: 30,
      });
      seeded++;
    }

    // Seed Reddit sources
    for (const sub of DEFAULT_SUBREDDITS) {
      await ContentSource.upsertSource({
        type: SOURCE_TYPE.REDDIT,
        ...sub,
        active: true,
        checkInterval: 30,
      });
      seeded++;
    }

    logger.info(`Seeded ${seeded} content sources`);

    return seeded;
  }

  /**
   * Get summary of all content sources
   * @returns {Object} - Summary
   */
  async getSourcesSummary() {
    const sources = await ContentSource.find({});

    const summary = {
      total: sources.length,
      active: sources.filter(s => s.active).length,
      byType: {},
      recentlyChecked: 0,
    };

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    for (const source of sources) {
      if (!summary.byType[source.type]) {
        summary.byType[source.type] = { count: 0, active: 0 };
      }
      summary.byType[source.type].count++;
      if (source.active) {
        summary.byType[source.type].active++;
      }
      if (source.lastCheckedAt && source.lastCheckedAt > oneHourAgo) {
        summary.recentlyChecked++;
      }
    }

    return summary;
  }
}

export default ContentRouter;
