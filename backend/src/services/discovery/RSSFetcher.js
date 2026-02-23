import Parser from 'rss-parser';
import Article from '../../models/Article.js';
import ContentSource from '../../models/ContentSource.js';
import { SOURCE_TYPE, SOURCE_QUALITY, SUMMARY_STATUS } from '../../config/constants.js';
import { normalizeUrl, sanitizeText } from '../../utils/helpers.js';
import { logger } from '../../utils/logger.js';
import { validateUrl } from '../../utils/urlValidator.js';

/**
 * RSSFetcher - Fetches and parses RSS feeds
 * Stores new articles in the database
 */
class RSSFetcher {
  constructor(options = {}) {
    this.parser = new Parser({
      timeout: options.timeout || 10000,
      headers: {
        'User-Agent': 'Curate/1.0 (News Aggregator)',
        'Accept': 'application/rss+xml, application/xml, text/xml',
      },
      customFields: {
        item: [
          ['media:content', 'mediaContent'],
          ['media:thumbnail', 'mediaThumbnail'],
          ['enclosure', 'enclosure'],
          ['dc:creator', 'creator'],
          ['content:encoded', 'contentEncoded'],
        ],
      },
    });
  }

  /**
   * Fetch and parse an RSS feed
   * @param {string} feedUrl - URL of the RSS feed
   * @returns {Array} - Array of parsed feed items
   */
  async fetchFeed(feedUrl) {
    try {
      logger.debug(`Fetching RSS feed: ${feedUrl}`);
      const feed = await this.parser.parseURL(feedUrl);

      logger.info(`Fetched ${feed.items?.length || 0} items from ${feed.title || feedUrl}`);

      return {
        title: feed.title,
        description: feed.description,
        link: feed.link,
        items: feed.items || [],
      };
    } catch (error) {
      logger.error(`Error fetching RSS feed: ${feedUrl}`, { error: error.message });
      throw error;
    }
  }

