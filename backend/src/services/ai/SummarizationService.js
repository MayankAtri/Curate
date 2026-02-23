import { GoogleGenerativeAI } from '@google/generative-ai';
import Article from '../../models/Article.js';
import ArticleExtractor from '../content/ArticleExtractor.js';
import { SUMMARY_STATUS, RATE_LIMITS } from '../../config/constants.js';
import { truncateToWords, sleep } from '../../utils/helpers.js';
import { logger } from '../../utils/logger.js';

/**
 * SummarizationService - Uses Gemini AI to generate article summaries
 */
class SummarizationService {
  constructor(options = {}) {
    const apiKey = options.apiKey || process.env.GEMINI_API_KEY;
    const modelName = options.model || process.env.GEMINI_MODEL || 'gemini-2.0-flash';

    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is required');
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: modelName });
    this.articleExtractor = new ArticleExtractor();

    // Configuration
    this.maxArticleWords = options.maxArticleWords || 4000;
    this.delayMs = options.delayMs || RATE_LIMITS.GEMINI_DELAY_MS;
    this.maxRetries = options.maxRetries || 3;

    logger.info(`SummarizationService initialized with model: ${modelName}`);
  }

  /**
   * Build the summarization prompt
   * @param {string} articleText - Article content
   * @param {string} title - Article title
   * @returns {string} - Prompt
   */
  buildPrompt(articleText, title) {
    return `You are a professional news summarization assistant. Your task is to create a comprehensive yet readable summary of the following news article.

ARTICLE TITLE: ${title}

ARTICLE CONTENT:
${articleText}

Please provide:
1. A detailed paragraph summary (4-6 sentences, approximately 80-120 words) that:
   - Opens with the main news/event
   - Explains the context and significance
   - Includes key details, numbers, or quotes if relevant
   - Concludes with implications or what happens next

2. Exactly 3 key bullet points (each 1-2 sentences) highlighting the most important takeaways

Format your response EXACTLY as follows (keep the labels):
SUMMARY: [Your detailed paragraph summary here - must be 4-6 sentences]

KEY POINTS:
- [First key point with context]
- [Second key point with context]
- [Third key point with context]

Important:
- Write in a professional, journalistic tone
- Be factual and objective - no opinions
- Include specific details, names, numbers when available
- Make the summary self-contained and informative
- Do NOT start with "This article discusses" or similar meta-phrases
- Start directly with the news itself`;
  }

  /**
   * Parse Gemini's response into structured data
   * @param {string} response - Raw response text
   * @returns {Object} - Parsed summary object
   */
  parseResponse(response) {
    const result = {
      text: '',
      keyPoints: [],
    };

    try {
      // Extract summary
      const summaryMatch = response.match(/SUMMARY:\s*(.+?)(?=KEY POINTS:|$)/si);
      if (summaryMatch) {
        result.text = summaryMatch[1].trim();
      }

      // Extract key points
      const keyPointsMatch = response.match(/KEY POINTS:\s*([\s\S]+)$/i);
      if (keyPointsMatch) {
        const pointsText = keyPointsMatch[1];
        const points = pointsText.match(/[-•]\s*(.+)/g);
        if (points) {
          result.keyPoints = points
            .map(p => p.replace(/^[-•]\s*/, '').trim())
            .filter(p => p.length > 0)
            .slice(0, 3);
        }
      }

      // Fallback: if parsing failed, use the whole response as summary
      if (!result.text && response.length > 0) {
        result.text = response.substring(0, 500);
      }

    } catch (error) {
      logger.error('Error parsing Gemini response', { error: error.message });
      result.text = response.substring(0, 500);
    }

    return result;
  }

  /**
   * Generate summary for article text
   * @param {string} articleText - Article content
   * @param {string} title - Article title
   * @returns {Object} - Summary object
   */
  async generateSummary(articleText, title) {
    // Truncate if too long
    const truncatedText = truncateToWords(articleText, this.maxArticleWords);

    const prompt = this.buildPrompt(truncatedText, title);

    let lastError;
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const result = await this.model.generateContent(prompt);
        const response = result.response.text();

        const parsed = this.parseResponse(response);

        logger.debug('Summary generated', {
          title: title.substring(0, 50),
          summaryLength: parsed.text.length,
          keyPoints: parsed.keyPoints.length,
        });

        return {
          success: true,
          ...parsed,
          generatedAt: new Date(),
        };

      } catch (error) {
        lastError = error;
        logger.warn(`Gemini API attempt ${attempt + 1} failed`, {
          error: error.message,
        });

        // Wait before retry with exponential backoff
        if (attempt < this.maxRetries - 1) {
          await sleep(this.delayMs * Math.pow(2, attempt));
        }
      }
    }

    logger.error('All Gemini API attempts failed', { error: lastError?.message });
    return {
      success: false,
      error: lastError?.message || 'Unknown error',
    };
  }

  /**
   * Summarize a single article
   * @param {Object} article - Article document
   * @param {Object} options - Options
   * @returns {Object} - Updated article
   */
  async summarizeArticle(article, options = {}) {
    const { extractContent = true } = options;

    try {
      logger.info(`Summarizing article: ${article.title?.substring(0, 50)}...`);

      // Get article content
      let articleText = article.content?.text;

      // If no content, try to extract it
      if (!articleText && extractContent) {
        logger.debug('Extracting content for article');
        const extracted = await this.articleExtractor.extract(article.url);
        if (extracted.success && extracted.text) {
          articleText = extracted.text;

          // Update article with extracted content
          article.content = {
            text: extracted.text.substring(0, 50000),
            wordCount: extracted.wordCount,
            readingTimeMinutes: extracted.readingTimeMinutes,
          };
        }
      }

      // Fallback to description if no content
      if (!articleText) {
        articleText = article.description || article.title;
      }

      // Generate summary
      const result = await this.generateSummary(articleText, article.title);

      if (result.success) {
        article.summary = {
          text: result.text,
          keyPoints: result.keyPoints,
          generatedAt: result.generatedAt,
        };
        article.summaryStatus = SUMMARY_STATUS.COMPLETED;

        logger.info(`Summary completed for: ${article.title?.substring(0, 40)}...`);
      } else {
        // Use description as fallback
        if (article.description) {
          article.summary = {
            text: article.description,
            keyPoints: [],
            generatedAt: new Date(),
          };
          article.summaryStatus = SUMMARY_STATUS.COMPLETED;
          logger.info('Used description as fallback summary');
        } else {
          article.summaryStatus = SUMMARY_STATUS.FAILED;
          logger.warn(`Summary failed for: ${article.title?.substring(0, 40)}...`);
        }
      }

      await article.save();
      return article;

    } catch (error) {
      logger.error(`Error summarizing article: ${article._id}`, {
        error: error.message,
      });

      article.summaryStatus = SUMMARY_STATUS.FAILED;
      await article.save();

      throw error;
    }
  }

  /**
   * Summarize multiple articles in batch
   * @param {Array} articleIds - Array of article IDs
   * @param {Object} options - Options
   * @returns {Object} - Batch results
   */
  async summarizeBatch(articleIds, options = {}) {
    const { delayMs = this.delayMs } = options;

    const results = {
      total: articleIds.length,
      success: 0,
      failed: 0,
      skipped: 0,
      errors: [],
    };

    for (const articleId of articleIds) {
      try {
        const article = await Article.findById(articleId);

        if (!article) {
          results.skipped++;
          continue;
        }

        if (article.summaryStatus === SUMMARY_STATUS.COMPLETED) {
          results.skipped++;
          continue;
        }

        await this.summarizeArticle(article);
        results.success++;

        // Rate limiting
        await sleep(delayMs);

      } catch (error) {
        results.failed++;
        results.errors.push({
          articleId: articleId.toString(),
          error: error.message,
        });
      }
    }

    logger.info('Batch summarization complete', results);
    return results;
  }

  /**
   * Summarize all pending articles
   * @param {number} limit - Maximum articles to process
   * @param {Object} options - Options
   * @returns {Object} - Results
   */
  async summarizePendingArticles(limit = 50, options = {}) {
    logger.info(`Starting summarization of up to ${limit} pending articles`);

    // Find pending articles
    const articles = await Article.find({
      summaryStatus: SUMMARY_STATUS.PENDING,
    })
      .sort({ publishedAt: -1 }) // Newest first
      .limit(limit)
      .select('_id');

    if (articles.length === 0) {
      logger.info('No pending articles to summarize');
      return { total: 0, success: 0, failed: 0, skipped: 0 };
    }

    const articleIds = articles.map(a => a._id);
    return this.summarizeBatch(articleIds, options);
  }

  /**
   * Get summarization statistics
   * @returns {Object} - Stats
   */
  async getStats() {
    const [pending, completed, failed, total] = await Promise.all([
      Article.countDocuments({ summaryStatus: SUMMARY_STATUS.PENDING }),
      Article.countDocuments({ summaryStatus: SUMMARY_STATUS.COMPLETED }),
      Article.countDocuments({ summaryStatus: SUMMARY_STATUS.FAILED }),
      Article.countDocuments(),
    ]);

    return {
      total,
      pending,
      completed,
      failed,
      completionRate: total > 0 ? ((completed / total) * 100).toFixed(1) + '%' : '0%',
    };
  }
}

export default SummarizationService;
