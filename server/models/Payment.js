const mongoose = require('mongoose');
const isValidPhoneNumber = require('../utils/phoneNumber');

/**
 * Payment model for manual QR-code/UPI payment verification.
 * Tracks payments linked to Registrations (bookings) with status lifecycle:
 * PENDING -> APPROVED or REJECTED.
 */
const paymentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required'],
    },
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Registration',
      required: [true, 'Booking reference is required'],
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0, 'Amount cannot be negative'],
    },
    currency: {
      type: String,
      default: 'INR',
      trim: true,
      uppercase: true,
    },
    paymentMethod: {
      type: String,
      default: 'UPI_QR',
      trim: true,
    },
    transactionId: {
      type: String,
      required: [true, 'Transaction reference/UTR ID is required'],
      trim: true,
      uppercase: true,
      minlength: [4, 'Transaction ID must be at least 4 characters'],
      maxlength: [64, 'Transaction ID cannot exceed 64 characters'],
    },
    freeFireAccountName: {
      type: String,
      trim: true,
      maxlength: [80, 'Free Fire account name cannot exceed 80 characters'],
    },
    freeFireUid: {
      type: String,
      match: [/^\d{1,20}$/, 'Free Fire UID must contain 1 to 20 digits only'],
    },
    phoneNumber: {
      type: String,
      trim: true,
      validate: {
        validator: (value) => !value || isValidPhoneNumber(value),
        message: 'Please provide a valid phone number',
      },
    },
    paymentScreenshot: {
      type: String,
      required: [true, 'Payment screenshot is required'],
      trim: true,
    },
    note: {
      type: String,
      trim: true,
      maxlength: [500, 'Note cannot exceed 500 characters'],
      default: '',
    },
    status: {
      type: String,
      enum: {
        values: ['PENDING', 'APPROVED', 'REJECTED'],
        message: '{VALUE} is not a valid payment status',
      },
      default: 'PENDING',
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    rejectionReason: {
      type: String,
      trim: true,
      maxlength: [500, 'Rejection reason cannot exceed 500 characters'],
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
// Ensure single payment submission per booking
paymentSchema.index({ booking: 1 }, { unique: true });
// Ensure uniqueness of transaction reference (case-insensitive via uppercase)
paymentSchema.index({ transactionId: 1 }, { unique: true });
paymentSchema.index({ user: 1, createdAt: -1 });
paymentSchema.index({ status: 1, createdAt: -1 });

const Payment = mongoose.model('Payment', paymentSchema);

module.exports = Payment;
