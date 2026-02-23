import UserInteraction from '../../models/UserInteraction.js';
import UserPreference from '../../models/UserPreference.js';
import {
  PREFERENCE_TYPE,
  PREFERENCE_SOURCE,
  INTERACTION_TYPE,
  LEARNING_CONFIG,
  ARTICLE_LENGTH,
} from '../../config/constants.js';
import { logger } from '../../utils/logger.js';

/**
 * LearningService - Analyzes user behavior and updates preferences
 * to improve feed personalization over time.
 */
class LearningService {
  /**
   * Process a single interaction and determine if it's a positive signal
   * @param {Object} interaction - The interaction object with populated article
   * @returns {Object} - Analysis result with signal type and extracted features
   */
  analyzeInteraction(interaction) {
    const { action, durationSeconds, scrollDepth, expectedReadTime, article } = interaction;

    if (!article) {
      return { signal: 'neutral', reason: 'no article data' };
    }

    // Explicit positive signals
    if ([INTERACTION_TYPE.LIKE, INTERACTION_TYPE.BOOKMARK, INTERACTION_TYPE.SHARE].includes(action)) {
      return {
        signal: 'positive',
        strength: action === INTERACTION_TYPE.LIKE ? 1.0 : 0.8,
        reason: `explicit ${action.toLowerCase()}`,
        features: this.extractFeatures(article),
      };
    }

    // Explicit negative signals
    if ([INTERACTION_TYPE.DISLIKE, INTERACTION_TYPE.DISMISS].includes(action)) {
      return {
        signal: 'negative',
        strength: action === INTERACTION_TYPE.DISLIKE ? 1.0 : 0.6,
        reason: `explicit ${action.toLowerCase()}`,
        features: this.extractFeatures(article),
      };
    }

    // Time-based signals for VIEW/CLICK
    if ([INTERACTION_TYPE.VIEW, INTERACTION_TYPE.CLICK].includes(action)) {
      const readTimeMinutes = article.content?.readingTimeMinutes || expectedReadTime || 3;
      const expectedSeconds = readTimeMinutes * 60;
      const actualSeconds = durationSeconds || 0;

      // Calculate read ratio
      const readRatio = expectedSeconds > 0 ? actualSeconds / expectedSeconds : 0;

      // Positive signal: spent > 60% of expected read time
      if (readRatio >= LEARNING_CONFIG.POSITIVE_READ_RATIO) {
        return {
          signal: 'positive',
          strength: Math.min(readRatio, 1.5) * 0.6, // Scale strength, cap at 0.9
          reason: `read ${Math.round(readRatio * 100)}% of article`,
          features: this.extractFeatures(article),
        };
      }

      // Consider scroll depth as secondary signal
      if (scrollDepth && scrollDepth >= 80) {
        return {
          signal: 'positive',
          strength: 0.4,
          reason: `scrolled ${scrollDepth}% of article`,
          features: this.extractFeatures(article),
        };
      }

      // Quick bounce (less than 15% read time and low scroll)
      if (readRatio < 0.15 && (!scrollDepth || scrollDepth < 20)) {
        return {
          signal: 'negative',
          strength: 0.3,
          reason: 'quick bounce',
          features: this.extractFeatures(article),
        };
      }

      return {
        signal: 'neutral',
        reason: `read ${Math.round(readRatio * 100)}% (below threshold)`,
        features: this.extractFeatures(article),
      };
    }

    return { signal: 'neutral', reason: 'unknown action' };
  }

  /**
   * Extract learnable features from an article
   * @param {Object} article - Article document
   * @returns {Object} - Extracted features
   */
  extractFeatures(article) {
    const readingTime = article.content?.readingTimeMinutes || 3;
    let lengthCategory = ARTICLE_LENGTH.MEDIUM;
    if (readingTime < 3) lengthCategory = ARTICLE_LENGTH.SHORT;
    else if (readingTime > 7) lengthCategory = ARTICLE_LENGTH.LONG;

    return {
      topics: (article.topics || []).map(t => t.name.toLowerCase()),
      source: article.source?.name || null,
      author: article.author || null,
      lengthCategory,
    };
  }

  /**
   * Update user preferences based on analyzed interaction
   * @param {string} userId - User ID
   * @param {Object} analysis - Analysis result from analyzeInteraction
   */
  async updatePreferencesFromAnalysis(userId, analysis) {
    if (analysis.signal === 'neutral' || !analysis.features) {
      return;
    }

    const { signal, strength, features } = analysis;
    const isPositive = signal === 'positive';
    const weightDelta = isPositive
      ? LEARNING_CONFIG.POSITIVE_WEIGHT_INCREMENT * strength
      : -LEARNING_CONFIG.NEGATIVE_WEIGHT_DECREMENT * strength;

    const updates = [];

    // Update topic preferences
    for (const topic of features.topics) {
      updates.push(
        this.updateOrCreatePreference(userId, PREFERENCE_TYPE.TOPIC, topic, weightDelta)
      );
    }

    // Update source preference
    if (features.source) {
      updates.push(
        this.updateOrCreatePreference(userId, PREFERENCE_TYPE.SOURCE, features.source, weightDelta)
      );
    }

    // Update author preference
    if (features.author) {
      updates.push(
        this.updateOrCreatePreference(userId, PREFERENCE_TYPE.AUTHOR, features.author, weightDelta)
      );
    }

    // Update length preference
    if (features.lengthCategory) {
      updates.push(
        this.updateOrCreatePreference(userId, PREFERENCE_TYPE.LENGTH, features.lengthCategory, weightDelta)
      );
    }

    await Promise.all(updates);
  }

