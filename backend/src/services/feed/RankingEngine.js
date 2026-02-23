import {
  RANKING_WEIGHTS,
  RECENCY_THRESHOLDS,
  SOURCE_QUALITY,
  SOURCE_TYPE,
  PREFERENCE_TYPE,
  ARTICLE_LENGTH,
} from '../../config/constants.js';
import { hoursSince } from '../../utils/helpers.js';

/**
 * RankingEngine - Core algorithm for scoring and ranking articles
 * based on user preferences, recency, source quality, and engagement.
 */
class RankingEngine {
  constructor(options = {}) {
    // Allow custom weights to be passed in
    this.weights = {
      ...RANKING_WEIGHTS,
      ...options.weights,
    };
  }

  /**
   * Calculate the overall relevance score for an article
   * @param {Object} article - Article document
   * @param {Array} userPreferences - User's active preferences
   * @returns {Object} - Score breakdown and final score
   */
  calculateRelevanceScore(article, userPreferences) {
    const scoreBreakdown = {
      preferenceMatch: 0,
      recency: 0,
      sourceQuality: 0,
      engagement: 0,
      learnedBonus: 0, // New: bonus from learned preferences
    };

    // Separate preferences by type for more nuanced scoring
    const topicPrefs = userPreferences.filter(p => p.preferenceType === PREFERENCE_TYPE.TOPIC || !p.preferenceType);
    const sourcePrefs = userPreferences.filter(p => p.preferenceType === PREFERENCE_TYPE.SOURCE);
    const authorPrefs = userPreferences.filter(p => p.preferenceType === PREFERENCE_TYPE.AUTHOR);
    const lengthPrefs = userPreferences.filter(p => p.preferenceType === PREFERENCE_TYPE.LENGTH);

    // 1. Topic Preference Match Score (0-1)
    const preferenceResult = this.calculatePreferenceMatch(
      article.topics || [],
      topicPrefs
    );
    scoreBreakdown.preferenceMatch = preferenceResult.score;

    // 2. Recency Score (0-1)
    scoreBreakdown.recency = this.calculateRecencyScore(article.publishedAt);

    // 3. Source Quality Score (0-1) - now factors in learned source preferences
    scoreBreakdown.sourceQuality = this.calculateSourceQualityScore(
      article.source?.quality,
      article.source?.name,
      sourcePrefs
    );

    // 4. Engagement Score (0-1)
    scoreBreakdown.engagement = this.calculateEngagementScore(article);

    // 5. Learned Bonus (0-0.15) - additional boost from author and length preferences
    const authorBonus = this.calculateAuthorBonus(article.author, authorPrefs);
    const lengthBonus = this.calculateLengthBonus(article.content?.readingTimeMinutes, lengthPrefs);
    scoreBreakdown.learnedBonus = (authorBonus + lengthBonus) / 2;

    // Add matched author/source to results
    if (authorBonus > 0 && article.author) {
      preferenceResult.matchedPreferences.push({
        preference: article.author,
        type: 'author',
        weight: authorBonus,
      });
    }

    // Calculate weighted final score (learned bonus added on top)
    const baseScore =
      scoreBreakdown.preferenceMatch * this.weights.preferenceMatch +
      scoreBreakdown.recency * this.weights.recency +
      scoreBreakdown.sourceQuality * this.weights.sourceQuality +
      scoreBreakdown.engagement * this.weights.engagement;

    // Learned bonus can add up to 15% to the final score
    const finalScore = Math.min(1.0, baseScore + scoreBreakdown.learnedBonus * 0.15);

    return {
      score: Math.round(finalScore * 1000) / 1000, // Round to 3 decimal places
      matchedPreferences: preferenceResult.matchedPreferences,
      scoreBreakdown,
    };
  }

  /**
   * Calculate how well an article matches user preferences
   * @param {Array} articleTopics - Topics associated with the article
   * @param {Array} userPreferences - User's preferences with weights
   * @returns {Object} - Match score and matched preferences
   */
  calculatePreferenceMatch(articleTopics, userPreferences) {
    if (!userPreferences || userPreferences.length === 0) {
      return { score: 0.5, matchedPreferences: [] }; // Default score if no preferences
    }

    if (!articleTopics || articleTopics.length === 0) {
      return { score: 0.1, matchedPreferences: [] }; // Low score if no topics
    }

    let totalMatch = 0;
    let totalWeight = 0;
    const matchedPreferences = [];

    for (const pref of userPreferences) {
      const prefValue = pref.preferenceValue.toLowerCase();
      const prefWeight = pref.weight || 0.5;

      // Find matching topic in article
      const matchingTopic = articleTopics.find((topic) => {
        const topicName = topic.name.toLowerCase();
        // Check for exact match or partial match
        return (
          topicName === prefValue ||
          topicName.includes(prefValue) ||
          prefValue.includes(topicName)
        );
      });

      if (matchingTopic) {
        const topicConfidence = matchingTopic.confidence || 0.5;
        const matchScore = topicConfidence * prefWeight;
        totalMatch += matchScore;
        totalWeight += prefWeight;

        matchedPreferences.push({
          preference: pref.preferenceValue,
          weight: prefWeight,
          topicConfidence,
        });
      } else {
        // Non-matching preference still contributes to total weight
        totalWeight += prefWeight * 0.5; // Half weight for non-matches
      }
    }

    const score = totalWeight > 0 ? totalMatch / totalWeight : 0;

    return {
      score: Math.min(1, score), // Cap at 1.0
      matchedPreferences,
    };
  }

