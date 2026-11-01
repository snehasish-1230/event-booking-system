const { body } = require('express-validator');
const isValidPhoneNumber = require('../utils/phoneNumber');

const registerRules = [
  body('name')
    .notEmpty()
    .withMessage('Name is required')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters')
    .escape(),

  body('email')
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail()
    .trim(),

  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage(
      'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    ),
  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Phone number is required')
    .bail()
    .custom(isValidPhoneNumber)
    .withMessage('Please provide a valid phone number'),
  body('whatsappNumber')
    .trim()
    .notEmpty()
    .withMessage('WhatsApp number is required')
    .bail()
    .custom(isValidPhoneNumber)
    .withMessage('Please provide a valid WhatsApp number'),
];

const verifyEmailRules = [
  body('email')
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),

  body('otp')
    .notEmpty()
    .withMessage('Verification code is required')
    .custom(
      (value) =>
        typeof value === 'string' ||
        (typeof value === 'number' && Number.isSafeInteger(value))
    )
    .withMessage('Verification code must be a string or integer'),
];

const resendEmailOtpRules = [
  body('email')
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
];

const passwordResetRequestRules = resendEmailOtpRules;
const verifyPasswordResetOtpRules = [
  ...resendEmailOtpRules,
  body('otp')
    .notEmpty()
    .withMessage('Verification code is required')
    .custom(
      (value) =>
        typeof value === 'string' ||
        (typeof value === 'number' && Number.isSafeInteger(value))
    )
    .withMessage('Verification code must be a string or integer'),
];

const resetPasswordRules = [
  body('resetToken')
    .isString()
    .withMessage('Reset authorization is required')
    .notEmpty()
    .withMessage('Reset authorization is required'),
  body('newPassword')
    .notEmpty()
    .withMessage('New password is required')
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage(
      'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    ),
  body('confirmPassword')
    .notEmpty()
    .withMessage('Please confirm your password')
    .custom((value, { req }) => value === req.body.newPassword)
    .withMessage('Passwords do not match'),
];

const loginRules = [
  body('email')
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),

  body('password').notEmpty().withMessage('Password is required'),
];

const updateProfileRules = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters')
    .escape(),

  body('bio')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Bio cannot exceed 500 characters')
    .escape(),

  body('phone').optional().trim().escape(),

  body('preferences.theme')
    .optional()
    .isIn(['light', 'dark', 'system'])
    .withMessage('Theme must be light, dark, or system'),

  body('preferences.emailNotifications')
    .optional()
    .isBoolean()
    .withMessage('Email notifications must be a boolean value'),
];

const changePasswordRules = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),

  body('newPassword')
    .notEmpty()
    .withMessage('New password is required')
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage(
      'New password must contain at least one uppercase letter, one lowercase letter, and one number'
    ),
];

module.exports = {
  registerRules,
  verifyEmailRules,
  resendEmailOtpRules,
  passwordResetRequestRules,
  verifyPasswordResetOtpRules,
  resetPasswordRules,
  loginRules,
  updateProfileRules,
  changePasswordRules,
};
