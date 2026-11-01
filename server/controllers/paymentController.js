const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Payment = require('../models/Payment');
const TestPayment = require('../models/TestPayment');
const Registration = require('../models/Registration');
const AppError = require('../utils/AppError');
const env = require('../config/env');
const { sendEmail } = require('../utils/emailService');
const generateConfirmationEmail = require('../templates/confirmationEmail');
const generatePaymentRejectedEmail = require('../templates/paymentRejectedEmail');
const escapeRegex = require('../utils/escapeRegex');
const isValidPhoneNumber = require('../utils/phoneNumber');
const {
  getImageExtension,
  getImageExtensionForMime,
} = require('../utils/imageFile');
const { isPaidEvent } = require('../utils/eventPricing');

const UPLOADS_DIR = path.resolve(__dirname, '..', 'uploads');

const requireDevelopmentMode = () => {
  if (env.NODE_ENV === 'production') {
    throw new AppError('Development test payments are disabled in production', 404);
  }
};

/**
 * Get Payment / QR Configuration
 * GET /api/payments/config
 */
const getPaymentConfig = async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      data: {
        upiId: env.UPI_ID,
        paymentQrUrl: env.PAYMENT_QR_URL || null,
        maxFileSizeMb: env.MAX_PAYMENT_SCREENSHOT_SIZE_MB,
        currency: 'INR',
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Submit manual QR payment verification
 * POST /api/payments
 */
const createPayment = async (req, res, next) => {
  let createdFilePath = null;
  let oldScreenshotPath = null;
  let booking = null;
  let previousBookingState = null;
  let bookingStateChanged = false;
  let paymentSaved = false;

  try {
    const { bookingId, transactionId, note } = req.body;
    const freeFireAccountName = typeof req.body.freeFireAccountName === 'string'
      ? req.body.freeFireAccountName.trim()
      : '';
    const freeFireUid = typeof req.body.freeFireUid === 'string'
      ? req.body.freeFireUid
      : '';
    const phoneNumber = typeof req.body.phoneNumber === 'string'
      ? req.body.phoneNumber.trim()
      : '';
    const userId = req.user._id;

    if (!bookingId) {
      throw new AppError('Booking ID is required', 400);
    }

    if (!transactionId || !transactionId.trim()) {
      throw new AppError('Transaction ID / UTR reference is required', 400);
    }
    if (!freeFireAccountName) {
      throw new AppError('Free Fire account name is required', 400);
    }
    if (freeFireAccountName.length > 80) {
      throw new AppError('Free Fire account name cannot exceed 80 characters', 400);
    }
    if (!/^\d{1,20}$/.test(freeFireUid)) {
      throw new AppError('Free Fire UID must contain 1 to 20 digits only', 400);
    }
    if (!isValidPhoneNumber(phoneNumber)) {
      throw new AppError('Please provide a valid phone number', 400);
    }

    const normalizedTxId = transactionId.trim().toUpperCase();

    // Validate screenshot upload
    if (!req.file) {
      throw new AppError('Payment screenshot is required', 400);
    }

    const maxBytes = env.MAX_PAYMENT_SCREENSHOT_SIZE_MB * 1024 * 1024;
    if (req.file.size > maxBytes) {
      throw new AppError(
        `Screenshot exceeds maximum allowed size of ${env.MAX_PAYMENT_SCREENSHOT_SIZE_MB}MB`,
        400
      );
    }

    const actualExtension = getImageExtension(req.file.buffer);
    const extensionFromMime = getImageExtensionForMime(req.file.mimetype);
    if (!actualExtension || actualExtension !== extensionFromMime) {
      throw new AppError('Uploaded file content does not match a supported image format', 400);
    }

    // Fetch booking
    booking = await Registration.findById(bookingId).populate('event');

    if (!booking) {
      throw new AppError('Booking not found', 404);
    }

    // Authorization: booking must belong to user unless admin
    if (booking.user.toString() !== userId.toString()) {
      throw new AppError('Not authorized to submit payment for this booking', 403);
    }

    if (booking.status === 'cancelled') {
      throw new AppError('Cannot pay for a cancelled booking', 400);
    }
    if (!['pending', 'confirmed'].includes(booking.status)) {
      throw new AppError('This registration is not eligible for payment', 409);
    }

    // Verify booking is not already marked as paid/approved
    if (booking.paymentStatus === 'APPROVED') {
      throw new AppError('Booking is already paid and verified', 400);
    }

    // Server-side source of truth for payable amount: Never trust client amount
    const payableAmount = Number(booking.event?.price) || 0;
    if (!isPaidEvent(booking.event) || payableAmount <= 0) {
      throw new AppError('This event is free; no payment is required', 400);
    }

    // Check for duplicate payment submissions for this booking
    const existingPaymentForBooking = await Payment.findOne({ booking: booking._id });
    if (existingPaymentForBooking) {
      if (existingPaymentForBooking.status === 'APPROVED') {
        throw new AppError('Payment for this booking has already been verified and approved', 409);
      }
      if (existingPaymentForBooking.status === 'PENDING') {
        throw new AppError('A payment submission for this booking is already awaiting verification', 409);
      }
    }

    // Check for duplicate transaction ID across all payments
    const existingTx = await Payment.findOne({ transactionId: normalizedTxId });
    if (
      existingTx &&
      (!existingPaymentForBooking || existingTx._id.toString() !== existingPaymentForBooking._id.toString())
    ) {
      throw new AppError('This transaction reference ID has already been submitted', 409);
    }

    // Save screenshot safely to uploads directory
    const safeFilename = `payment-${booking._id}-${Date.now()}-${crypto.randomUUID()}.${actualExtension}`;
    const targetPath = path.join(UPLOADS_DIR, safeFilename);

    await fs.promises.writeFile(targetPath, req.file.buffer);
    createdFilePath = targetPath;

    const screenshotUrl = `/uploads/${safeFilename}`;

    previousBookingState = {
      status: booking.status,
      paymentStatus: booking.paymentStatus,
    };
    booking.paymentStatus = 'PENDING';
    booking.status = 'pending';
    await booking.save();
    bookingStateChanged = true;

    const paymentData = {
      user: userId,
      booking: booking._id,
      amount: payableAmount,
      currency: 'INR',
      paymentMethod: 'UPI_QR',
      transactionId: normalizedTxId,
      freeFireAccountName,
      freeFireUid,
      phoneNumber,
      paymentScreenshot: screenshotUrl,
      note: note ? note.trim() : '',
      status: 'PENDING',
      reviewedBy: null,
      reviewedAt: null,
      rejectionReason: '',
    };
    let payment;
    if (existingPaymentForBooking) {
      payment = await Payment.findOneAndUpdate(
        { _id: existingPaymentForBooking._id, status: 'REJECTED' },
        { $set: paymentData },
        { returnDocument: 'after', runValidators: true }
      );
      if (!payment) {
        throw new AppError('Payment status changed while submitting; reload and try again', 409);
      }
      oldScreenshotPath = existingPaymentForBooking.paymentScreenshot;
    } else {
      payment = await Payment.create(paymentData);
    }
    paymentSaved = true;

    if (oldScreenshotPath?.startsWith('/uploads/')) {
      const oldFilePath = path.resolve(UPLOADS_DIR, path.basename(oldScreenshotPath));
      if (oldFilePath !== createdFilePath) {
        fs.promises.unlink(oldFilePath).catch((err) => {
          if (err.code !== 'ENOENT') console.error('Failed to remove replaced payment screenshot:', err.message);
        });
      }
    }

    res.status(201).json({
      success: true,
      message: 'Payment details submitted successfully. Your payment is awaiting verification.',
      data: {
        payment: {
          id: payment._id,
          booking: payment.booking,
          amount: payment.amount,
          currency: payment.currency,
          paymentMethod: payment.paymentMethod,
          transactionId: payment.transactionId,
          freeFireAccountName: payment.freeFireAccountName,
          freeFireUid: payment.freeFireUid,
          paymentScreenshot: payment.paymentScreenshot,
          status: payment.status,
          createdAt: payment.createdAt,
        },
      },
    });
  } catch (err) {
    if (!paymentSaved && bookingStateChanged && booking && previousBookingState) {
      try {
        const pendingPaymentExists = await Payment.exists({
          booking: booking._id,
          status: 'PENDING',
        });
        if (!pendingPaymentExists) {
          await Registration.findOneAndUpdate(
            { _id: booking._id, status: 'pending', paymentStatus: 'PENDING' },
            { $set: previousBookingState }
          );
        }
      } catch (rollbackError) {
        console.error('Failed to restore registration after payment submission error:', rollbackError.message);
      }
    }
    if (createdFilePath && !paymentSaved) {
      fs.promises.unlink(createdFilePath).catch((cleanupError) => {
        if (cleanupError.code !== 'ENOENT') {
          console.error('Failed to remove incomplete payment screenshot:', cleanupError.message);
        }
      });
    }
    next(err);
  }
};

/**
 * Get current user's payments
 * GET /api/payments/my
 */
const getMyPayments = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    const filter = { user: req.user._id };
    if (status && ['PENDING', 'APPROVED', 'REJECTED'].includes(status.toUpperCase())) {
      filter.status = status.toUpperCase();
    }

    const [payments, total] = await Promise.all([
      Payment.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate({
          path: 'booking',
          select: 'confirmationCode status paymentStatus event registeredAt teamMode gameMode teamSize players',
          populate: {
            path: 'event',
            select: 'title slug date time location price currency teamMode gameMode teamSize',
          },
        })
        .select('-__v'),
      Payment.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: {
        payments,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get a payment by ID or booking ID
 * GET /api/payments/:id
 */
const getPaymentById = async (req, res, next) => {
  try {
    const { id } = req.params;

    let payment = await Payment.findById(id)
      .populate('user', 'name email phone avatar')
      .populate({
        path: 'booking',
        select: 'confirmationCode status paymentStatus event registeredAt notes teamMode gameMode teamSize players',
        populate: {
          path: 'event',
          select: 'title slug date time location price currency registeredCount capacity teamMode gameMode teamSize',
        },
      })
      .populate('reviewedBy', 'name email');

    // Also allow finding by booking ID if requested
    if (!payment) {
      payment = await Payment.findOne({ booking: id })
        .populate('user', 'name email phone avatar')
        .populate({
          path: 'booking',
          select: 'confirmationCode status paymentStatus event registeredAt notes teamMode gameMode teamSize players',
          populate: {
            path: 'event',
            select: 'title slug date time location price currency registeredCount capacity teamMode gameMode teamSize',
          },
        })
        .populate('reviewedBy', 'name email');
    }

    if (!payment) {
      throw new AppError('Payment not found', 404);
    }

    // Authorization check
    const isOwner = payment.user._id.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      throw new AppError('Not authorized to view this payment', 403);
    }

    res.status(200).json({
      success: true,
      data: { payment },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get all payments (Admin only)
 * GET /api/payments/admin/all
 */
const getAllPayments = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status, search, bookingId } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    const filter = {};
    if (status && ['PENDING', 'APPROVED', 'REJECTED'].includes(status.toUpperCase())) {
      filter.status = status.toUpperCase();
    }

    if (bookingId) {
      filter.booking = bookingId;
    }

    if (search && search.trim()) {
      const term = escapeRegex(search.trim());
      filter.$or = [
        { transactionId: { $regex: term, $options: 'i' } },
      ];
    }

    const [payments, total, allTotal, pendingCount, approvedCount, rejectedCount] = await Promise.all([
      Payment.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('user', 'name email phone avatar')
        .populate({
          path: 'booking',
          select: 'confirmationCode status paymentStatus event registeredAt teamMode gameMode teamSize players',
          populate: {
            path: 'event',
            select: 'title slug date time location price currency teamMode gameMode teamSize',
          },
        })
        .populate('reviewedBy', 'name email')
        .select('-__v'),
      Payment.countDocuments(filter),
      Payment.countDocuments(),
      Payment.countDocuments({ status: 'PENDING' }),
      Payment.countDocuments({ status: 'APPROVED' }),
      Payment.countDocuments({ status: 'REJECTED' }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        payments,
        stats: {
          total: allTotal,
          pending: pendingCount,
          approved: approvedCount,
          rejected: rejectedCount,
        },
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Review payment: Approve or Reject (Admin only)
 * PATCH /api/payments/admin/:id/review
 */
const reviewPayment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { action, rejectionReason } = req.body;
    const adminId = req.user._id;

    if (!['APPROVE', 'REJECT'].includes(action)) {
      throw new AppError('Action must be either APPROVE or REJECT', 400);
    }

    if (action === 'REJECT' && (!rejectionReason || !rejectionReason.trim())) {
      throw new AppError('A rejection reason is required when rejecting a payment', 400);
    }

    const payment = await Payment.findById(id)
      .populate({
        path: 'booking',
        populate: { path: 'event', select: 'title slug date time location price pricingType currency' },
      })
      .populate('user', 'name email');
    if (!payment) {
      throw new AppError('Payment not found', 404);
    }

    // Prevent repeated or conflicting reviews
    if (payment.status !== 'PENDING') {
      throw new AppError(
        `Payment has already been reviewed with status: ${payment.status}`,
        400
      );
    }

    if (!payment.booking || payment.booking.status === 'cancelled' || payment.booking.status === 'attended') {
      throw new AppError('This registration can no longer be reviewed', 409);
    }

    if (
      action === 'APPROVE' &&
      (
        !isPaidEvent(payment.booking.event) ||
        Number(payment.booking.event?.price) <= 0 ||
        payment.booking.paymentStatus !== 'PENDING' ||
        payment.amount !== payment.booking.event?.price
      )
    ) {
      throw new AppError('Registration is not awaiting genuine payment verification', 409);
    }

    const newPaymentStatus = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    const reviewedPayment = await Payment.findOneAndUpdate(
      { _id: id, status: 'PENDING' },
      {
        $set: {
          status: newPaymentStatus,
          reviewedBy: adminId,
          reviewedAt: new Date(),
          rejectionReason: action === 'REJECT' ? rejectionReason.trim() : '',
        },
      },
      { returnDocument: 'after', runValidators: true }
    );
    if (!reviewedPayment) {
      throw new AppError('Payment has already been reviewed', 409);
    }

    const registrationStatus = action === 'APPROVE' ? 'confirmed' : 'pending';
    const registration = await Registration.findOneAndUpdate(
      {
        _id: payment.booking._id,
        status: { $in: ['pending', 'confirmed'] },
        paymentStatus: 'PENDING',
      },
      {
        $set: {
          status: registrationStatus,
          paymentStatus: newPaymentStatus,
        },
      },
      { returnDocument: 'after' }
    ).populate('event', 'title slug date time location');

    if (!registration) {
      await Payment.findOneAndUpdate(
        { _id: id, status: newPaymentStatus, reviewedBy: adminId },
        { $set: { status: 'PENDING', reviewedBy: null, reviewedAt: null, rejectionReason: '' } }
      );
      throw new AppError('Registration status changed before the review completed', 409);
    }

    await reviewedPayment.populate('reviewedBy', 'name email');
    await reviewedPayment.populate('user', 'name email');
    await reviewedPayment.populate('booking', 'confirmationCode status paymentStatus event registeredAt');

    if (action === 'APPROVE' && payment.user?.email) {
      const event = registration.event;
      sendEmail({
        to: payment.user.email,
        subject: `Payment Verified — ${event.title}`,
        html: generateConfirmationEmail({
          userName: payment.user.name,
          eventTitle: event.title,
          eventDate: event.date,
          eventTime: event.time || 'TBA',
          venue: event.location?.venue || '',
          city: event.location?.city || '',
          confirmationCode: registration.confirmationCode,
          eventSlug: event.slug,
        }),
      }).catch((err) => console.error('Payment confirmation email failed:', err.message));
    } else if (action === 'REJECT' && payment.user?.email) {
      sendEmail({
        to: payment.user.email,
        subject: `Payment Needs Attention — ${registration.event?.title || 'Event Booking'}`,
        html: generatePaymentRejectedEmail({
          userName: payment.user.name,
          eventTitle: registration.event?.title || 'Event Booking',
          rejectionReason: rejectionReason.trim(),
        }),
      }).catch((err) => console.error('Payment rejection email failed:', err.message));
    }

    res.status(200).json({
      success: true,
      message: `Payment successfully ${action === 'APPROVE' ? 'approved' : 'rejected'}`,
      data: {
        payment: reviewedPayment,
      },
    });
  } catch (err) {
    next(err);
  }
};

const createTestPayment = async (req, res, next) => {
  try {
    requireDevelopmentMode();
    const { bookingId } = req.body;
    const registration = await Registration.findById(bookingId).populate('event', 'price pricingType currency');
    if (!registration) throw new AppError('Registration not found', 404);
    if (registration.user.toString() !== req.user._id.toString()) {
      throw new AppError('Not authorized to create a test payment for this registration', 403);
    }
    if (
      registration.status !== 'pending' ||
      registration.paymentStatus !== 'PENDING' ||
      !registration.event ||
      !isPaidEvent(registration.event) ||
      Number(registration.event.price) <= 0
    ) {
      throw new AppError('A test payment is only available for an unverified paid registration', 400);
    }

    const [genuinePayment, existingTestPayment] = await Promise.all([
      Payment.findOne({ booking: registration._id }),
      TestPayment.findOne({ booking: registration._id }),
    ]);
    if (genuinePayment || existingTestPayment) {
      throw new AppError('A payment record already exists for this registration', 409);
    }

    const testPayment = await TestPayment.create({
      user: req.user._id,
      booking: registration._id,
      amount: registration.event.price,
      currency: 'INR',
      transactionId: `TEST_ONLY-${crypto.randomUUID().toUpperCase()}`,
      testOnly: true,
      status: 'PENDING',
    });

    res.status(201).json({
      success: true,
      message: 'TEST ONLY payment created for development review. No money was transferred and no ticket was confirmed.',
      data: { payment: testPayment },
    });
  } catch (err) {
    next(err);
  }
};

const getAllTestPayments = async (req, res, next) => {
  try {
    requireDevelopmentMode();
    const pageNum = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const filter = {};
    if (req.query.status && ['PENDING', 'APPROVED', 'REJECTED'].includes(req.query.status.toUpperCase())) {
      filter.status = req.query.status.toUpperCase();
    }

    const [payments, total, pending, approved, rejected] = await Promise.all([
      TestPayment.find(filter)
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .populate('user', 'name email phone')
        .populate({
          path: 'booking',
          select: 'confirmationCode status paymentStatus event registeredAt',
          populate: { path: 'event', select: 'title slug price currency' },
        })
        .populate('reviewedBy', 'name email')
        .select('-__v'),
      TestPayment.countDocuments(filter),
      TestPayment.countDocuments({ status: 'PENDING' }),
      TestPayment.countDocuments({ status: 'APPROVED' }),
      TestPayment.countDocuments({ status: 'REJECTED' }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        payments,
        stats: { total, pending, approved, rejected },
        pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
      },
    });
  } catch (err) {
    next(err);
  }
};

const reviewTestPayment = async (req, res, next) => {
  try {
    requireDevelopmentMode();
    const { action, rejectionReason } = req.body;
    if (action === 'REJECT' && !rejectionReason?.trim()) {
      throw new AppError('A rejection reason is required when rejecting a test payment', 400);
    }

    const status = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    const payment = await TestPayment.findOneAndUpdate(
      { _id: req.params.id, status: 'PENDING' },
      {
        $set: {
          status,
          reviewedBy: req.user._id,
          reviewedAt: new Date(),
          rejectionReason: action === 'REJECT' ? rejectionReason.trim() : '',
        },
      },
      { returnDocument: 'after', runValidators: true }
    )
      .populate('user', 'name email')
      .populate('reviewedBy', 'name email')
      .populate({ path: 'booking', populate: { path: 'event', select: 'title' } });

    if (!payment) {
      const exists = await TestPayment.exists({ _id: req.params.id });
      throw new AppError(exists ? 'Test payment has already been reviewed' : 'Test payment not found', exists ? 409 : 404);
    }

    res.status(200).json({
      success: true,
      message: `TEST ONLY payment ${action === 'APPROVE' ? 'approved' : 'rejected'}. No genuine ticket or payment confirmation was created.`,
      data: { payment },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getPaymentConfig,
  createPayment,
  getMyPayments,
  getPaymentById,
  getAllPayments,
  reviewPayment,
  createTestPayment,
  getAllTestPayments,
  reviewTestPayment,
  getImageExtension,
};