  /**
   * Calculate recency score based on article age
   * @param {Date} publishedAt - Article publish date
   * @returns {number} - Recency score (0-1)
   */
  calculateRecencyScore(publishedAt) {
    if (!publishedAt) return 0.1;

    const hoursOld = hoursSince(publishedAt);

    if (hoursOld < RECENCY_THRESHOLDS.VERY_FRESH) {
      // Less than 6 hours - very fresh
      return 1.0;
    } else if (hoursOld < RECENCY_THRESHOLDS.FRESH) {
      // 6-24 hours - fresh
      // Linear decay from 1.0 to 0.7
      const progress =
        (hoursOld - RECENCY_THRESHOLDS.VERY_FRESH) /
        (RECENCY_THRESHOLDS.FRESH - RECENCY_THRESHOLDS.VERY_FRESH);
      return 1.0 - progress * 0.3;
    } else if (hoursOld < RECENCY_THRESHOLDS.RECENT) {
      // 24-72 hours - recent
      // Linear decay from 0.7 to 0.4
      const progress =
        (hoursOld - RECENCY_THRESHOLDS.FRESH) /
        (RECENCY_THRESHOLDS.RECENT - RECENCY_THRESHOLDS.FRESH);
      return 0.7 - progress * 0.3;
    } else {
      // Older than 72 hours
      // Slow decay from 0.4 to 0.1
      const daysOld = hoursOld / 24;
      return Math.max(0.1, 0.4 - (daysOld - 3) * 0.05);
    }
  }

  /**
   * Calculate source quality score
   * @param {string} quality - Source quality tier
   * @param {string} sourceName - Name of the source
   * @param {Array} sourcePrefs - User's source preferences
   * @returns {number} - Quality score (0-1)
   */
  calculateSourceQualityScore(quality, sourceName, sourcePrefs = []) {
    // Base quality score
    let baseScore;
    switch (quality) {
      case SOURCE_QUALITY.TIER_1:
        baseScore = 1.0;
        break;
      case SOURCE_QUALITY.TIER_2:
        baseScore = 0.8;
        break;
      case SOURCE_QUALITY.TIER_3:
        baseScore = 0.6;
        break;
      default:
        baseScore = 0.5;
    }

    // Check for learned source preference
    if (sourceName && sourcePrefs.length > 0) {
      const sourceNameLower = sourceName.toLowerCase();
      const matchingPref = sourcePrefs.find(
        p => p.preferenceValue.toLowerCase() === sourceNameLower
      );

      if (matchingPref) {
        // Blend base quality with learned preference (60% base, 40% learned)
        const learnedBoost = matchingPref.weight * 0.4;
        return Math.min(1.0, baseScore * 0.6 + learnedBoost + 0.4);
      }
    }

    return baseScore;
  }

  /**
   * Calculate bonus score for preferred authors
   * @param {string} author - Article author
   * @param {Array} authorPrefs - User's author preferences
   * @returns {number} - Bonus score (0-1)
   */
  calculateAuthorBonus(author, authorPrefs = []) {
    if (!author || authorPrefs.length === 0) {
      return 0;
    }

    const authorLower = author.toLowerCase();
    const matchingPref = authorPrefs.find(
      p => p.preferenceValue.toLowerCase() === authorLower
    );

    if (matchingPref) {
      return matchingPref.weight;
    }

    return 0;
  }

  /**
   * Calculate bonus score for preferred article length
   * @param {number} readingTimeMinutes - Article reading time in minutes
   * @param {Array} lengthPrefs - User's length preferences
   * @returns {number} - Bonus score (0-1)
   */
  calculateLengthBonus(readingTimeMinutes, lengthPrefs = []) {
    if (!readingTimeMinutes || lengthPrefs.length === 0) {
      return 0;
    }

    // Determine article length category
    let lengthCategory;
    if (readingTimeMinutes < 3) {
      lengthCategory = ARTICLE_LENGTH.SHORT;
    } else if (readingTimeMinutes <= 7) {
      lengthCategory = ARTICLE_LENGTH.MEDIUM;
    } else {
      lengthCategory = ARTICLE_LENGTH.LONG;
    }

    const matchingPref = lengthPrefs.find(
      p => p.preferenceValue.toLowerCase() === lengthCategory
    );

    if (matchingPref) {
      return matchingPref.weight;
    }

    return 0;
  }

