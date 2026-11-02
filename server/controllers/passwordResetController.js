const crypto = require('crypto');
const User = require('../models/User');
const PasswordReset = require('../models/PasswordReset');
const AppError = require('../utils/AppError');
const env = require('../config/env');
const { sendPasswordResetEmail } = require('../utils/emailService');
const generatePasswordResetEmail = require('../templates/passwordResetEmail');

const OTP_TTL_MS = 5 * 60 * 1000;
const RESET_TOKEN_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const RESEND_WINDOW_MS = 15 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;
const MAX_EMAILS_PER_WINDOW = 5;
const GENERIC_MESSAGE =
  'If an active account exists for this address, a verification code will be sent.';

const getHashSecret = () => {
  const secret = env.EMAIL_OTP_SECRET || env.JWT_SECRET;
  if (!secret) {
    throw new AppError(
      'Password reset is not configured. Set EMAIL_OTP_SECRET or JWT_SECRET.',
      503
    );
  }
  return secret;
};

const hashValue = (value) =>
  crypto.createHmac('sha256', getHashSecret()).update(value).digest('hex');

const hashOtp = (resetId, otp) => hashValue(`${resetId}:${otp}`);
const hashResetToken = (token) => hashValue(`reset-token:${token}`);

const clearOtp = async (reset) => {
  await PasswordReset.updateOne(
    { _id: reset._id },
    {
      $unset: { otpHash: 1, otpExpiresAt: 1 },
      $set: { otpAttempts: 0 },
    }
  );
};

const issueOtp = async (user, existingReset = null) => {
  const now = new Date();
  const otp = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
  getHashSecret();

  let reset = existingReset;
  if (reset) {
    const cooldownRemaining = reset.resendAvailableAt?.getTime() - now.getTime();
    if (cooldownRemaining > 0) return false;

    const withinWindow =
      reset.windowStartedAt &&
      now.getTime() - reset.windowStartedAt.getTime() < RESEND_WINDOW_MS;
    if (withinWindow && reset.resendCount >= MAX_EMAILS_PER_WINDOW) return false;

    const filter = {
      _id: reset._id,
      user: user._id,
      resendAvailableAt: reset.resendAvailableAt
        ? { $lte: now, $eq: reset.resendAvailableAt }
        : { $exists: false },
      windowStartedAt: reset.windowStartedAt
        ? reset.windowStartedAt
        : { $exists: false },
    };
    const update = {
      $set: {
        otpHash: hashOtp(reset._id, otp),
        otpExpiresAt: new Date(now.getTime() + OTP_TTL_MS),
        otpAttempts: 0,
        resendAvailableAt: new Date(now.getTime() + RESEND_COOLDOWN_MS),
        expiresAt: new Date(now.getTime() + OTP_TTL_MS),
      },
      $unset: { resetTokenHash: 1, resetTokenExpiresAt: 1, usedAt: 1 },
    };
    if (withinWindow) update.$inc = { resendCount: 1 };
    else {
      update.$set.windowStartedAt = now;
      update.$set.resendCount = 1;
    }
    reset = await PasswordReset.findOneAndUpdate(filter, update, {
      returnDocument: 'after',
    }).select('+otpHash +otpExpiresAt +otpAttempts');
    if (!reset) return false;
  } else {
    try {
      reset = new PasswordReset({
        user: user._id,
        otpHash: 'pending',
        otpExpiresAt: new Date(now.getTime() + OTP_TTL_MS),
        otpAttempts: 0,
        resendAvailableAt: new Date(now.getTime() + RESEND_COOLDOWN_MS),
        windowStartedAt: now,
        resendCount: 1,
        expiresAt: new Date(now.getTime() + OTP_TTL_MS),
      });
      reset.otpHash = hashOtp(reset._id, otp);
      await reset.save();
    } catch (error) {
      if (error.code === 11000) return false;
      throw error;
    }
  }

  try {
    await sendPasswordResetEmail({
      to: user.email,
      subject: 'Your EventBooking password reset code',
      html: generatePasswordResetEmail({ userName: user.name, otp }),
    });
    return true;
  } catch (error) {
    await clearOtp(reset);
    console.error(
      'Password reset email delivery failed. Check Resend configuration and service logs.',
      { code: error.code || 'EMAIL_DELIVERY_FAILED' }
    );
    return false;
  }
};

const respondGeneric = (res, statusCode = 202) =>
  res.status(statusCode).json({
    success: true,
    message: GENERIC_MESSAGE,
    data: {
      expiresInSeconds: OTP_TTL_MS / 1000,
      resendCooldownSeconds: RESEND_COOLDOWN_MS / 1000,
    },
  });

const requestPasswordReset = async (req, res, next) => {
  try {
    getHashSecret();
    const email = req.body.email;
    const user = await User.findOne({
      email,
      isActive: true,
      $or: [{ emailVerified: true }, { emailVerified: { $exists: false } }],
    }).select('name email');

    if (!user) return respondGeneric(res);

    const reset = await PasswordReset.findOne({ user: user._id }).select(
      '+otpHash +otpExpiresAt +otpAttempts +resendAvailableAt +windowStartedAt +resendCount +resetTokenHash +resetTokenExpiresAt +usedAt'
    );
    if (!reset) {
      await issueOtp(user);
    } else {
      await issueOtp(user, reset);
    }

    return respondGeneric(res);
  } catch (error) {
    next(error);
  }
};

