const mongoose = require('mongoose');

const passwordResetSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    otpHash: {
      type: String,
      select: false,
    },
    otpExpiresAt: {
      type: Date,
      select: false,
    },
    otpAttempts: {
      type: Number,
      default: 0,
      select: false,
    },
    resendAvailableAt: {
      type: Date,
      select: false,
    },
    windowStartedAt: {
      type: Date,
      select: false,
    },
    resendCount: {
      type: Number,
      default: 0,
      select: false,
    },
    resetTokenHash: {
      type: String,
      select: false,
      index: true,
    },
    resetTokenExpiresAt: {
      type: Date,
      select: false,
    },
    usedAt: {
      type: Date,
      select: false,
    },
    expiresAt: {
      type: Date,
      required: true,
      expires: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PasswordReset', passwordResetSchema);
