import axios from 'axios';
import * as cheerio from 'cheerio';
import { calculateReadingTime, countWords, sanitizeText } from '../../utils/helpers.js';
import { logger } from '../../utils/logger.js';

/**
 * ArticleExtractor - Extracts full article content from URLs
 * Uses cheerio to parse HTML and extract main content
 */
class ArticleExtractor {
  constructor(options = {}) {
    this.timeout = options.timeout || 15000;
    this.userAgent = options.userAgent ||
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  }

  /**
   * Fetch HTML content from a URL
   * @param {string} url - Article URL
   * @returns {string} - HTML content
   */
  async fetchHtml(url) {
    try {
      const response = await axios.get(url, {
        timeout: this.timeout,
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
        maxRedirects: 5,
      });

      return response.data;
    } catch (error) {
      logger.error(`Failed to fetch URL: ${url}`, { error: error.message });
      throw error;
    }
  }

  /**
   * Extract article content from HTML
   * @param {string} html - HTML content
   * @param {string} url - Original URL (for context)
   * @returns {Object} - Extracted content
   */
  extractContent(html, url) {
    const $ = cheerio.load(html);

    // Remove unwanted elements
    this.removeUnwantedElements($);

    // Try multiple strategies to find main content
    const content = this.findMainContent($);

    // Extract metadata
    const metadata = this.extractMetadata($, url);

    // Calculate stats
    const wordCount = countWords(content);
    const readingTimeMinutes = calculateReadingTime(content);

    return {
      text: sanitizeText(content),
      wordCount,
      readingTimeMinutes,
      ...metadata,
    };
  }

  /**
   * Remove unwanted elements from the DOM
   * @param {CheerioAPI} $ - Cheerio instance
   */
  removeUnwantedElements($) {
    // Remove scripts, styles, comments
    $('script').remove();
    $('style').remove();
    $('noscript').remove();

    // Remove navigation and footer
    $('nav').remove();
    $('header').remove();
    $('footer').remove();
    $('aside').remove();

    // Remove ads and social elements
    $('[class*="ad-"]').remove();
    $('[class*="advertisement"]').remove();
    $('[class*="social"]').remove();
    $('[class*="share"]').remove();
    $('[class*="related"]').remove();
    $('[class*="comment"]').remove();
    $('[class*="newsletter"]').remove();
    $('[class*="subscribe"]').remove();
    $('[class*="sidebar"]').remove();
    $('[class*="popup"]').remove();
    $('[class*="modal"]').remove();

    // Remove by ID patterns
    $('[id*="ad-"]').remove();
    $('[id*="sidebar"]').remove();
    $('[id*="comment"]').remove();
    $('[id*="footer"]').remove();
    $('[id*="header"]').remove();

    // Remove common ad elements
    $('iframe').remove();
    $('.ad').remove();
    $('.ads').remove();
    $('.adsbygoogle').remove();
  }

  /**
   * Find the main content of the article
   * @param {CheerioAPI} $ - Cheerio instance
   * @returns {string} - Main content text
   */
  findMainContent($) {
    // Strategy 1: Look for article element
    let content = $('article').text();
    if (content && content.length > 200) {
      return content;
    }

    // Strategy 2: Look for common content class names
    const contentSelectors = [
      '.article-content',
      '.article-body',
      '.post-content',
      '.entry-content',
      '.content-body',
      '.story-body',
      '.article__body',
      '[itemprop="articleBody"]',
      '.post-body',
      '.article-text',
      'main',
      '#content',
      '.content',
    ];

    for (const selector of contentSelectors) {
      content = $(selector).text();
      if (content && content.length > 200) {
        return content;
      }
    }

    // Strategy 3: Find the element with the most paragraph text
    let bestContent = '';
    let maxLength = 0;

    $('div, section').each((_, element) => {
      const paragraphs = $(element).find('p');
      let totalText = '';

      paragraphs.each((_, p) => {
        totalText += $(p).text() + ' ';
      });

      if (totalText.length > maxLength) {
        maxLength = totalText.length;
        bestContent = totalText;
      }
    });

    if (bestContent && bestContent.length > 200) {
      return bestContent;
    }

    // Strategy 4: Just get all paragraph text
    const paragraphs = [];
    $('p').each((_, element) => {
      const text = $(element).text().trim();
      if (text.length > 50) { // Skip short paragraphs (likely captions, etc.)
        paragraphs.push(text);
      }
    });

    return paragraphs.join('\n\n');
  }

