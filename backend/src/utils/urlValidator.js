import axios from 'axios';
import { logger } from './logger.js';

/**
 * URL Validator - Checks if URLs are accessible before saving articles
 */

const TIMEOUT_MS = 5000;
const USER_AGENT = 'Mozilla/5.0 (compatible; CurateBot/1.0)';

// Domains known to block HEAD requests or bots
const SKIP_VALIDATION_DOMAINS = [
  'reddit.com',
  'old.reddit.com',
  'twitter.com',
  'x.com',
  'facebook.com',
  'instagram.com',
  'linkedin.com',
];

/**
 * Check if a URL is accessible
 * @param {string} url - URL to validate
 * @returns {Promise<{valid: boolean, status?: number, error?: string}>}
 */
export async function validateUrl(url) {
  if (!url) {
    return { valid: false, error: 'No URL provided' };
  }

  try {
    const urlObj = new URL(url);

    // Skip validation for known problematic domains
    const shouldSkip = SKIP_VALIDATION_DOMAINS.some(domain =>
      urlObj.hostname.includes(domain)
    );

    if (shouldSkip) {
      return { valid: true, skipped: true };
    }

    // Try HEAD request first (faster)
    try {
      const response = await axios.head(url, {
        timeout: TIMEOUT_MS,
        headers: { 'User-Agent': USER_AGENT },
        maxRedirects: 5,
        validateStatus: (status) => status < 400,
      });

      return { valid: true, status: response.status };
    } catch (headError) {
      // Some servers don't support HEAD, try GET
      const response = await axios.get(url, {
        timeout: TIMEOUT_MS,
        headers: { 'User-Agent': USER_AGENT },
        maxRedirects: 5,
        validateStatus: (status) => status < 400,
        // Only get headers, don't download body
        responseType: 'stream',
      });

      // Immediately destroy the stream to avoid downloading
      response.data.destroy();

      return { valid: true, status: response.status };
    }
  } catch (error) {
    const status = error.response?.status;
    const errorMsg = status ? `HTTP ${status}` : error.message;

    logger.debug(`URL validation failed: ${url}`, { error: errorMsg });

    return {
      valid: false,
      status,
      error: errorMsg,
    };
  }
}

/**
 * Filter an array of articles, keeping only those with valid URLs
 * @param {Array} articles - Array of article objects with url property
 * @param {Object} options - Options
 * @returns {Promise<{valid: Array, invalid: Array}>}
 */
export async function filterValidUrls(articles, options = {}) {
  const { concurrency = 5, onProgress } = options;

  const results = {
    valid: [],
    invalid: [],
  };

  // Process in batches for concurrency control
  for (let i = 0; i < articles.length; i += concurrency) {
    const batch = articles.slice(i, i + concurrency);

    const validations = await Promise.all(
      batch.map(async (article) => {
        const result = await validateUrl(article.url);
        return { article, result };
      })
    );

    for (const { article, result } of validations) {
      if (result.valid) {
        results.valid.push(article);
      } else {
        results.invalid.push({
          article,
          reason: result.error,
          status: result.status,
        });
      }
    }

    if (onProgress) {
      onProgress(Math.min(i + concurrency, articles.length), articles.length);
    }
  }

  logger.info(`URL validation complete`, {
    total: articles.length,
    valid: results.valid.length,
    invalid: results.invalid.length,
  });

  return results;
}

export default { validateUrl, filterValidUrls };
