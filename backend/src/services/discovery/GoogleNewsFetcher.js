import Parser from 'rss-parser';
import Article from '../../models/Article.js';
import { SOURCE_TYPE, SOURCE_QUALITY, SUMMARY_STATUS } from '../../config/constants.js';
import { normalizeUrl, sanitizeText, sleep } from '../../utils/helpers.js';
import { logger } from '../../utils/logger.js';

/**
 * GoogleNewsFetcher - Fetches news from Google News RSS
 * Uses search queries to find relevant news articles
 */
class GoogleNewsFetcher {
  constructor(options = {}) {
    this.parser = new Parser({
      timeout: options.timeout || 15000,
      headers: {
        'User-Agent': 'Curate/1.0 (News Aggregator)',
      },
    });
    this.baseUrl = 'https://news.google.com/rss';
    this.delayMs = options.delayMs || 1000;
  }

  /**
   * Decode Google News RSS redirect URL payload.
   * This is much faster than network redirect resolution and keeps live search fast.
   * @param {string} googleUrl
   * @returns {string|null}
   */
  decodeGoogleNewsUrl(googleUrl) {
    try {
      const match = googleUrl.match(/\/rss\/articles\/([^?]+)/);
      if (!match) return null;

      let encoded = match[1];
      encoded = encoded.replace(/-/g, '+').replace(/_/g, '/');
      while (encoded.length % 4) {
        encoded += '=';
      }

      const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
      const urlMatch = decoded.match(/https?:\/\/[^\s\x00-\x1f]+/);
      if (!urlMatch) return null;

      return urlMatch[0]
        .replace(/[\x00-\x1f]/g, '')
        .split(/[\s"'>]/)[0];
    } catch {
      return null;
    }
  }

  /**
   * Build Google News RSS search URL
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {string} - RSS feed URL
   */
  buildSearchUrl(query, options = {}) {
    const {
      language = 'en',
      country = 'US',
      when = null, // e.g., '1d', '7d', '1h'
    } = options;

    // Encode the query properly
    const encodedQuery = encodeURIComponent(query);

    let url = `${this.baseUrl}/search?q=${encodedQuery}&hl=${language}&gl=${country}&ceid=${country}:${language}`;

    // Add time filter if specified
    if (when) {
      url += `&when=${when}`;
    }

    return url;
  }

  /**
   * Build Google News RSS topic URL
   * @param {string} topic - Topic code (e.g., 'TECHNOLOGY', 'SCIENCE')
   * @param {Object} options - Options
   * @returns {string} - RSS feed URL
   */
  buildTopicUrl(topic, options = {}) {
    const { language = 'en', country = 'US' } = options;

    // Google News topic codes
    const topicCodes = {
      WORLD: 'WORLD',
      NATION: 'NATION',
      BUSINESS: 'BUSINESS',
      TECHNOLOGY: 'TECHNOLOGY',
      ENTERTAINMENT: 'ENTERTAINMENT',
      SPORTS: 'SPORTS',
      SCIENCE: 'SCIENCE',
      HEALTH: 'HEALTH',
    };

    const topicCode = topicCodes[topic.toUpperCase()] || topic;

    return `${this.baseUrl}/headlines/section/topic/${topicCode}?hl=${language}&gl=${country}&ceid=${country}:${language}`;
  }

  /**
   * Search Google News for a query
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Object} - Feed data with items
   */
  async searchNews(query, options = {}) {
    const url = this.buildSearchUrl(query, options);

    try {
      logger.debug(`Fetching Google News: ${query}`);

      const feed = await this.parser.parseURL(url);

      logger.info(`Google News: Found ${feed.items?.length || 0} results for "${query}"`);

      return {
        query,
        title: feed.title,
        items: feed.items || [],
      };
    } catch (error) {
      logger.error(`Google News search failed: ${query}`, { error: error.message });
      throw error;
    }
  }

  /**
   * Get top headlines for a topic
   * @param {string} topic - Topic name
   * @param {Object} options - Options
   * @returns {Object} - Feed data
   */
  async getTopicHeadlines(topic, options = {}) {
    const url = this.buildTopicUrl(topic, options);

    try {
      logger.debug(`Fetching Google News topic: ${topic}`);

      const feed = await this.parser.parseURL(url);

      logger.info(`Google News: Found ${feed.items?.length || 0} headlines for ${topic}`);

      return {
        topic,
        title: feed.title,
        items: feed.items || [],
      };
    } catch (error) {
      logger.error(`Google News topic fetch failed: ${topic}`, { error: error.message });
      throw error;
    }
  }

  /**
   * Extract the actual article URL from Google News redirect URL
   * Google News URLs contain base64-encoded article URLs
   * @param {string} googleUrl - Google News URL
   * @returns {Promise<string>} - Original article URL
   */
  async extractOriginalUrl(googleUrl) {
    // Google News URLs are redirects like:
    // https://news.google.com/rss/articles/CBMi...

    if (!googleUrl.includes('news.google.com/rss/articles/')) {
      return googleUrl;
    }

    // Fast path: decode payload directly (no request needed).
    const decodedUrl = this.decodeGoogleNewsUrl(googleUrl);
    if (decodedUrl) {
      return decodedUrl;
    }

    try {
      // Follow the redirect to get the actual URL
      const response = await fetch(googleUrl, {
        method: 'HEAD',
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Curate/1.0)',
        },
      });

      // The final URL after redirects is the actual article
      if (response.url && !response.url.includes('news.google.com')) {
        return response.url;
      }

      return googleUrl;
    } catch (error) {
      logger.debug(`Could not resolve Google News URL: ${error.message}`);
      return googleUrl;
    }
  }