  /**
   * Calculate engagement score based on social signals
   * @param {Object} article - Article with engagement data
   * @returns {number} - Engagement score (0-1)
   */
  calculateEngagementScore(article) {
    // Reddit articles have engagement data
    if (article.source?.type === SOURCE_TYPE.REDDIT && article.engagement) {
      const upvotes = article.engagement.upvotes || 0;
      const comments = article.engagement.comments || 0;

      // Normalize upvotes (1000+ upvotes = max score)
      const upvoteScore = Math.min(upvotes / 1000, 1.0);

      // Normalize comments (100+ comments = max score)
      const commentScore = Math.min(comments / 100, 1.0);

      // Weighted combination (upvotes matter more)
      return upvoteScore * 0.7 + commentScore * 0.3;
    }

    // Default score for non-Reddit sources
    return 0.5;
  }

  /**
   * Rank an array of articles for a user
   * @param {Array} articles - Array of article documents
   * @param {Array} userPreferences - User's active preferences
   * @param {Object} options - Ranking options
   * @returns {Array} - Ranked articles with relevance scores
   */
  rankArticles(articles, userPreferences, options = {}) {
    const { diversify = true, maxPerSource = 5 } = options;

    // Score each article
    const scoredArticles = articles.map((article) => ({
      article,
      relevance: this.calculateRelevanceScore(article, userPreferences),
    }));

    // Sort by score (descending)
    scoredArticles.sort((a, b) => b.relevance.score - a.relevance.score);

    // Optional: Diversify to avoid too many articles from same source
    if (diversify) {
      return this.diversifyResults(scoredArticles, maxPerSource);
    }

    return scoredArticles;
  }

  /**
   * Diversify results to prevent source domination
   * @param {Array} scoredArticles - Sorted array of scored articles
   * @param {number} maxPerSource - Max articles per source in top results
   * @returns {Array} - Diversified results
   */
  diversifyResults(scoredArticles, maxPerSource = 5) {
    const sourceCount = {};
    const diversified = [];
    const deferred = [];

    for (const item of scoredArticles) {
      const sourceName = item.article.source?.name || 'unknown';

      if (!sourceCount[sourceName]) {
        sourceCount[sourceName] = 0;
      }

      if (sourceCount[sourceName] < maxPerSource) {
        diversified.push(item);
        sourceCount[sourceName]++;
      } else {
        deferred.push(item);
      }
    }

    // Add deferred items at the end (maintaining their relative order)
    return [...diversified, ...deferred];
  }

  /**
   * Get score explanation for debugging/UI
   * @param {Object} relevance - Relevance object from calculateRelevanceScore
   * @returns {string} - Human readable explanation
   */
  explainScore(relevance) {
    const { score, scoreBreakdown, matchedPreferences } = relevance;

    const parts = [
      `Final Score: ${(score * 100).toFixed(1)}%`,
      `Preference Match: ${(scoreBreakdown.preferenceMatch * 100).toFixed(1)}% (weight: ${this.weights.preferenceMatch * 100}%)`,
      `Recency: ${(scoreBreakdown.recency * 100).toFixed(1)}% (weight: ${this.weights.recency * 100}%)`,
      `Source Quality: ${(scoreBreakdown.sourceQuality * 100).toFixed(1)}% (weight: ${this.weights.sourceQuality * 100}%)`,
      `Engagement: ${(scoreBreakdown.engagement * 100).toFixed(1)}% (weight: ${this.weights.engagement * 100}%)`,
    ];

    if (scoreBreakdown.learnedBonus > 0) {
      parts.push(`Learned Bonus: ${(scoreBreakdown.learnedBonus * 15).toFixed(1)}% (author/length match)`);
    }

    if (matchedPreferences.length > 0) {
      const topicMatches = matchedPreferences.filter(p => !p.type || p.type === 'topic');
      const otherMatches = matchedPreferences.filter(p => p.type && p.type !== 'topic');

      if (topicMatches.length > 0) {
        parts.push(`Matched Topics: ${topicMatches.map((p) => p.preference).join(', ')}`);
      }
      if (otherMatches.length > 0) {
        parts.push(`Matched Learned: ${otherMatches.map((p) => `${p.preference} (${p.type})`).join(', ')}`);
      }
    }

    return parts.join('\n');
  }
}

export default RankingEngine;
