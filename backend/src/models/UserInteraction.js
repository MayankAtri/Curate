import mongoose from 'mongoose';
import { INTERACTION_TYPE, SOURCE_TYPE } from '../config/constants.js';

const userInteractionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    articleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Article',
      required: [true, 'Article ID is required'],
      index: true,
    },
    action: {
      type: String,
      enum: Object.values(INTERACTION_TYPE),
      required: [true, 'Action type is required'],
    },
    context: {
      feedPosition: {
        type: Number,
        default: null,
      },
      sourceType: {
        type: String,
        enum: Object.values(SOURCE_TYPE),
        default: null,
      },
      matchedPreferences: {
        type: [String],
        default: [],
      },
      relevanceScore: {
        type: Number,
        default: null,
      },
    },
    durationSeconds: {
      type: Number,
      default: null,
    },
    scrollDepth: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },
    expectedReadTime: {
      type: Number,
      default: null,
    },
    clickedThrough: {
      type: Boolean,
      default: false,
    },
    processed: {
      type: Boolean,
      default: false,
      index: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
userInteractionSchema.index({ userId: 1, timestamp: -1 });
userInteractionSchema.index({ userId: 1, action: 1 });
userInteractionSchema.index({ articleId: 1 });

// Compound index for analytics queries
userInteractionSchema.index({ userId: 1, action: 1, timestamp: -1 });

// Static method to record an interaction
userInteractionSchema.statics.recordInteraction = async function (
  userId,
  articleId,
  action,
  context = {}
) {
  return this.create({
    userId,
    articleId,
    action,
    context,
    timestamp: new Date(),
  });
};

// Static method to get user's recent interactions
userInteractionSchema.statics.getRecentInteractions = function (
  userId,
  days = 30,
  actions = null
) {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const query = {
    userId,
    timestamp: { $gte: cutoff },
  };

  if (actions && actions.length > 0) {
    query.action = { $in: actions };
  }

  return this.find(query)
    .sort({ timestamp: -1 })
    .populate('articleId')
    .lean();
};

// Static method to get interaction counts by action type
userInteractionSchema.statics.getInteractionStats = async function (
  userId,
  days = 30
) {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const stats = await this.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        timestamp: { $gte: cutoff },
      },
    },
    {
      $group: {
        _id: '$action',
        count: { $sum: 1 },
      },
    },
  ]);

  // Convert to object
  return stats.reduce((acc, stat) => {
    acc[stat._id] = stat.count;
    return acc;
  }, {});
};

// Static method to get topic engagement (for preference learning)
userInteractionSchema.statics.getTopicEngagement = async function (
  userId,
  days = 30
) {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const engagement = await this.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        timestamp: { $gte: cutoff },
        action: { $in: [INTERACTION_TYPE.CLICK, INTERACTION_TYPE.BOOKMARK] },
      },
    },
    {
      $lookup: {
        from: 'articles',
        localField: 'articleId',
        foreignField: '_id',
        as: 'article',
      },
    },
    {
      $unwind: '$article',
    },
    {
      $unwind: '$article.topics',
    },
    {
      $group: {
        _id: '$article.topics.name',
        clickCount: {
          $sum: { $cond: [{ $eq: ['$action', INTERACTION_TYPE.CLICK] }, 1, 0] },
        },
        bookmarkCount: {
          $sum: { $cond: [{ $eq: ['$action', INTERACTION_TYPE.BOOKMARK] }, 1, 0] },
        },
        totalEngagement: { $sum: 1 },
      },
    },
    {
      $sort: { totalEngagement: -1 },
    },
  ]);

  return engagement;
};

// Static method to check if user has interacted with article
userInteractionSchema.statics.hasInteracted = async function (
  userId,
  articleId,
  action = null
) {
  const query = { userId, articleId };
  if (action) {
    query.action = action;
  }
  const interaction = await this.findOne(query);
  return !!interaction;
};

// Static method to get unprocessed interactions for learning
userInteractionSchema.statics.getUnprocessedInteractions = function (limit = 500) {
  return this.find({
    processed: false,
    action: { $in: [INTERACTION_TYPE.VIEW, INTERACTION_TYPE.CLICK, INTERACTION_TYPE.LIKE, INTERACTION_TYPE.DISLIKE, INTERACTION_TYPE.BOOKMARK, INTERACTION_TYPE.SHARE, INTERACTION_TYPE.DISMISS] },
  })
    .sort({ timestamp: 1 })
    .limit(limit)
    .populate('articleId')
    .lean();
};

// Static method to mark interactions as processed
userInteractionSchema.statics.markAsProcessed = function (interactionIds) {
  return this.updateMany(
    { _id: { $in: interactionIds } },
    { $set: { processed: true } }
  );
};

