const express = require('express');
const {
  loginLimiter,
  otpRequestLimiter,
  otpVerifyLimiter,
  passwordResetRequestLimiter,
  passwordResetVerifyLimiter,
  passwordResetCompleteLimiter,
} = require('../middlewares/rateLimiter');
const { protect } = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const {
  registerRules,
  verifyEmailRules,
  resendEmailOtpRules,
  passwordResetRequestRules,
  verifyPasswordResetOtpRules,
  resetPasswordRules,
  loginRules,
  updateProfileRules,
  changePasswordRules,
} = require('../validators/authValidator');
const {
  register,
  verifyEmail,
  resendEmailOtp,
  login,
  getMe,
  updateProfile,
  changePassword,
  deleteAccount,
} = require('../controllers/authController');
const {
  requestPasswordReset,
  verifyPasswordResetOtp,
  resendPasswordResetOtp,
  resetPassword,
} = require('../controllers/passwordResetController');

const router = express.Router();

router.post(
  '/register',
  otpRequestLimiter,
  registerRules,
  validate,
  register
);
router.post(
  '/verify-email',
  otpVerifyLimiter,
  verifyEmailRules,
  validate,
  verifyEmail
);
router.post(
  '/resend-email-otp',
  otpRequestLimiter,
  resendEmailOtpRules,
  validate,
  resendEmailOtp
);
router.post(
  '/forgot-password',
  passwordResetRequestLimiter,
  passwordResetRequestRules,
  validate,
  requestPasswordReset
);
router.post(
  '/verify-password-reset-otp',
  passwordResetVerifyLimiter,
  verifyPasswordResetOtpRules,
  validate,
  verifyPasswordResetOtp
);
router.post(
  '/resend-password-reset-otp',
  passwordResetRequestLimiter,
  passwordResetRequestRules,
  validate,
  resendPasswordResetOtp
);
router.post(
  '/reset-password',
  passwordResetCompleteLimiter,
  resetPasswordRules,
  validate,
  resetPassword
);
router.post('/login', loginRules, validate, loginLimiter, login);
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfileRules, validate, updateProfile);
router.put(
  '/change-password',
  protect,
  changePasswordRules,
  validate,
  changePassword
);
router.delete('/delete-account', protect, deleteAccount);

module.exports = router;
