const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = rateLimit;
const env = require('../config/env');

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

const retryAfterHandler = (req, res, _next, options) => {
  const resetTime = req.rateLimit?.resetTime;
  const retryAfterSeconds =
    resetTime instanceof Date
      ? Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 1000))
      : Math.ceil(options.windowMs / 1000);
  res.setHeader('Retry-After', String(retryAfterSeconds));
  res.status(options.statusCode).json({
    success: false,
    message: `Too many requests. Try again in ${retryAfterSeconds} seconds.`,
    retryAfterSeconds,
  });
};

// Factory keeps every tier consistent: standardized RateLimit-* headers,
// no deprecated X-RateLimit-* headers, shared window and response shape.
const createLimiter = (max, options = {}) =>
  rateLimit({
    windowMs: WINDOW_MS,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: retryAfterHandler,
    ...options,
  });

const getUserOrIpKey = (req) =>
  req.user?._id
    ? `user:${req.user._id.toString()}`
    : ipKeyGenerator(req.ip);

const globalLimiter = createLimiter(
  env.NODE_ENV === 'production' ? 300 : 1000,
  {
    skip: (req) => {
      const requestPath = req.originalUrl.split('?')[0];
      return (
        (req.method === 'POST' && requestPath === '/api/auth/login') ||
        (req.method === 'POST' &&
          ['/api/upload/image', '/api/payments'].includes(requestPath))
      );
    },
    handler: retryAfterHandler,
  }
);
const loginLimiter = createLimiter(env.NODE_ENV === 'production' ? 10 : 50, {
  skipSuccessfulRequests: true,
  handler: (req, res, _next, options) => {
    const resetTime = req.rateLimit?.resetTime;
    const retryAfterSeconds =
      resetTime instanceof Date
        ? Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 1000))
        : Math.ceil(WINDOW_MS / 1000);

    res.setHeader('Retry-After', String(retryAfterSeconds));
    res.status(options.statusCode).json({
      success: false,
      message: `Too many failed login attempts. Try again in ${retryAfterSeconds} seconds.`,
      retryAfterSeconds,
    });
  },
});
const authLimiter = loginLimiter;
const registrationOtpLimiter = createLimiter(
  env.NODE_ENV === 'production' ? 10 : 20
);
const otpRequestLimiter = createLimiter(env.NODE_ENV === 'production' ? 5 : 10);
const otpVerifyLimiter = createLimiter(env.NODE_ENV === 'production' ? 10 : 20);
const passwordResetRequestLimiter = createLimiter(
  env.NODE_ENV === 'production' ? 5 : 10
);
const passwordResetVerifyLimiter = createLimiter(
  env.NODE_ENV === 'production' ? 10 : 20
);
const passwordResetCompleteLimiter = createLimiter(
  env.NODE_ENV === 'production' ? 10 : 20
);
const registrationLimiter = createLimiter(env.NODE_ENV === 'production' ? 20 : 60);
const eventCreationLimiter = createLimiter(
  env.NODE_ENV === 'production' ? 20 : 60,
  { keyGenerator: getUserOrIpKey, handler: retryAfterHandler }
);
const uploadLimiter = createLimiter(
  env.NODE_ENV === 'production' ? 20 : 60,
  { keyGenerator: getUserOrIpKey, handler: retryAfterHandler }
);
const confirmationLimiter = createLimiter(20);

module.exports = {
  globalLimiter,
  loginLimiter,
  authLimiter,
  registrationOtpLimiter,
  otpRequestLimiter,
  otpVerifyLimiter,
  passwordResetRequestLimiter,
  passwordResetVerifyLimiter,
  passwordResetCompleteLimiter,
  registrationLimiter,
  eventCreationLimiter,
  uploadLimiter,
  confirmationLimiter,
};