// Static method to get engagement summary for a user (for learning)
userInteractionSchema.statics.getEngagementSummary = async function (userId, days = 30) {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  return this.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        timestamp: { $gte: cutoff },
        action: INTERACTION_TYPE.VIEW,
        durationSeconds: { $gt: 0 },
      },
    },
    {
      $lookup: {
        from: 'articles',
        localField: 'articleId',
        foreignField: '_id',
        as: 'article',
      },
    },
    {
      $unwind: '$article',
    },
    {
      $addFields: {
        readRatio: {
          $cond: [
            { $and: [{ $gt: ['$durationSeconds', 0] }, { $gt: ['$expectedReadTime', 0] }] },
            { $divide: ['$durationSeconds', { $multiply: ['$expectedReadTime', 60] }] },
            null,
          ],
        },
      },
    },
    {
      $group: {
        _id: '$userId',
        totalViews: { $sum: 1 },
        avgReadRatio: { $avg: '$readRatio' },
        avgScrollDepth: { $avg: '$scrollDepth' },
        avgDuration: { $avg: '$durationSeconds' },
      },
    },
  ]);
};

// Static method to get source engagement for learning
userInteractionSchema.statics.getSourceEngagement = async function (userId, days = 30) {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  return this.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        timestamp: { $gte: cutoff },
      },
    },
    {
      $lookup: {
        from: 'articles',
        localField: 'articleId',
        foreignField: '_id',
        as: 'article',
      },
    },
    {
      $unwind: '$article',
    },
    {
      $group: {
        _id: '$article.source.name',
        totalInteractions: { $sum: 1 },
        clicks: {
          $sum: { $cond: [{ $eq: ['$action', INTERACTION_TYPE.CLICK] }, 1, 0] },
        },
        bookmarks: {
          $sum: { $cond: [{ $eq: ['$action', INTERACTION_TYPE.BOOKMARK] }, 1, 0] },
        },
        likes: {
          $sum: { $cond: [{ $eq: ['$action', INTERACTION_TYPE.LIKE] }, 1, 0] },
        },
        dislikes: {
          $sum: { $cond: [{ $eq: ['$action', INTERACTION_TYPE.DISLIKE] }, 1, 0] },
        },
        avgReadRatio: {
          $avg: {
            $cond: [
              { $and: [{ $gt: ['$durationSeconds', 0] }, { $gt: ['$expectedReadTime', 0] }] },
              { $divide: ['$durationSeconds', { $multiply: ['$expectedReadTime', 60] }] },
              null,
            ],
          },
        },
      },
    },
    {
      $sort: { totalInteractions: -1 },
    },
  ]);
};

// Static method to get author engagement for learning
userInteractionSchema.statics.getAuthorEngagement = async function (userId, days = 30) {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  return this.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        timestamp: { $gte: cutoff },
      },
    },
    {
      $lookup: {
        from: 'articles',
        localField: 'articleId',
        foreignField: '_id',
        as: 'article',
      },
    },
    {
      $unwind: '$article',
    },
    {
      $match: {
        'article.author': { $ne: null, $ne: '' },
      },
    },
    {
      $group: {
        _id: '$article.author',
        totalInteractions: { $sum: 1 },
        clicks: {
          $sum: { $cond: [{ $eq: ['$action', INTERACTION_TYPE.CLICK] }, 1, 0] },
        },
        bookmarks: {
          $sum: { $cond: [{ $eq: ['$action', INTERACTION_TYPE.BOOKMARK] }, 1, 0] },
        },
        likes: {
          $sum: { $cond: [{ $eq: ['$action', INTERACTION_TYPE.LIKE] }, 1, 0] },
        },
        avgReadRatio: {
          $avg: {
            $cond: [
              { $and: [{ $gt: ['$durationSeconds', 0] }, { $gt: ['$expectedReadTime', 0] }] },
              { $divide: ['$durationSeconds', { $multiply: ['$expectedReadTime', 60] }] },
              null,
            ],
          },
        },
      },
    },
    {
      $match: {
        totalInteractions: { $gte: 2 },
      },
    },
    {
      $sort: { totalInteractions: -1 },
    },
  ]);
};

// Static method to get article length preference for learning
userInteractionSchema.statics.getLengthEngagement = async function (userId, days = 30) {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  return this.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        timestamp: { $gte: cutoff },
        action: { $in: [INTERACTION_TYPE.VIEW, INTERACTION_TYPE.CLICK] },
      },
    },
    {
      $lookup: {
        from: 'articles',
        localField: 'articleId',
        foreignField: '_id',
        as: 'article',
      },
    },
    {
      $unwind: '$article',
    },
    {
      $addFields: {
        lengthCategory: {
          $switch: {
            branches: [
              { case: { $lt: ['$article.content.readingTimeMinutes', 3] }, then: 'short' },
              { case: { $lte: ['$article.content.readingTimeMinutes', 7] }, then: 'medium' },
            ],
            default: 'long',
          },
        },
        readRatio: {
          $cond: [
            { $and: [{ $gt: ['$durationSeconds', 0] }, { $gt: ['$expectedReadTime', 0] }] },
            { $divide: ['$durationSeconds', { $multiply: ['$expectedReadTime', 60] }] },
            null,
          ],
        },
      },
    },
    {
      $group: {
        _id: '$lengthCategory',
        totalInteractions: { $sum: 1 },
        avgReadRatio: { $avg: '$readRatio' },
        avgScrollDepth: { $avg: '$scrollDepth' },
        completedReads: {
          $sum: { $cond: [{ $gte: ['$readRatio', 0.6] }, 1, 0] },
        },
      },
    },
    {
      $sort: { totalInteractions: -1 },
    },
  ]);
};

const UserInteraction = mongoose.model('UserInteraction', userInteractionSchema);

export default UserInteraction;