  /**
   * Map an RSS item to our Article schema
   * @param {Object} item - RSS feed item
   * @param {Object} source - Content source document
   * @returns {Object} - Article-formatted object
   */
  mapRSSItemToArticle(item, source) {
    // Extract image URL from various possible locations
    const imageUrl = this.extractImageUrl(item);

    // Extract author
    const author = item.creator || item.author || item['dc:creator'] || null;

    // Parse publish date
    const publishedAt = item.pubDate || item.isoDate
      ? new Date(item.pubDate || item.isoDate)
      : new Date();

    // Extract description (clean HTML if present)
    const description = sanitizeText(
      item.contentSnippet || item.summary || item.description || ''
    ).substring(0, 2000);

    // Infer topics from categories and source
    const topics = this.inferTopics(item, source);

    return {
      url: normalizeUrl(item.link),
      title: sanitizeText(item.title || 'Untitled'),
      description,
      imageUrl,
      author,
      source: {
        name: source.name,
        type: SOURCE_TYPE.RSS,
        url: source.identifier,
        quality: source.quality || SOURCE_QUALITY.TIER_2,
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
   * Extract image URL from RSS item
   * @param {Object} item - RSS feed item
   * @returns {string|null} - Image URL or null
   */
  extractImageUrl(item) {
    let url = null;

    // Try various common image locations
    if (item.mediaContent?.$.url) {
      url = item.mediaContent.$.url;
    } else if (item.mediaThumbnail?.$.url) {
      url = item.mediaThumbnail.$.url;
    } else if (item.enclosure?.url && item.enclosure.type?.startsWith('image/')) {
      url = item.enclosure.url;
    } else if (item['media:content']?.$.url) {
      url = item['media:content'].$.url;
    } else if (item.content || item.contentEncoded) {
      // Try to extract from content
      const content = item.content || item.contentEncoded;
      const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["']/i);
      if (imgMatch) {
        url = imgMatch[1];
      }
    }

    // Decode HTML entities in URL
    if (url) {
      url = url
        .replace(/&#038;/g, '&')
        .replace(/&amp;/g, '&')
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"');
    }

    return url;
  }

  /**
   * Infer topics from RSS item categories and source
   * @param {Object} item - RSS feed item
   * @param {Object} source - Content source
   * @returns {Array} - Array of topic objects
   */
  inferTopics(item, source) {
    const topics = new Map();

    // Add source topics with medium confidence
    if (source.topics) {
      for (const topic of source.topics) {
        topics.set(topic.toLowerCase(), { name: topic.toLowerCase(), confidence: 0.6 });
      }
    }

    // Add category from source
    if (source.category) {
      topics.set(source.category.toLowerCase(), {
        name: source.category.toLowerCase(),
        confidence: 0.7,
      });
    }

    // Add RSS item categories with higher confidence
    if (item.categories) {
      for (const category of item.categories) {
        const name = (typeof category === 'string' ? category : category.name || category._)
          ?.toLowerCase()
          ?.trim();
        if (name && name.length > 2 && name.length < 50) {
          topics.set(name, { name, confidence: 0.8 });
        }
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
      new: 0,
      duplicates: 0,
      invalid: 0,
      errors: [],
    };

    try {
      // Fetch the feed
      const feed = await this.fetchFeed(contentSource.identifier);
      stats.fetched = feed.items.length;

      // Process each item
      for (const item of feed.items) {
        try {
          // Skip items without links
          if (!item.link) {
            continue;
          }

          const articleData = this.mapRSSItemToArticle(item, contentSource);

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

          // Try to insert (will fail if duplicate URL)
          const result = await Article.findOneAndUpdate(
            { url: articleData.url },
            {
              $setOnInsert: articleData,
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
            url: item.link,
            error: itemError.message,
          });
        }
      }

      // Update source stats
      await contentSource.markSuccess(stats.new);

      logger.info(`RSS fetch complete: ${contentSource.name}`, stats);

    } catch (error) {
      await contentSource.markFailure(error);
      stats.errors.push({ error: error.message });
      logger.error(`RSS fetch failed: ${contentSource.name}`, { error: error.message });
    }

    return stats;
  }

  /**
   * Fetch from all active RSS sources
   * @returns {Object} - Aggregated stats
   */
  async fetchFromAllSources() {
    const sources = await ContentSource.getActiveByType(SOURCE_TYPE.RSS);

    logger.info(`Fetching from ${sources.length} RSS sources`);

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
    }

    logger.info('RSS fetch from all sources complete', {
      sources: results.totalSources,
      new: results.totalNew,
      duplicates: results.totalDuplicates,
    });

    return results;
  }
}

// Default RSS feeds for seeding
export const DEFAULT_RSS_FEEDS = [
  // Technology
  {
    name: 'TechCrunch',
    identifier: 'https://techcrunch.com/feed/',
    category: 'technology',
    topics: ['tech', 'startups', 'AI', 'venture capital'],
    quality: SOURCE_QUALITY.TIER_1,
  },
  {
    name: 'The Verge',
    identifier: 'https://www.theverge.com/rss/index.xml',
    category: 'technology',
    topics: ['tech', 'gadgets', 'reviews', 'culture'],
    quality: SOURCE_QUALITY.TIER_1,
  },
  {
    name: 'Ars Technica',
    identifier: 'https://feeds.arstechnica.com/arstechnica/index',
    category: 'technology',
    topics: ['tech', 'science', 'policy', 'gaming'],
    quality: SOURCE_QUALITY.TIER_1,
  },
  {
    name: 'Wired',
    identifier: 'https://www.wired.com/feed/rss',
    category: 'technology',
    topics: ['tech', 'science', 'culture', 'business'],
    quality: SOURCE_QUALITY.TIER_1,
  },
  {
    name: 'MIT Technology Review',
    identifier: 'https://www.technologyreview.com/feed/',
    category: 'technology',
    topics: ['AI', 'biotech', 'climate', 'computing'],
    quality: SOURCE_QUALITY.TIER_1,
  },
  {
    name: 'Hacker News',
    identifier: 'https://hnrss.org/frontpage',
    category: 'technology',
    topics: ['tech', 'startups', 'programming'],
    quality: SOURCE_QUALITY.TIER_2,
  },
  // Gaming News
  {
    name: 'IGN',
    identifier: 'https://feeds.feedburner.com/ign/all',
    category: 'gaming',
    topics: ['gaming', 'video games', 'reviews', 'esports'],
    quality: SOURCE_QUALITY.TIER_1,
  },
  {
    name: 'Kotaku',
    identifier: 'https://kotaku.com/rss',
    category: 'gaming',
    topics: ['gaming', 'video games', 'game culture'],
    quality: SOURCE_QUALITY.TIER_1,
  },
  {
    name: 'Polygon',
    identifier: 'https://www.polygon.com/rss/index.xml',
    category: 'gaming',
    topics: ['gaming', 'video games', 'entertainment'],
    quality: SOURCE_QUALITY.TIER_1,
  },
  {
    name: 'PC Gamer',
    identifier: 'https://www.pcgamer.com/rss/',
    category: 'gaming',
    topics: ['gaming', 'pc gaming', 'hardware', 'reviews'],
    quality: SOURCE_QUALITY.TIER_1,
  },
  {
    name: 'GameSpot',
    identifier: 'https://www.gamespot.com/feeds/mashup/',
    category: 'gaming',
    topics: ['gaming', 'video games', 'reviews', 'news'],
    quality: SOURCE_QUALITY.TIER_1,
  },
  {
    name: 'Rock Paper Shotgun',
    identifier: 'https://www.rockpapershotgun.com/feed',
    category: 'gaming',
    topics: ['gaming', 'pc gaming', 'indie games'],
    quality: SOURCE_QUALITY.TIER_2,
  },
  // AI Tools & AI News
  {
    name: 'OpenAI Blog',
    identifier: 'https://openai.com/blog/rss/',
    category: 'ai',
    topics: ['AI', 'AI tools', 'ChatGPT', 'large language models'],
    quality: SOURCE_QUALITY.TIER_1,
  },
  {
    name: 'Hugging Face Blog',
    identifier: 'https://huggingface.co/blog/feed.xml',
    category: 'ai',
    topics: ['AI', 'AI tools', 'machine learning', 'open source AI'],
    quality: SOURCE_QUALITY.TIER_1,
  },
  {
    name: 'AI News',
    identifier: 'https://www.artificialintelligence-news.com/feed/',
    category: 'ai',
    topics: ['AI', 'AI tools', 'machine learning', 'deep learning'],
    quality: SOURCE_QUALITY.TIER_2,
  },
  {
    name: 'VentureBeat AI',
    identifier: 'https://venturebeat.com/category/ai/feed/',
    category: 'ai',
    topics: ['AI', 'AI tools', 'enterprise AI', 'startups'],
    quality: SOURCE_QUALITY.TIER_1,
  },
  {
    name: 'The AI Blog',
    identifier: 'https://blogs.microsoft.com/ai/feed/',
    category: 'ai',
    topics: ['AI', 'AI tools', 'Microsoft AI', 'enterprise'],
    quality: SOURCE_QUALITY.TIER_1,
  },
  {
    name: 'Google AI Blog',
    identifier: 'https://blog.google/technology/ai/rss/',
    category: 'ai',
    topics: ['AI', 'AI tools', 'Google AI', 'machine learning'],
    quality: SOURCE_QUALITY.TIER_1,
  },
  // Anthropic / Claude AI
  {
    name: 'Anthropic News',
    identifier: 'https://www.anthropic.com/news/rss',
    category: 'ai',
    topics: ['Claude', 'Anthropic', 'AI', 'Claude AI', 'AI safety'],
    quality: SOURCE_QUALITY.TIER_1,
  },
  // More Gaming Sources
  {
    name: 'Eurogamer',
    identifier: 'https://www.eurogamer.net/feed',
    category: 'gaming',
    topics: ['gaming', 'video games', 'reviews', 'news'],
    quality: SOURCE_QUALITY.TIER_1,
  },
  {
    name: 'GamesRadar',
    identifier: 'https://www.gamesradar.com/rss/',
    category: 'gaming',
    topics: ['gaming', 'video games', 'reviews', 'guides'],
    quality: SOURCE_QUALITY.TIER_1,
  },
  {
    name: 'Destructoid',
    identifier: 'https://www.destructoid.com/feed/',
    category: 'gaming',
    topics: ['gaming', 'video games', 'reviews', 'indie'],
    quality: SOURCE_QUALITY.TIER_2,
  },
];

export default RSSFetcher;
