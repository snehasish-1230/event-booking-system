const mongoose = require('mongoose');
const crypto = require('crypto');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const isValidPhoneNumber = require('../utils/phoneNumber');
const generateToken = require('../utils/generateToken');
const env = require('../config/env');
const { sendVerificationEmail } = require('../utils/emailService');
const generateEmailVerificationEmail = require('../templates/emailVerificationEmail');

const LOCK_TIME_MS = 15 * 60 * 1000; // 15 minutes
const MAX_LOGIN_ATTEMPTS = 5;
const MAX_LOGIN_COUNTER_RETRIES = 50;
const ALLOWED_ROLES = ['attendee', 'organizer'];
const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const OTP_RESEND_WINDOW_MS = 15 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;
const MAX_OTP_EMAILS_PER_WINDOW = 5;
const GENERIC_RESEND_MESSAGE =
  'If this address is eligible for verification, a new code will be sent.';

const getOtpHashSecret = () => {
  const secret = env.EMAIL_OTP_SECRET || env.JWT_SECRET;
  if (!secret) {
    throw new AppError(
      'Email verification is not configured. Set EMAIL_OTP_SECRET or JWT_SECRET.',
      503
    );
  }
  return secret;
};

const hashOtp = (email, otp) => {
  return crypto
    .createHmac('sha256', getOtpHashSecret())
    .update(`${email}:${otp}`)
    .digest('hex');
};

const retryError = (message, retryAfterSeconds) => {
  const error = new AppError(message, 429);
  error.retryAfterSeconds = retryAfterSeconds;
  return error;
};

const accountLockError = (lockUntil) => {
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((new Date(lockUntil).getTime() - Date.now()) / 1000)
  );
  const error = new AppError(
    `Account temporarily locked. Try again in ${retryAfterSeconds} seconds.`,
    423
  );
  error.retryAfterSeconds = retryAfterSeconds;
  return error;
};

const recordFailedLogin = async (user) => {
  let loginAttempts = user.loginAttempts || 0;

  for (let retry = 0; retry < MAX_LOGIN_COUNTER_RETRIES; retry += 1) {
    const now = new Date();
    const nextAttempt = loginAttempts + 1;
    const update =
      nextAttempt >= MAX_LOGIN_ATTEMPTS
        ? {
            $set: {
              loginAttempts: 0,
              lockUntil: new Date(now.getTime() + LOCK_TIME_MS),
            },
          }
        : { $set: { loginAttempts: nextAttempt } };

    const result = await User.updateOne(
      {
        _id: user._id,
        loginAttempts: { $in: [loginAttempts, null] },
        $or: [{ lockUntil: null }, { lockUntil: { $lte: now } }],
      },
      update
    );
    if (result.modifiedCount === 1) return;

    const latestUser = await User.findOne({ _id: user._id }).select(
      '+loginAttempts +lockUntil'
    );
    if (!latestUser) return;
    if (latestUser.lockUntil && latestUser.lockUntil > Date.now()) {
      throw accountLockError(latestUser.lockUntil);
    }

    loginAttempts = latestUser.loginAttempts || 0;
  }

  throw new AppError('Unable to record the login attempt. Please try again.', 503);
};

