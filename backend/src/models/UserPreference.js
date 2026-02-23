import mongoose from 'mongoose';
import { PREFERENCE_TYPE, PREFERENCE_SOURCE } from '../config/constants.js';

const userPreferenceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    preferenceType: {
      type: String,
      enum: Object.values(PREFERENCE_TYPE),
      required: [true, 'Preference type is required'],
    },
    preferenceValue: {
      type: String,
      required: [true, 'Preference value is required'],
      lowercase: true,
      trim: true,
    },
    weight: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.5,
    },
    source: {
      type: String,
      enum: Object.values(PREFERENCE_SOURCE),
      default: PREFERENCE_SOURCE.EXPLICIT,
    },
    clickCount: {
      type: Number,
      default: 0,
    },
    dismissCount: {
      type: Number,
      default: 0,
    },
    lastInteractionAt: {
      type: Date,
      default: null,
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
userPreferenceSchema.index({ userId: 1, active: 1 });
userPreferenceSchema.index({ userId: 1, weight: -1 });
userPreferenceSchema.index(
  { userId: 1, preferenceType: 1, preferenceValue: 1 },
  { unique: true }
);

// Instance method to increment click count
userPreferenceSchema.methods.recordClick = async function () {
  this.clickCount += 1;
  this.lastInteractionAt = new Date();
  // Slightly increase weight on click (capped at 1.0)
  this.weight = Math.min(1.0, this.weight + 0.02);
  return this.save();
};

// Instance method to increment dismiss count
userPreferenceSchema.methods.recordDismiss = async function () {
  this.dismissCount += 1;
  this.lastInteractionAt = new Date();
  // Slightly decrease weight on dismiss (minimum 0.1)
  this.weight = Math.max(0.1, this.weight - 0.03);
  return this.save();
};

// Static method to get user's active preferences sorted by weight
userPreferenceSchema.statics.getActivePreferences = function (userId) {
  return this.find({ userId, active: true })
    .sort({ weight: -1 })
    .lean();
};

// Static method to create or update a preference
userPreferenceSchema.statics.upsertPreference = async function (
  userId,
  preferenceType,
  preferenceValue,
  options = {}
) {
  const { weight = 0.5, source = PREFERENCE_SOURCE.EXPLICIT } = options;
  const normalizedValue = preferenceValue.toLowerCase().trim();

  return this.findOneAndUpdate(
    { userId, preferenceType, preferenceValue: normalizedValue },
    {
      $set: {
        preferenceType,
        weight,
        source,
        active: true,
      },
      $setOnInsert: {
        userId,
        preferenceValue: normalizedValue,
        clickCount: 0,
        dismissCount: 0,
        createdAt: new Date(),
      },
    },
    { upsert: true, new: true }
  );
};

// Static method to deactivate stale implicit preferences
userPreferenceSchema.statics.deactivateStalePreferences = function (
  userId,
  staleDays = 60
) {
  const cutoff = new Date(Date.now() - staleDays * 24 * 60 * 60 * 1000);
  return this.updateMany(
    {
      userId,
      source: PREFERENCE_SOURCE.IMPLICIT,
      lastInteractionAt: { $lt: cutoff },
      active: true,
    },
    { $set: { active: false } }
  );
};

const UserPreference = mongoose.model('UserPreference', userPreferenceSchema);

export default UserPreference;
