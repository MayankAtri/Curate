import mongoose from 'mongoose';
import { SOURCE_TYPE, SOURCE_QUALITY, SUMMARY_STATUS } from '../config/constants.js';

const articleSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: [true, 'URL is required'],
      unique: true,
      trim: true,
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [500, 'Title cannot exceed 500 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    imageUrl: {
      type: String,
      default: null,
    },
    author: {
      type: String,
      trim: true,
      default: null,
    },
    source: {
      name: {
        type: String,
        required: true,
      },
      type: {
        type: String,
        enum: Object.values(SOURCE_TYPE),
        required: true,
      },
      url: {
        type: String,
      },
      quality: {
        type: String,
        enum: Object.values(SOURCE_QUALITY),
        default: SOURCE_QUALITY.TIER_2,
      },
    },
    publishedAt: {
      type: Date,
      required: [true, 'Published date is required'],
      index: true,
    },
    discoveredAt: {
      type: Date,
      default: Date.now,
    },
    summary: {
      text: {
        type: String,
        default: null,
      },
      keyPoints: {
        type: [String],
        default: [],
      },
      generatedAt: {
        type: Date,
        default: null,
      },
    },
    content: {
      text: {
        type: String,
        default: null,
      },
      wordCount: {
        type: Number,
        default: 0,
      },
      readingTimeMinutes: {
        type: Number,
        default: 0,
      },
    },
    topics: [
      {
        name: {
          type: String,
          required: true,
          lowercase: true,
        },
        confidence: {
          type: Number,
          min: 0,
          max: 1,
          default: 0.5,
        },
      },
    ],
    engagement: {
      upvotes: {
        type: Number,
        default: 0,
      },
      comments: {
        type: Number,
        default: 0,
      },
      score: {
        type: Number,
        default: 0,
      },
    },
    summaryStatus: {
      type: String,
      enum: Object.values(SUMMARY_STATUS),
      default: SUMMARY_STATUS.PENDING,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient querying
articleSchema.index({ url: 1 }, { unique: true });
articleSchema.index({ publishedAt: -1 });
articleSchema.index({ 'topics.name': 1 });
articleSchema.index({ summaryStatus: 1 });
articleSchema.index({ 'source.type': 1 });
articleSchema.index({ 'source.name': 1 });

// Compound index for feed generation queries
articleSchema.index({ publishedAt: -1, summaryStatus: 1 });

// Text index for search functionality
articleSchema.index({ title: 'text', description: 'text' });

// Instance method to check if article needs summarization
articleSchema.methods.needsSummarization = function () {
  return this.summaryStatus === SUMMARY_STATUS.PENDING;
};

// Instance method to get article preview (for feed)
articleSchema.methods.toFeedItem = function () {
  return {
    id: this._id,
    url: this.url,
    title: this.title,
    description: this.description,
    imageUrl: this.imageUrl,
    author: this.author,
    source: {
      name: this.source.name,
      type: this.source.type,
    },
    publishedAt: this.publishedAt,
    summary: this.summary.text ? {
      text: this.summary.text,
      keyPoints: this.summary.keyPoints,
    } : null,
    topics: this.topics,
    readingTimeMinutes: this.content.readingTimeMinutes,
  };
};

// Static method to find articles needing summarization
articleSchema.statics.findPendingSummarization = function (limit = 50) {
  return this.find({ summaryStatus: SUMMARY_STATUS.PENDING })
    .sort({ publishedAt: -1 })
    .limit(limit);
};

// Static method to find recent articles
articleSchema.statics.findRecent = function (days = 3, limit = 100) {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return this.find({
    publishedAt: { $gte: cutoff },
    summaryStatus: SUMMARY_STATUS.COMPLETED,
  })
    .sort({ publishedAt: -1 })
    .limit(limit);
};

const Article = mongoose.model('Article', articleSchema);

export default Article;