const sendOtp = async (user, isResend = false) => {
  const now = new Date();
  const otp = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
  const otpHash = hashOtp(user.email, otp);
  let deliveryUser = user;

  if (isResend) {
    const cooldownRemaining =
      user.emailOtpResendAvailableAt?.getTime() - now.getTime();
    if (cooldownRemaining > 0) {
      throw retryError(
        `Please wait ${Math.ceil(cooldownRemaining / 1000)} seconds before requesting another code.`,
        Math.ceil(cooldownRemaining / 1000)
      );
    }

    const withinWindow =
      user.emailOtpResendWindowStartedAt &&
      now.getTime() - user.emailOtpResendWindowStartedAt.getTime() <
        OTP_RESEND_WINDOW_MS;
    if (withinWindow && user.emailOtpResendCount >= MAX_OTP_EMAILS_PER_WINDOW) {
      throw retryError(
        'Too many verification emails requested. Please try again later.',
        Math.max(
          1,
          Math.ceil(
            (user.emailOtpResendWindowStartedAt.getTime() +
              OTP_RESEND_WINDOW_MS -
              now.getTime()) /
              1000
          )
        )
      );
    }

    const resendFilter = {
      _id: user._id,
      emailVerified: false,
      $and: [
        {
          $or: [
            { emailOtpResendAvailableAt: { $exists: false } },
            { emailOtpResendAvailableAt: { $lte: now } },
          ],
        },
        user.emailOtpResendWindowStartedAt
          ? {
              emailOtpResendWindowStartedAt:
                user.emailOtpResendWindowStartedAt,
            }
          : { emailOtpResendWindowStartedAt: { $exists: false } },
      ],
    };
    const resendUpdate = {
      $set: {
        emailOtpHash: otpHash,
        emailOtpExpiresAt: new Date(now.getTime() + OTP_TTL_MS),
        emailOtpAttempts: 0,
        emailOtpResendAvailableAt: new Date(
          now.getTime() + OTP_RESEND_COOLDOWN_MS
        ),
      },
    };
    if (withinWindow) {
      resendUpdate.$inc = { emailOtpResendCount: 1 };
    } else {
      resendUpdate.$set.emailOtpResendWindowStartedAt = now;
      resendUpdate.$set.emailOtpResendCount = 1;
    }

    deliveryUser = await User.findOneAndUpdate(
      resendFilter,
      resendUpdate,
      { returnDocument: 'after' }
    );
    if (!deliveryUser) {
      throw retryError(
        'A verification code was just requested. Please wait before trying again.',
        60
      );
    }
  } else {
    user.emailOtpHash = otpHash;
    user.emailOtpExpiresAt = new Date(now.getTime() + OTP_TTL_MS);
    user.emailOtpAttempts = 0;
    user.emailOtpResendAvailableAt = new Date(
      now.getTime() + OTP_RESEND_COOLDOWN_MS
    );
    user.emailOtpResendWindowStartedAt = now;
    user.emailOtpResendCount = 1;
    await user.save();
  }

  try {
    const emailSubmission = await sendVerificationEmail({
      to: deliveryUser.email,
      subject: 'Your EventBooking verification code',
      html: generateEmailVerificationEmail({
        userName: deliveryUser.name,
        otp,
      }),
    });
    return emailSubmission;
  } catch (error) {
    await User.updateOne(
      { _id: deliveryUser._id, emailOtpHash: otpHash },
      {
        $unset: { emailOtpHash: 1, emailOtpExpiresAt: 1 },
        $set: { emailOtpAttempts: 0 },
      }
    );
    console.error(
      error.code === 'EMAIL_NOT_CONFIGURED'
        ? 'Email verification delivery unavailable: Resend configuration is required.'
        : 'Email verification delivery failed. Check the Resend configuration and service logs.'
    );
    throw new AppError(
      error.code === 'EMAIL_NOT_CONFIGURED'
        ? 'Email verification is temporarily unavailable. Configure RESEND_API_KEY and EMAIL_FROM.'
        : 'Unable to send the verification email. Please try again later.',
      503
    );
  }
};

