const rateLimit = require('express-rate-limit');

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

const rateLimitResponse = {
  success: false,
  message: 'Too many requests, please try again later',
};

// Factory keeps every tier consistent: standardized RateLimit-* headers,
// no deprecated X-RateLimit-* headers, shared window and response shape.
const createLimiter = (max) =>
  rateLimit({
    windowMs: WINDOW_MS,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: rateLimitResponse,
  });

const globalLimiter = createLimiter(100);
const authLimiter = createLimiter(10);
const registrationLimiter = createLimiter(20);
const uploadLimiter = createLimiter(10);
const confirmationLimiter = createLimiter(20);

module.exports = {
  globalLimiter,
  authLimiter,
  registrationLimiter,
  uploadLimiter,
  confirmationLimiter,
};