  /**
   * Update or create an implicit preference
   * @param {string} userId - User ID
   * @param {string} preferenceType - Type of preference
   * @param {string} preferenceValue - Value of preference
   * @param {number} weightDelta - Amount to adjust weight by
   */
  async updateOrCreatePreference(userId, preferenceType, preferenceValue, weightDelta) {
    try {
      const normalizedValue = preferenceValue.toLowerCase().trim();

      // Find existing preference
      let preference = await UserPreference.findOne({
        userId,
        preferenceType,
        preferenceValue: normalizedValue,
      });

      if (preference) {
        // Update existing preference
        const newWeight = Math.max(
          0.1,
          Math.min(
            preference.source === PREFERENCE_SOURCE.EXPLICIT ? 1.0 : LEARNING_CONFIG.IMPLICIT_MAX_WEIGHT,
            preference.weight + weightDelta
          )
        );

        preference.weight = newWeight;
        preference.lastInteractionAt = new Date();

        if (weightDelta > 0) {
          preference.clickCount += 1;
        } else {
          preference.dismissCount += 1;
        }

        await preference.save();
      } else if (weightDelta > 0) {
        // Only create new implicit preferences for positive signals
        await UserPreference.create({
          userId,
          preferenceType,
          preferenceValue: normalizedValue,
          weight: LEARNING_CONFIG.IMPLICIT_STARTING_WEIGHT,
          source: PREFERENCE_SOURCE.IMPLICIT,
          clickCount: 1,
          lastInteractionAt: new Date(),
        });
      }
    } catch (error) {
      // Ignore duplicate key errors (race condition)
      if (error.code !== 11000) {
        logger.error('Error updating preference', {
          error: error.message,
          userId,
          preferenceType,
          preferenceValue,
        });
      }
    }
  }

  /**
   * Process unprocessed interactions and update preferences
   * @param {number} batchSize - Number of interactions to process
   * @returns {Object} - Processing stats
   */
  async processInteractionBatch(batchSize = 500) {
    const startTime = Date.now();
    const stats = {
      processed: 0,
      positive: 0,
      negative: 0,
      neutral: 0,
      errors: 0,
    };

    try {
      const interactions = await UserInteraction.getUnprocessedInteractions(batchSize);

      if (interactions.length === 0) {
        return stats;
      }

      const processedIds = [];

      for (const interaction of interactions) {
        try {
          const analysis = this.analyzeInteraction(interaction);

          if (analysis.signal === 'positive') stats.positive++;
          else if (analysis.signal === 'negative') stats.negative++;
          else stats.neutral++;

          await this.updatePreferencesFromAnalysis(interaction.userId.toString(), analysis);
          processedIds.push(interaction._id);
          stats.processed++;
        } catch (error) {
          logger.error('Error processing interaction', {
            error: error.message,
            interactionId: interaction._id,
          });
          stats.errors++;
          // Still mark as processed to avoid infinite retry
          processedIds.push(interaction._id);
        }
      }

      // Mark all as processed
      if (processedIds.length > 0) {
        await UserInteraction.markAsProcessed(processedIds);
      }

      const duration = Date.now() - startTime;
      logger.info('Processed interaction batch', { ...stats, duration });

      return stats;
    } catch (error) {
      logger.error('Error in processInteractionBatch', { error: error.message });
      throw error;
    }
  }

