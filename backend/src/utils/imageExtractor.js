import axios from 'axios';
import { logger } from './logger.js';

const TIMEOUT_MS = 5000;
const USER_AGENT = 'Mozilla/5.0 (compatible; CurateBot/1.0)';

/**
 * Extract og:image or other image from an article URL
 * @param {string} url - Article URL
 * @returns {Promise<string|null>} - Image URL or null
 */
export async function extractOgImage(url) {
  if (!url) return null;

  try {
    const response = await axios.get(url, {
      timeout: TIMEOUT_MS,
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html',
      },
      maxRedirects: 5,
      validateStatus: (status) => status < 400,
    });

    const html = response.data;
    if (typeof html !== 'string') return null;

    // Try og:image first (most common)
    let match = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
    if (!match) {
      match = html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    }

    // Try twitter:image
    if (!match) {
      match = html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
      if (!match) {
        match = html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i);
      }
    }

    // Try article:image
    if (!match) {
      match = html.match(/<meta[^>]+property=["']article:image["'][^>]+content=["']([^"']+)["']/i);
    }

    if (match && match[1]) {
      let imageUrl = match[1];

      // Handle relative URLs
      if (imageUrl.startsWith('/')) {
        const urlObj = new URL(url);
        imageUrl = `${urlObj.protocol}//${urlObj.host}${imageUrl}`;
      }

      // Decode HTML entities
      imageUrl = imageUrl
        .replace(/&amp;/g, '&')
        .replace(/&#038;/g, '&')
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"');

      return imageUrl;
    }

    return null;
  } catch (error) {
    logger.debug(`Failed to extract og:image from ${url}`, { error: error.message });
    return null;
  }
}

/**
 * Get a category-based placeholder image URL
 * Uses Unsplash Source for free, high-quality images
 * @param {string} category - Article category
 * @returns {string} - Placeholder image URL
 */
export function getCategoryPlaceholder(category) {
  const categoryKeywords = {
    technology: 'technology,computer',
    gaming: 'gaming,video-game',
    ai: 'artificial-intelligence,robot',
    science: 'science,laboratory',
    business: 'business,office',
    programming: 'coding,programming',
    default: 'news,abstract',
  };

  const keywords = categoryKeywords[category?.toLowerCase()] || categoryKeywords.default;

  // Use a deterministic seed based on keywords to get consistent images
  return `https://source.unsplash.com/800x600/?${encodeURIComponent(keywords)}`;
}

export default { extractOgImage, getCategoryPlaceholder };
