import mongoose from 'mongoose';

const userFeedCacheSchema = new mongoose.Schema(
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
    },
    relevance: {
      score: {
        type: Number,
        required: true,
        min: 0,
        max: 1,
      },
      matchedPreferences: [
        {
          preference: String,
          weight: Number,
        },
      ],
      scoreBreakdown: {
        preferenceMatch: {
          type: Number,
          default: 0,
        },
        recency: {
          type: Number,
          default: 0,
        },
        sourceQuality: {
          type: Number,
          default: 0,
        },
        engagement: {
          type: Number,
          default: 0,
        },
      },
    },
    position: {
      type: Number,
      required: true,
    },
    generatedAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
userFeedCacheSchema.index({ userId: 1, 'relevance.score': -1 });
userFeedCacheSchema.index({ userId: 1, position: 1 });

// TTL index - automatically delete expired cache entries
userFeedCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Compound index for efficient pagination
userFeedCacheSchema.index({ userId: 1, 'relevance.score': -1, articleId: 1 });

// Static method to get cached feed for user with pagination
userFeedCacheSchema.statics.getCachedFeed = async function (
  userId,
  options = {}
) {
  const { limit = 20, cursor = null } = options;

  let query = { userId };

  // Cursor-based pagination
  if (cursor) {
    const { score, id } = cursor;
    query.$or = [
      { 'relevance.score': { $lt: score } },
      {
        'relevance.score': score,
        articleId: { $gt: id },
      },
    ];
  }

  const items = await this.find(query)
    .sort({ 'relevance.score': -1, articleId: 1 })
    .limit(limit + 10) // Fetch extra to account for deleted articles
    .populate('articleId')
    .lean();

  // Filter out items where article was deleted (null after populate)
  const validItems = items.filter(item => item.articleId !== null);

  const hasMore = validItems.length > limit;
  const results = hasMore ? validItems.slice(0, limit) : validItems;

  // Generate next cursor
  let nextCursor = null;
  if (hasMore && results.length > 0) {
    const lastItem = results[results.length - 1];
    nextCursor = {
      score: lastItem.relevance.score,
      id: lastItem.articleId._id.toString(),
    };
  }

  return {
    items: results,
    nextCursor,
    hasMore,
  };
};

// Static method to clear cache for a user
userFeedCacheSchema.statics.clearUserCache = function (userId) {
  return this.deleteMany({ userId });
};

// Static method to bulk insert feed cache entries
userFeedCacheSchema.statics.bulkInsertFeed = async function (userId, feedItems) {
  // Clear existing cache first
  await this.clearUserCache(userId);

  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

  const cacheEntries = feedItems.map((item, index) => ({
    userId,
    articleId: item.article._id,
    relevance: item.relevance,
    position: index + 1,
    generatedAt: new Date(),
    expiresAt,
  }));

  return this.insertMany(cacheEntries);
};

// Static method to check if user has fresh cache
userFeedCacheSchema.statics.hasFreshCache = async function (
  userId,
  maxAgeMinutes = 30
) {
  const cutoff = new Date(Date.now() - maxAgeMinutes * 60 * 1000);
  const entry = await this.findOne({
    userId,
    generatedAt: { $gte: cutoff },
  });
  return !!entry;
};

const UserFeedCache = mongoose.model('UserFeedCache', userFeedCacheSchema);

export default UserFeedCache;
