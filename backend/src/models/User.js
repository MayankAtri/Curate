import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
    },
    username: {
      type: String,
      required: [true, 'Username is required'],
      trim: true,
      minlength: [2, 'Username must be at least 2 characters'],
      maxlength: [50, 'Username cannot exceed 50 characters'],
    },
    passwordHash: {
      type: String,
      required: [true, 'Password is required'],
    },
    avatar: {
      type: String,
      default: null,
    },
    settings: {
      emailDigest: {
        type: Boolean,
        default: true,
      },
      digestTime: {
        type: String,
        default: '08:00',
      },
      articlesPerPage: {
        type: Number,
        default: 20,
        min: 5,
        max: 50,
      },
      theme: {
        type: String,
        enum: ['light', 'dark', 'system'],
        default: 'light',
      },
    },
    lastActiveAt: {
      type: Date,
      default: Date.now,
    },
    onboardingCompleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ lastActiveAt: -1 });

// Instance method to get public profile (without sensitive data)
userSchema.methods.toPublicJSON = function () {
  return {
    id: this._id,
    email: this.email,
    username: this.username,
    avatar: this.avatar,
    settings: this.settings,
    onboardingCompleted: this.onboardingCompleted,
    createdAt: this.createdAt,
  };
};

// Static method to find active users (logged in within X days)
userSchema.statics.findActiveUsers = function (days = 7) {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return this.find({ lastActiveAt: { $gte: cutoff } });
};

const User = mongoose.model('User', userSchema);

export default User;