// @desc    Register new user
// @route   POST /api/auth/register
const register = async (req, res, next) => {
  try {
    const { name, email, password, role, phone, whatsappNumber } = req.body;

    if (!isValidPhoneNumber(phone)) {
      throw new AppError('Please provide a valid phone number', 400);
    }
    if (!isValidPhoneNumber(whatsappNumber)) {
      throw new AppError('Please provide a valid WhatsApp number', 400);
    }

    const sanitizedRole = ALLOWED_ROLES.includes(role) ? role : 'attendee';

    const existingUser = await User.findOne({ email }).select(
      '+emailOtpHash +emailOtpExpiresAt +emailOtpAttempts +emailOtpResendAvailableAt +emailOtpResendWindowStartedAt +emailOtpResendCount'
    );
    if (existingUser) {
      if (existingUser.emailVerified) {
        throw new AppError('Email is already registered', 409);
      }

      existingUser.phone = phone.trim();
      existingUser.whatsappNumber = whatsappNumber.trim();
      await existingUser.save();
      await sendOtp(existingUser, true);
      return res.status(202).json({
        success: true,
        message: 'Verification email submitted. Please check your Inbox and Spam folder.',
        data: {
          email: existingUser.email,
          emailSubmissionStatus: 'submitted',
          expiresInSeconds: OTP_TTL_MS / 1000,
          resendCooldownSeconds: OTP_RESEND_COOLDOWN_MS / 1000,
        },
      });
    }

    getOtpHashSecret();
    const user = await User.create({
      name,
      email,
      password,
      phone: phone.trim(),
      whatsappNumber: whatsappNumber.trim(),
      role: sanitizedRole,
      emailVerified: false,
    });

    await sendOtp(user);

    res.status(202).json({
      success: true,
      message: 'Verification email submitted. Please check your Inbox and Spam folder.',
      data: {
        email: user.email,
        emailSubmissionStatus: 'submitted',
        expiresInSeconds: OTP_TTL_MS / 1000,
        resendCooldownSeconds: OTP_RESEND_COOLDOWN_MS / 1000,
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Verify the registration email OTP
// @route   POST /api/auth/verify-email
const verifyEmail = async (req, res, next) => {
  try {
    const email = req.body.email;
    const otp =
      typeof req.body.otp === 'string' ? req.body.otp : String(req.body.otp);
    const user = await User.findOne({ email, emailVerified: false }).select(
      '+emailOtpHash +emailOtpExpiresAt +emailOtpAttempts'
    );

    if (!user) {
      throw new AppError('The verification code is invalid or expired.', 400);
    }

    if ((user.emailOtpAttempts || 0) >= MAX_OTP_ATTEMPTS) {
      throw new AppError(
        'Too many incorrect codes. Request a new verification code.',
        429
      );
    }

    const now = new Date();
    if (
      !user.emailOtpHash ||
      !user.emailOtpExpiresAt ||
      user.emailOtpExpiresAt <= now
    ) {
      await User.updateOne(
        { _id: user._id, emailVerified: false },
        {
          $unset: { emailOtpHash: 1, emailOtpExpiresAt: 1 },
          $set: { emailOtpAttempts: 0 },
        }
      );
      throw new AppError('The verification code has expired. Request a new code.', 410);
    }

    const candidateHash =
      typeof otp === 'string' && /^\d{6}$/.test(otp)
        ? Buffer.from(hashOtp(email, otp), 'hex')
        : null;
    const storedHash = Buffer.from(user.emailOtpHash, 'hex');
    const matches = Boolean(
      candidateHash &&
        candidateHash.length === storedHash.length &&
        crypto.timingSafeEqual(candidateHash, storedHash)
    );

    if (!matches) {
      const attempt = await User.updateOne(
        {
          _id: user._id,
          emailVerified: false,
          emailOtpHash: user.emailOtpHash,
          emailOtpExpiresAt: { $gt: now },
          emailOtpAttempts: { $lt: MAX_OTP_ATTEMPTS },
        },
        { $inc: { emailOtpAttempts: 1 } }
      );
      if (attempt.modifiedCount !== 1) {
        throw new AppError(
          'Too many incorrect codes. Request a new verification code.',
          429
        );
      }

      const attempts = (user.emailOtpAttempts || 0) + 1;
      throw new AppError(
        attempts >= MAX_OTP_ATTEMPTS
          ? 'Too many incorrect codes. Request a new verification code.'
          : 'The verification code is incorrect.',
        attempts >= MAX_OTP_ATTEMPTS ? 429 : 400
      );
    }

    const verifiedUser = await User.findOneAndUpdate(
      {
        _id: user._id,
        emailVerified: false,
        emailOtpHash: user.emailOtpHash,
        emailOtpExpiresAt: { $gt: now },
        emailOtpAttempts: { $lt: MAX_OTP_ATTEMPTS },
      },
      {
        $set: { emailVerified: true, emailOtpAttempts: 0 },
        $unset: {
          emailOtpHash: 1,
          emailOtpExpiresAt: 1,
          emailOtpResendAvailableAt: 1,
          emailOtpResendWindowStartedAt: 1,
          emailOtpResendCount: 1,
        },
      },
      { returnDocument: 'after' }
    );

    if (!verifiedUser) {
      throw new AppError('The verification code is invalid or expired.', 400);
    }

    res.status(200).json({
      success: true,
      message: 'Email verified successfully. You can now sign in.',
      data: { email: verifiedUser.email, emailVerified: true },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Resend the registration email OTP
// @route   POST /api/auth/resend-email-otp
const resendEmailOtp = async (req, res, next) => {
  try {
    const user = await User.findOne({
      email: req.body.email,
      emailVerified: false,
    }).select(
      '+emailOtpHash +emailOtpExpiresAt +emailOtpAttempts +emailOtpResendAvailableAt +emailOtpResendWindowStartedAt +emailOtpResendCount'
    );

    if (user) await sendOtp(user, true);

    res.status(200).json({
      success: true,
      message: GENERIC_RESEND_MESSAGE,
      data: {
        expiresInSeconds: OTP_TTL_MS / 1000,
        resendCooldownSeconds: OTP_RESEND_COOLDOWN_MS / 1000,
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Login user
// @route   POST /api/auth/login
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new AppError('Please provide email and password', 400);
    }

    const user = await User.findOne({ email }).select(
      '+password +loginAttempts +lockUntil'
    );

    // Account lockout check
    if (user && user.lockUntil && user.lockUntil > Date.now()) {
      throw accountLockError(user.lockUntil);
    }

    const isPasswordValid = user
      ? await user.comparePassword(password)
      : false;

    // Invalid credentials — increment attempts or lock
    if (!user || !isPasswordValid) {
      if (user) await recordFailedLogin(user);

      throw new AppError('Invalid email or password', 401);
    }

    // A valid password resets failed attempts even when another account check blocks login.
    user.loginAttempts = 0;
    user.lockUntil = null;
    await user.save({ validateBeforeSave: false });

    if (user.emailVerified === false) {
      throw new AppError('Please verify your email before logging in.', 403);
    }

    if (!user.isActive) {
      throw new AppError('Account is deactivated', 401);
    }

    user.password = undefined;
    user.loginAttempts = undefined;
    user.lockUntil = undefined;

    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      data: { user, token },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get current logged-in user
// @route   GET /api/auth/me
const getMe = async (req, res) => {
  res.status(200).json({
    success: true,
    data: { user: req.user },
  });
};

// @desc    Update user profile (whitelisted fields only)
// @route   PUT /api/auth/profile
const updateProfile = async (req, res, next) => {
  try {
    const { name, bio, phone, avatar, preferences } = req.body;

    const updateFields = {};
    if (name !== undefined) updateFields.name = name;
    if (bio !== undefined) updateFields.bio = bio;
    if (phone !== undefined) updateFields.phone = phone;
    if (avatar !== undefined) updateFields.avatar = avatar;
    if (preferences !== undefined) updateFields.preferences = preferences;

    const user = await User.findByIdAndUpdate(req.user._id, updateFields, {
      returnDocument: 'after',
      runValidators: true,
    });

    res.status(200).json({
      success: true,
      data: { user },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Change password
// @route   PUT /api/auth/change-password
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      throw new AppError(
        'Please provide current password and new password',
        400
      );
    }

    const user = await User.findById(req.user._id).select('+password');

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      throw new AppError('Current password is incorrect', 401);
    }

    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password updated successfully',
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete user account (with password confirmation)
// @route   DELETE /api/auth/delete-account
const deleteAccount = async (req, res, next) => {
  try {
    const { password } = req.body;

    if (!password) {
      throw new AppError('Please provide your password to confirm', 400);
    }

    const user = await User.findById(req.user._id).select('+password');

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw new AppError('Password is incorrect', 401);
    }

    // Cascade delete: remove user's registrations if model exists
    const Registration = mongoose.models.Registration;
    if (Registration) {
      await Registration.deleteMany({ user: req.user._id });
    }

    await User.findByIdAndDelete(req.user._id);

    res.status(200).json({
      success: true,
      message: 'Account deleted successfully',
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  register,
  verifyEmail,
  resendEmailOtp,
  login,
  getMe,
  updateProfile,
  changePassword,
  deleteAccount,
};