  /**
   * Extract source name from Google News item
   * @param {Object} item - RSS item
   * @returns {string} - Source name
   */
  extractSourceName(item) {
    // Google News includes source in title like: "Article Title - Source Name"
    if (item.title) {
      const parts = item.title.split(' - ');
      if (parts.length > 1) {
        return parts[parts.length - 1].trim();
      }
    }

    // Try source field
    if (item.source) {
      return typeof item.source === 'string' ? item.source : item.source.title || item.source.name;
    }

    return 'Google News';
  }

  /**
   * Extract clean title (without source suffix)
   * @param {Object} item - RSS item
   * @returns {string} - Clean title
   */
  extractCleanTitle(item) {
    if (item.title) {
      const parts = item.title.split(' - ');
      if (parts.length > 1) {
        // Remove the last part (source name)
        return parts.slice(0, -1).join(' - ').trim();
      }
      return item.title;
    }
    return 'Untitled';
  }

  /**
   * Map a Google News item to our Article schema
   * @param {Object} item - RSS item
   * @param {string} query - Search query used
   * @param {string} resolvedUrl - The resolved actual article URL
   * @returns {Object} - Article-formatted object
   */
  mapGoogleNewsItemToArticle(item, query, resolvedUrl) {
    const sourceName = this.extractSourceName(item);
    const title = this.extractCleanTitle(item);

    // Parse publish date
    const publishedAt = item.pubDate || item.isoDate
      ? new Date(item.pubDate || item.isoDate)
      : new Date();

    // Infer topics from query
    const topics = [
      { name: query.toLowerCase(), confidence: 0.9 },
    ];

    // Add common topic mappings
    const queryLower = query.toLowerCase();
    if (queryLower.includes('ai') || queryLower.includes('artificial intelligence')) {
      topics.push({ name: 'artificial intelligence', confidence: 0.85 });
      topics.push({ name: 'technology', confidence: 0.7 });
    }
    if (queryLower.includes('tech')) {
      topics.push({ name: 'technology', confidence: 0.8 });
    }

    return {
      url: normalizeUrl(resolvedUrl || item.link),
      title: sanitizeText(title),
      description: sanitizeText(item.contentSnippet || item.content || '').substring(0, 500),
      imageUrl: null, // Google News RSS doesn't typically include images
      author: null,
      source: {
        name: sourceName,
        type: SOURCE_TYPE.GOOGLE_NEWS,
        url: 'https://news.google.com',
        quality: SOURCE_QUALITY.TIER_2, // Variable quality from aggregation
      },
      publishedAt,
      discoveredAt: new Date(),
      topics,
      summaryStatus: SUMMARY_STATUS.PENDING,
      content: {
        text: null,
        wordCount: 0,
        readingTimeMinutes: 0,
      },
    };
  }