  /**
   * Extract metadata from the page
   * @param {CheerioAPI} $ - Cheerio instance
   * @param {string} url - Original URL
   * @returns {Object} - Metadata
   */
  extractMetadata($, url) {
    const metadata = {
      title: null,
      description: null,
      author: null,
      imageUrl: null,
      publishedAt: null,
    };

    // Title
    metadata.title =
      $('meta[property="og:title"]').attr('content') ||
      $('meta[name="twitter:title"]').attr('content') ||
      $('title').text() ||
      $('h1').first().text();

    // Description
    metadata.description =
      $('meta[property="og:description"]').attr('content') ||
      $('meta[name="description"]').attr('content') ||
      $('meta[name="twitter:description"]').attr('content');

    // Author
    metadata.author =
      $('meta[name="author"]').attr('content') ||
      $('meta[property="article:author"]').attr('content') ||
      $('[rel="author"]').text() ||
      $('[class*="author"]').first().text() ||
      $('[itemprop="author"]').text();

    // Image
    metadata.imageUrl =
      $('meta[property="og:image"]').attr('content') ||
      $('meta[name="twitter:image"]').attr('content') ||
      $('meta[property="og:image:url"]').attr('content');

    // Published date
    const dateString =
      $('meta[property="article:published_time"]').attr('content') ||
      $('meta[name="date"]').attr('content') ||
      $('time[datetime]').attr('datetime') ||
      $('[itemprop="datePublished"]').attr('content');

    if (dateString) {
      try {
        metadata.publishedAt = new Date(dateString);
      } catch (e) {
        // Invalid date, ignore
      }
    }

    // Clean up metadata
    if (metadata.title) {
      metadata.title = sanitizeText(metadata.title).substring(0, 500);
    }
    if (metadata.description) {
      metadata.description = sanitizeText(metadata.description).substring(0, 2000);
    }
    if (metadata.author) {
      metadata.author = sanitizeText(metadata.author).substring(0, 200);
    }

    return metadata;
  }

  /**
   * Extract full content from a URL
   * @param {string} url - Article URL
   * @returns {Object} - Extracted content and metadata
   */
  async extract(url) {
    try {
      logger.debug(`Extracting content from: ${url}`);

      const html = await this.fetchHtml(url);
      const content = this.extractContent(html, url);

      logger.info(`Extracted ${content.wordCount} words from ${url}`);

      return {
        success: true,
        ...content,
      };
    } catch (error) {
      logger.error(`Failed to extract content: ${url}`, { error: error.message });

      return {
        success: false,
        error: error.message,
        text: null,
        wordCount: 0,
        readingTimeMinutes: 0,
      };
    }
  }

  /**
   * Extract content and update an article document
   * @param {Object} article - Article document
   * @returns {Object} - Updated article
   */
  async extractAndUpdate(article) {
    const extracted = await this.extract(article.url);

    if (extracted.success && extracted.text) {
      article.content = {
        text: extracted.text.substring(0, 50000), // Limit stored content
        wordCount: extracted.wordCount,
        readingTimeMinutes: extracted.readingTimeMinutes,
      };

      // Update metadata if better than existing
      if (!article.title && extracted.title) {
        article.title = extracted.title;
      }
      if (!article.description && extracted.description) {
        article.description = extracted.description;
      }
      if (!article.author && extracted.author) {
        article.author = extracted.author;
      }
      if (!article.imageUrl && extracted.imageUrl) {
        article.imageUrl = extracted.imageUrl;
      }

      await article.save();
    }

    return article;
  }
}

export default ArticleExtractor;