const resendPasswordResetOtp = async (req, res, next) => {
  try {
    getHashSecret();
    const user = await User.findOne({
      email: req.body.email,
      isActive: true,
      $or: [{ emailVerified: true }, { emailVerified: { $exists: false } }],
    }).select('name email');
    if (user) {
      const reset = await PasswordReset.findOne({ user: user._id }).select(
        '+otpHash +otpExpiresAt +otpAttempts +resendAvailableAt +windowStartedAt +resendCount +resetTokenHash +resetTokenExpiresAt +usedAt'
      );
      if (reset) await issueOtp(user, reset);
      else await issueOtp(user);
    }
    return respondGeneric(res, 200);
  } catch (error) {
    next(error);
  }
};

const verifyPasswordResetOtp = async (req, res, next) => {
  try {
    const user = await User.findOne({
      email: req.body.email,
      isActive: true,
      $or: [{ emailVerified: true }, { emailVerified: { $exists: false } }],
    }).select('_id');
    const reset = user
      ? await PasswordReset.findOne({ user: user._id }).select(
          '+otpHash +otpExpiresAt +otpAttempts'
        )
      : null;

    if (!reset || !reset.otpHash || !reset.otpExpiresAt) {
      throw new AppError('The verification code is invalid or expired.', 400);
    }
    if ((reset.otpAttempts || 0) >= MAX_OTP_ATTEMPTS) {
      throw new AppError(
        'Too many incorrect codes. Request a new verification code.',
        429
      );
    }

    const now = new Date();
    if (reset.otpExpiresAt <= now) {
      await clearOtp(reset);
      throw new AppError(
        'The verification code has expired. Request a new code.',
        410
      );
    }

    const otp =
      typeof req.body.otp === 'string' ? req.body.otp : String(req.body.otp);
    const candidateHash =
      /^\d{6}$/.test(otp) ? Buffer.from(hashOtp(reset._id, otp), 'hex') : null;
    const storedHash = Buffer.from(reset.otpHash, 'hex');
    const matches = Boolean(
      candidateHash &&
        candidateHash.length === storedHash.length &&
        crypto.timingSafeEqual(candidateHash, storedHash)
    );

    if (!matches) {
      const attempt = await PasswordReset.updateOne(
        {
          _id: reset._id,
          otpHash: reset.otpHash,
          otpExpiresAt: { $gt: now },
          otpAttempts: { $lt: MAX_OTP_ATTEMPTS },
        },
        { $inc: { otpAttempts: 1 } }
      );
      if (attempt.modifiedCount !== 1) {
        throw new AppError(
          'Too many incorrect codes. Request a new verification code.',
          429
        );
      }
      const atLimit = (reset.otpAttempts || 0) + 1 >= MAX_OTP_ATTEMPTS;
      throw new AppError(
        atLimit
          ? 'Too many incorrect codes. Request a new verification code.'
          : 'The verification code is incorrect.',
        atLimit ? 429 : 400
      );
    }

    const resetToken = crypto.randomBytes(32).toString('base64url');
    const tokenExpiry = new Date(now.getTime() + RESET_TOKEN_TTL_MS);
    const verified = await PasswordReset.findOneAndUpdate(
      {
        _id: reset._id,
        otpHash: reset.otpHash,
        otpExpiresAt: { $gt: now },
        otpAttempts: { $lt: MAX_OTP_ATTEMPTS },
      },
      {
        $set: {
          resetTokenHash: hashResetToken(resetToken),
          resetTokenExpiresAt: tokenExpiry,
          expiresAt: tokenExpiry,
          otpAttempts: 0,
        },
        $unset: { otpHash: 1, otpExpiresAt: 1 },
      },
      { returnDocument: 'after' }
    );

    if (!verified) {
      throw new AppError('The verification code is invalid or expired.', 400);
    }

    return res.status(200).json({
      success: true,
      message: 'Verification successful. Create a new password.',
      data: {
        resetToken,
        expiresInSeconds: RESET_TOKEN_TTL_MS / 1000,
      },
    });
  } catch (error) {
    next(error);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const now = new Date();
    const resetRecord = await PasswordReset.findOneAndUpdate(
      {
        resetTokenHash: hashResetTokenForLookup(req.body.resetToken),
        resetTokenExpiresAt: { $gt: now },
        usedAt: { $exists: false },
      },
      {
        $set: { usedAt: now, expiresAt: new Date(now.getTime() + 86400000) },
        $unset: { resetTokenHash: 1, resetTokenExpiresAt: 1 },
      },
      { returnDocument: 'after' }
    );

    if (!resetRecord) {
      throw new AppError(
        'Password reset authorization is invalid or expired. Request a new code.',
        401
      );
    }

    const user = await User.findById(resetRecord.user).select('+password');
    if (!user || !user.isActive || user.emailVerified === false) {
      throw new AppError('Password reset authorization is invalid or expired.', 401);
    }

    user.password = req.body.newPassword;
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Your password has been reset successfully.',
    });
  } catch (error) {
    next(error);
  }
};

const hashResetTokenForLookup = (token) => {
  if (typeof token !== 'string' || token.length > 256) {
    return 'invalid-reset-token';
  }
  return hashResetToken(token);
};

module.exports = {
  requestPasswordReset,
  verifyPasswordResetOtp,
  resendPasswordResetOtp,
  resetPassword,
};
