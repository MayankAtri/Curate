import UserInteraction from '../models/UserInteraction.js';
import Article from '../models/Article.js';
import learningService from '../services/learning/LearningService.js';
import { INTERACTION_TYPE } from '../config/constants.js';
import { logger } from '../utils/logger.js';

const DEDUPE_WINDOWS_MS = {
  [INTERACTION_TYPE.CLICK]: 3000,
  [INTERACTION_TYPE.VIEW]: 10000,
  [INTERACTION_TYPE.LIKE]: 3000,
  [INTERACTION_TYPE.DISLIKE]: 3000,
  [INTERACTION_TYPE.BOOKMARK]: 3000,
  [INTERACTION_TYPE.SHARE]: 3000,
  [INTERACTION_TYPE.DISMISS]: 3000,
};

/**
 * POST /api/interactions/track
 * Track a user interaction with an article
 */
export async function trackInteraction(req, res, next) {
  try {
    const userId = req.userId;
    const {
      articleId,
      action,
      durationSeconds,
      scrollDepth,
      feedPosition,
      relevanceScore,
    } = req.body;

    // Validate required fields
    if (!articleId || !action) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'articleId and action are required',
      });
    }

    // Validate action type
    if (!Object.values(INTERACTION_TYPE).includes(action)) {
      return res.status(400).json({
        error: 'Validation error',
        message: `Invalid action type. Must be one of: ${Object.values(INTERACTION_TYPE).join(', ')}`,
      });
    }

    // Get article to fetch expected read time
    const article = await Article.findById(articleId).lean();
    if (!article) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Article not found',
      });
    }

    const expectedReadTime = article.content?.readingTimeMinutes || 3;

    // Deduplicate rapid repeat interactions from the client.
    const dedupeWindowMs = DEDUPE_WINDOWS_MS[action] || 0;
    if (dedupeWindowMs > 0) {
      const cutoff = new Date(Date.now() - dedupeWindowMs);
      const existing = await UserInteraction.findOne({
        userId,
        articleId,
        action,
        timestamp: { $gte: cutoff },
      })
        .sort({ timestamp: -1 })
        .select('_id timestamp')
        .lean();

      if (existing) {
        return res.status(200).json({
          message: 'Interaction deduplicated',
          deduplicated: true,
          interactionId: existing._id,
        });
      }
    }

    // Create interaction
    const interaction = await UserInteraction.create({
      userId,
      articleId,
      action,
      durationSeconds: durationSeconds || null,
      scrollDepth: scrollDepth || null,
      expectedReadTime,
      context: {
        feedPosition: feedPosition || null,
        relevanceScore: relevanceScore || null,
        matchedPreferences: [],
      },
      clickedThrough: action === INTERACTION_TYPE.CLICK,
      processed: false,
    });

    logger.info('Interaction tracked', {
      userId,
      articleId,
      action,
      durationSeconds,
    });

    res.status(201).json({
      message: 'Interaction tracked',
      interactionId: interaction._id,
    });
  } catch (error) {
    logger.error('Error tracking interaction', { error: error.message });
    next(error);
  }
}

/**
 * POST /api/interactions/batch
 * Track multiple interactions at once (for offline sync)
 */
export async function trackBatchInteractions(req, res, next) {
  try {
    const userId = req.userId;
    const { interactions } = req.body;

    if (!interactions || !Array.isArray(interactions) || interactions.length === 0) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'interactions array is required',
      });
    }

    // Limit batch size
    if (interactions.length > 50) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Maximum 50 interactions per batch',
      });
    }

    // Get all article IDs
    const articleIds = [...new Set(interactions.map(i => i.articleId))];
    const articles = await Article.find({ _id: { $in: articleIds } }).lean();
    const articleMap = new Map(articles.map(a => [a._id.toString(), a]));

    const results = {
      successful: 0,
      failed: 0,
      errors: [],
    };

    for (const interaction of interactions) {
      try {
        const { articleId, action, durationSeconds, scrollDepth, feedPosition, timestamp } = interaction;

        if (!articleId || !action || !Object.values(INTERACTION_TYPE).includes(action)) {
          results.failed++;
          results.errors.push({ articleId, error: 'Invalid articleId or action' });
          continue;
        }

        const article = articleMap.get(articleId);
        if (!article) {
          results.failed++;
          results.errors.push({ articleId, error: 'Article not found' });
          continue;
        }

        await UserInteraction.create({
          userId,
          articleId,
          action,
          durationSeconds: durationSeconds || null,
          scrollDepth: scrollDepth || null,
          expectedReadTime: article.content?.readingTimeMinutes || 3,
          context: {
            feedPosition: feedPosition || null,
          },
          clickedThrough: action === INTERACTION_TYPE.CLICK,
          timestamp: timestamp ? new Date(timestamp) : new Date(),
          processed: false,
        });

        results.successful++;
      } catch (error) {
        results.failed++;
        results.errors.push({ articleId: interaction.articleId, error: error.message });
      }
    }

    logger.info('Batch interactions tracked', { userId, ...results });

    res.status(201).json({
      message: 'Batch processing complete',
      ...results,
    });
  } catch (error) {
    logger.error('Error tracking batch interactions', { error: error.message });
    next(error);
  }
}

/**
 * GET /api/interactions/history
 * Get user's interaction history
 */
export async function getInteractionHistory(req, res, next) {
  try {
    const userId = req.userId;
    const { days = 30, action, limit = 50 } = req.query;

    const actions = action ? [action] : null;
    const interactions = await UserInteraction.getRecentInteractions(
      userId,
      parseInt(days),
      actions
    );

    res.json({
      interactions: interactions.slice(0, parseInt(limit)),
      total: interactions.length,
    });
  } catch (error) {
    logger.error('Error getting interaction history', { error: error.message });
    next(error);
  }
}

/**
 * GET /api/interactions/stats
 * Get user's interaction statistics
 */
export async function getInteractionStats(req, res, next) {
  try {
    const userId = req.userId;
    const { days = 30 } = req.query;

    const stats = await UserInteraction.getInteractionStats(userId, parseInt(days));

    res.json({
      days: parseInt(days),
      stats,
    });
  } catch (error) {
    logger.error('Error getting interaction stats', { error: error.message });
    next(error);
  }
}

/**
 * GET /api/interactions/insights
 * Get learning insights for the user
 */
export async function getLearningInsights(req, res, next) {
  try {
    const userId = req.userId;
    const { days = 30 } = req.query;

    const insights = await learningService.getUserLearningInsights(userId, parseInt(days));

    res.json(insights);
  } catch (error) {
    logger.error('Error getting learning insights', { error: error.message });
    next(error);
  }
}

/**
 * POST /api/interactions/learn
 * Trigger learning analysis for the user (manual trigger)
 */
export async function triggerLearning(req, res, next) {
  try {
    const userId = req.userId;
    const { days = 30 } = req.body;

    await learningService.runUserAnalysis(userId, parseInt(days));

    res.json({
      message: 'Learning analysis complete',
    });
  } catch (error) {
    logger.error('Error triggering learning', { error: error.message });
    next(error);
  }
}