  /**
   * Run comprehensive learning analysis for a user
   * Updates preferences based on aggregated engagement patterns
   * @param {string} userId - User ID
   * @param {number} days - Days of history to analyze
   */
  async runUserAnalysis(userId, days = 30) {
    try {
      logger.info(`Running learning analysis for user ${userId}`);

      // Get aggregated engagement data
      const [topicEngagement, sourceEngagement, authorEngagement, lengthEngagement] = await Promise.all([
        UserInteraction.getTopicEngagement(userId, days),
        UserInteraction.getSourceEngagement(userId, days),
        UserInteraction.getAuthorEngagement(userId, days),
        UserInteraction.getLengthEngagement(userId, days),
      ]);

      // Process topic engagement
      for (const topic of topicEngagement) {
        if (topic.totalEngagement >= LEARNING_CONFIG.MIN_INTERACTIONS_FOR_PREFERENCE) {
          const score = this.calculateEngagementScore(topic);
          await this.updateOrCreatePreference(
            userId,
            PREFERENCE_TYPE.TOPIC,
            topic._id,
            score * LEARNING_CONFIG.POSITIVE_WEIGHT_INCREMENT
          );
        }
      }

      // Process source engagement
      for (const source of sourceEngagement) {
        if (source.totalInteractions >= LEARNING_CONFIG.MIN_INTERACTIONS_FOR_PREFERENCE && source._id) {
          const score = this.calculateSourceScore(source);
          await this.updateOrCreatePreference(
            userId,
            PREFERENCE_TYPE.SOURCE,
            source._id,
            score * LEARNING_CONFIG.POSITIVE_WEIGHT_INCREMENT
          );
        }
      }

      // Process author engagement
      for (const author of authorEngagement) {
        if (author.totalInteractions >= LEARNING_CONFIG.MIN_INTERACTIONS_FOR_PREFERENCE && author._id) {
          const score = this.calculateAuthorScore(author);
          await this.updateOrCreatePreference(
            userId,
            PREFERENCE_TYPE.AUTHOR,
            author._id,
            score * LEARNING_CONFIG.POSITIVE_WEIGHT_INCREMENT
          );
        }
      }

      // Process length preference
      for (const length of lengthEngagement) {
        if (length.totalInteractions >= LEARNING_CONFIG.MIN_INTERACTIONS_FOR_PREFERENCE) {
          const score = this.calculateLengthScore(length);
          await this.updateOrCreatePreference(
            userId,
            PREFERENCE_TYPE.LENGTH,
            length._id,
            score * LEARNING_CONFIG.POSITIVE_WEIGHT_INCREMENT
          );
        }
      }

      // Deactivate stale implicit preferences
      await UserPreference.deactivateStalePreferences(userId);

      logger.info(`Learning analysis complete for user ${userId}`);
    } catch (error) {
      logger.error('Error in runUserAnalysis', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Calculate engagement score for a topic
   */
  calculateEngagementScore(topic) {
    // Weighted score: clicks and bookmarks are positive
    const clickWeight = 1.0;
    const bookmarkWeight = 2.0;
    const rawScore = (topic.clickCount * clickWeight + topic.bookmarkCount * bookmarkWeight) / topic.totalEngagement;
    return Math.min(1.0, rawScore);
  }

  /**
   * Calculate engagement score for a source
   */
  calculateSourceScore(source) {
    const { clicks, bookmarks, likes, dislikes, avgReadRatio, totalInteractions } = source;

    // Positive signals
    let score = 0;
    score += (clicks / totalInteractions) * 0.3;
    score += (bookmarks / totalInteractions) * 0.3;
    score += (likes / totalInteractions) * 0.2;
    score += (avgReadRatio || 0) * 0.2;

    // Negative signals
    score -= (dislikes / totalInteractions) * 0.4;

    return Math.max(-1, Math.min(1, score));
  }

  /**
   * Calculate engagement score for an author
   */
  calculateAuthorScore(author) {
    const { clicks, bookmarks, likes, avgReadRatio, totalInteractions } = author;

    let score = 0;
    score += (clicks / totalInteractions) * 0.3;
    score += (bookmarks / totalInteractions) * 0.3;
    score += (likes / totalInteractions) * 0.2;
    score += (avgReadRatio || 0) * 0.2;

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Calculate preference score for article length
   */
  calculateLengthScore(length) {
    const { avgReadRatio, avgScrollDepth, completedReads, totalInteractions } = length;

    // High completion rate and read ratio indicate preference
    const completionRate = completedReads / totalInteractions;
    let score = 0;
    score += completionRate * 0.5;
    score += (avgReadRatio || 0) * 0.3;
    score += ((avgScrollDepth || 0) / 100) * 0.2;

    return Math.min(1, score);
  }

  /**
   * Get learning insights for a user (for debugging/analytics)
   * @param {string} userId - User ID
   * @returns {Object} - Learning insights
   */
  async getUserLearningInsights(userId, days = 30) {
    const [
      topicEngagement,
      sourceEngagement,
      authorEngagement,
      lengthEngagement,
      engagementSummary,
      preferences,
    ] = await Promise.all([
      UserInteraction.getTopicEngagement(userId, days),
      UserInteraction.getSourceEngagement(userId, days),
      UserInteraction.getAuthorEngagement(userId, days),
      UserInteraction.getLengthEngagement(userId, days),
      UserInteraction.getEngagementSummary(userId, days),
      UserPreference.find({ userId, active: true }).sort({ weight: -1 }).lean(),
    ]);

    const implicitPreferences = preferences.filter(p => p.source === PREFERENCE_SOURCE.IMPLICIT);
    const explicitPreferences = preferences.filter(p => p.source === PREFERENCE_SOURCE.EXPLICIT);

    return {
      summary: engagementSummary[0] || {},
      topEngagedTopics: topicEngagement.slice(0, 10),
      topEngagedSources: sourceEngagement.slice(0, 10),
      topEngagedAuthors: authorEngagement.slice(0, 5),
      lengthPreference: lengthEngagement,
      preferences: {
        explicit: explicitPreferences.length,
        implicit: implicitPreferences.length,
        topImplicit: implicitPreferences.slice(0, 10),
      },
    };
  }
}

export default new LearningService();
