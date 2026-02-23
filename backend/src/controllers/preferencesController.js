import UserPreference from '../models/UserPreference.js';
import { PREFERENCE_SOURCE, PREFERENCE_TYPE } from '../config/constants.js';
import { logger } from '../utils/logger.js';

/**
 * GET /api/preferences/topics
 * Get user's explicit topic preferences.
 */
export async function getTopicPreferences(req, res, next) {
  try {
    const prefs = await UserPreference.find({
      userId: req.userId,
      preferenceType: PREFERENCE_TYPE.TOPIC,
      source: PREFERENCE_SOURCE.EXPLICIT,
      active: true,
    })
      .sort({ weight: -1 })
      .lean();

    res.json({
      topics: prefs.map((pref) => pref.preferenceValue),
    });
  } catch (error) {
    logger.error('Error getting topic preferences', { error: error.message, userId: req.userId });
    next(error);
  }
}

/**
 * PUT /api/preferences/topics
 * Replace user's explicit topic preferences with provided list.
 */
export async function updateTopicPreferences(req, res, next) {
  try {
    const { topics } = req.body;

    if (!Array.isArray(topics)) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'topics must be an array of strings',
      });
    }

    const normalizedTopics = [...new Set(
      topics
        .filter((topic) => typeof topic === 'string')
        .map((topic) => topic.toLowerCase().trim())
        .filter(Boolean)
    )];

    if (normalizedTopics.length === 0) {
      await UserPreference.updateMany(
        {
          userId: req.userId,
          preferenceType: PREFERENCE_TYPE.TOPIC,
          source: PREFERENCE_SOURCE.EXPLICIT,
          active: true,
        },
        { $set: { active: false } }
      );

      return res.json({ topics: [] });
    }

    // Deactivate explicit topic prefs that are no longer selected.
    await UserPreference.updateMany(
      {
        userId: req.userId,
        preferenceType: PREFERENCE_TYPE.TOPIC,
        source: PREFERENCE_SOURCE.EXPLICIT,
        preferenceValue: { $nin: normalizedTopics },
        active: true,
      },
      { $set: { active: false } }
    );

    // Upsert selected topics as explicit preferences.
    await Promise.all(
      normalizedTopics.map((topic) =>
        UserPreference.upsertPreference(
          req.userId,
          PREFERENCE_TYPE.TOPIC,
          topic,
          { source: PREFERENCE_SOURCE.EXPLICIT, weight: 0.8 }
        )
      )
    );

    logger.info('Updated explicit topic preferences', {
      userId: req.userId,
      topicCount: normalizedTopics.length,
    });

    res.json({
      topics: normalizedTopics,
    });
  } catch (error) {
    logger.error('Error updating topic preferences', { error: error.message, userId: req.userId });
    next(error);
  }
}

