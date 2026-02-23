/**
 * Normalize a URL for deduplication
 * Removes trailing slash and normalizes protocol/host casing.
 * Important: keeps path case intact (Google News article tokens are case-sensitive).
 */
export function normalizeUrl(url) {
  try {
    const parsed = new URL(url);

    // Google News RSS article redirect paths are case-sensitive and often require query params.
    const isGoogleNewsArticleLink =
      parsed.hostname.includes('news.google.com') &&
      parsed.pathname.startsWith('/rss/articles/');

    const protocol = parsed.protocol.toLowerCase();
    const host = parsed.host.toLowerCase();

    // Preserve pathname case; only trim trailing slash.
    let pathname = parsed.pathname.replace(/\/$/, '');
    if (!pathname) pathname = '/';

    let normalized = `${protocol}//${host}${pathname}`;

    // Keep locale/query parameters for Google News article URLs.
    if (isGoogleNewsArticleLink && parsed.search) {
      normalized += parsed.search;
    }

    return normalized;
  } catch {
    // Fallback: do not lowercase entire URL, path segments can be case-sensitive.
    return (url || '').trim().replace(/\/$/, '');
  }
}

/**
 * Calculate reading time in minutes based on word count
 * Average reading speed: 200-250 words per minute
 */
export function calculateReadingTime(text) {
  if (!text) return 1;
  const wordCount = text.split(/\s+/).length;
  const readingTime = Math.ceil(wordCount / 225);
  return Math.max(1, readingTime);
}

/**
 * Count words in text
 */
export function countWords(text) {
  if (!text) return 0;
  return text.split(/\s+/).filter(word => word.length > 0).length;
}

/**
 * Truncate text to a maximum number of words
 */
export function truncateToWords(text, maxWords) {
  if (!text) return '';
  const words = text.split(/\s+/);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(' ') + '...';
}

/**
 * Generate a cursor for pagination
 * Encodes score and ID for stable cursor-based pagination
 */
export function generateCursor(score, id) {
  const cursor = { score, id: id.toString() };
  return Buffer.from(JSON.stringify(cursor)).toString('base64');
}

/**
 * Parse a pagination cursor
 */
export function parseCursor(cursor) {
  try {
    const decoded = Buffer.from(cursor, 'base64').toString('utf8');
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

/**
 * Calculate hours since a date
 */
export function hoursSince(date) {
  const now = new Date();
  const then = new Date(date);
  return (now - then) / (1000 * 60 * 60);
}

/**
 * Format a date as relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(date) {
  const hours = hoursSince(date);

  if (hours < 1) {
    const minutes = Math.floor(hours * 60);
    return minutes <= 1 ? 'just now' : `${minutes} minutes ago`;
  }
  if (hours < 24) {
    const h = Math.floor(hours);
    return h === 1 ? '1 hour ago' : `${h} hours ago`;
  }
  if (hours < 48) {
    return 'yesterday';
  }
  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days} days ago`;
  }
  const weeks = Math.floor(days / 7);
  if (weeks < 4) {
    return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
  }
  const months = Math.floor(days / 30);
  return months === 1 ? '1 month ago' : `${months} months ago`;
}

/**
 * Sleep for a specified number of milliseconds
 * Useful for rate limiting
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

/**
 * Extract domain from URL
 */
export function extractDomain(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace('www.', '');
  } catch {
    return null;
  }
}

/**
 * Check if a string looks like a person or company name
 * (for routing to Google News)
 */
export function looksLikeProperNoun(text) {
  // Simple heuristic: starts with capital letter, multiple words
  const words = text.trim().split(/\s+/);
  if (words.length < 2) return false;
  return words.every(word => /^[A-Z]/.test(word));
}

/**
 * Sanitize text for database storage
 * Removes null bytes and normalizes whitespace
 */
export function sanitizeText(text) {
  if (!text) return '';
  return text
    .replace(/\0/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