  /**
   * Search and save articles for a query
   * @param {string} query - Search query
   * @param {Object} options - Options
   * @returns {Object} - Stats
   */
  async searchAndSaveArticles(query, options = {}) {
    const { resolveUrls = true, maxItems = null } = options;
    const stats = {
      query,
      fetched: 0,
      new: 0,
      duplicates: 0,
      errors: [],
    };

    try {
      const result = await this.searchNews(query, options);
      stats.fetched = result.items.length;

      const items = typeof maxItems === 'number' && maxItems > 0
        ? result.items.slice(0, maxItems)
        : result.items;

      for (const item of items) {
        try {
          if (!item.link) continue;

          // Resolve the actual article URL from Google News redirect
          let resolvedUrl = item.link;
          if (resolveUrls && item.link.includes('news.google.com')) {
            resolvedUrl = await this.extractOriginalUrl(item.link);
          }

          const articleData = this.mapGoogleNewsItemToArticle(item, query, resolvedUrl);

          const dbResult = await Article.findOneAndUpdate(
            { url: articleData.url },
            { $setOnInsert: articleData },
            { upsert: true, new: true, rawResult: true }
          );

          if (dbResult.lastErrorObject?.updatedExisting) {
            stats.duplicates++;
          } else {
            stats.new++;
          }
        } catch (itemError) {
          stats.errors.push({ url: item.link, error: itemError.message });
        }
      }

      logger.info(`Google News search complete: "${query}"`, stats);

    } catch (error) {
      stats.errors.push({ error: error.message });
      logger.error(`Google News search failed: "${query}"`, { error: error.message });
    }

    return stats;
  }

  /**
   * Fetch articles for multiple queries
   * @param {Array} queries - Array of search queries
   * @param {Object} options - Options
   * @returns {Object} - Aggregated stats
   */
  async fetchForQueries(queries, options = {}) {
    const { delayMs = this.delayMs } = options;
    const results = {
      totalQueries: queries.length,
      totalFetched: 0,
      totalNew: 0,
      totalDuplicates: 0,
      errors: [],
      byQuery: [],
    };

    for (const query of queries) {
      const stats = await this.searchAndSaveArticles(query, options);

      results.totalFetched += stats.fetched;
      results.totalNew += stats.new;
      results.totalDuplicates += stats.duplicates;
      results.errors.push(...stats.errors);
      results.byQuery.push(stats);

      // Rate limiting
      if (delayMs > 0) {
        await sleep(delayMs);
      }
    }

    logger.info('Google News fetch complete', {
      queries: results.totalQueries,
      new: results.totalNew,
    });

    return results;
  }

  /**
   * Generate search queries from user preferences
   * @param {Array} preferences - User preferences
   * @returns {Array} - Search queries
   */
  generateQueriesFromPreferences(preferences) {
    const queries = [];

    for (const pref of preferences) {
      // Only use high-weight preferences for Google News
      if (pref.weight >= 0.5) {
        queries.push(pref.preferenceValue);
      }
    }

    // Deduplicate
    return [...new Set(queries)];
  }
}

// Common search queries for news discovery
export const DEFAULT_NEWS_QUERIES = [
  // Technology
  'artificial intelligence',
  'machine learning',
  'technology news',
  'startup funding',
  'cybersecurity',
  'space exploration',
  // Gaming - Comprehensive
  'video game news',
  'gaming industry news',
  'esports tournaments',
  'PlayStation 5 news',
  'Xbox Series X news',
  'Nintendo Switch 2',
  'new game releases 2026',
  'indie games reviews',
  'PC gaming hardware',
  'Steam game news',
  'gaming deals sales',
  'Elden Ring DLC',
  'GTA 6 news',
  // Claude AI & Anthropic - Specific
  'Claude AI',
  'Anthropic AI',
  'Claude chatbot',
  'Claude 3 Opus',
  'Claude Sonnet',
  'Anthropic news',
  'Claude vs ChatGPT',
  'Claude Code',
  'Anthropic funding',
  // Other AI Tools
  'ChatGPT news',
  'OpenAI news',
  'Gemini AI Google',
  'Copilot Microsoft AI',
  'Midjourney AI art',
  'Stable Diffusion',
  'AI coding assistants',
  'large language models',
  'generative AI startups',
  'AI agents autonomous',
];

export default GoogleNewsFetcher;
