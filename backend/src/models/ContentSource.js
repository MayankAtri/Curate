import mongoose from 'mongoose';
import { SOURCE_TYPE, SOURCE_QUALITY } from '../config/constants.js';

const contentSourceSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: Object.values(SOURCE_TYPE),
      required: [true, 'Source type is required'],
    },
    name: {
      type: String,
      required: [true, 'Source name is required'],
      trim: true,
    },
    identifier: {
      type: String,
      required: [true, 'Source identifier is required'],
      trim: true,
      // For RSS: feed URL, for Reddit: subreddit name, for Google News: search query
    },
    category: {
      type: String,
      lowercase: true,
      trim: true,
    },
    topics: {
      type: [String],
      default: [],
    },
    quality: {
      type: String,
      enum: Object.values(SOURCE_QUALITY),
      default: SOURCE_QUALITY.TIER_2,
    },
    active: {
      type: Boolean,
      default: true,
    },
    checkInterval: {
      type: Number,
      default: 30, // minutes
    },
    lastCheckedAt: {
      type: Date,
      default: null,
    },
    lastSuccessAt: {
      type: Date,
      default: null,
    },
    stats: {
      totalArticles: {
        type: Number,
        default: 0,
      },
      articlesLast24h: {
        type: Number,
        default: 0,
      },
      avgArticlesPerDay: {
        type: Number,
        default: 0,
      },
      successRate: {
        type: Number,
        default: 1.0,
      },
    },
    lastError: {
      type: String,
      default: null,
    },
    consecutiveFailures: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
contentSourceSchema.index({ type: 1, active: 1 });
contentSourceSchema.index({ category: 1 });
contentSourceSchema.index({ lastCheckedAt: 1 });
contentSourceSchema.index({ identifier: 1 }, { unique: true });

// Instance method to mark as checked (success)
contentSourceSchema.methods.markSuccess = async function (articlesFound = 0) {
  this.lastCheckedAt = new Date();
  this.lastSuccessAt = new Date();
  this.consecutiveFailures = 0;
  this.lastError = null;
  this.stats.totalArticles += articlesFound;

  // Update success rate (rolling average)
  const attempts = Math.min(100, this.stats.totalArticles + 1);
  this.stats.successRate =
    (this.stats.successRate * (attempts - 1) + 1) / attempts;

  return this.save();
};

// Instance method to mark as failed
contentSourceSchema.methods.markFailure = async function (error) {
  this.lastCheckedAt = new Date();
  this.consecutiveFailures += 1;
  this.lastError = error.message || error;

  // Update success rate
  const attempts = Math.min(100, this.stats.totalArticles + 1);
  this.stats.successRate =
    (this.stats.successRate * (attempts - 1)) / attempts;

  // Auto-disable after 10 consecutive failures
  if (this.consecutiveFailures >= 10) {
    this.active = false;
  }

  return this.save();
};

// Instance method to check if source needs checking
contentSourceSchema.methods.needsCheck = function () {
  if (!this.lastCheckedAt) return true;

  const minutesSinceLastCheck =
    (Date.now() - this.lastCheckedAt.getTime()) / (1000 * 60);

  return minutesSinceLastCheck >= this.checkInterval;
};

// Static method to get sources that need checking
contentSourceSchema.statics.getSourcesNeedingCheck = async function () {
  const sources = await this.find({ active: true });
  return sources.filter((source) => source.needsCheck());
};

// Static method to get active sources by type
contentSourceSchema.statics.getActiveByType = function (type) {
  return this.find({ type, active: true });
};

// Static method to get sources by category
contentSourceSchema.statics.getByCategory = function (category) {
  return this.find({ category: category.toLowerCase(), active: true });
};

// Static method to upsert a source
contentSourceSchema.statics.upsertSource = async function (sourceData) {
  return this.findOneAndUpdate(
    { identifier: sourceData.identifier },
    {
      $set: sourceData,
      $setOnInsert: {
        stats: {
          totalArticles: 0,
          articlesLast24h: 0,
          avgArticlesPerDay: 0,
          successRate: 1.0,
        },
        consecutiveFailures: 0,
        createdAt: new Date(),
      },
    },
    { upsert: true, new: true }
  );
};

const ContentSource = mongoose.model('ContentSource', contentSourceSchema);

export default ContentSource;
