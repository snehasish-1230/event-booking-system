const express = require('express');
const { protect, adminOnly } = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const { uploadPaymentScreenshot } = require('../middlewares/upload');
const { uploadLimiter } = require('../middlewares/rateLimiter');
const { mongoIdParam } = require('../validators/paramValidator');
const { paginationRules } = require('../validators/queryValidator');
const {
  createPaymentRules,
  createTestPaymentRules,
  reviewPaymentRules,
} = require('../validators/paymentValidator');
const {
  getPaymentConfig,
  createPayment,
  getMyPayments,
  getPaymentById,
  getAllPayments,
  reviewPayment,
  createTestPayment,
  getAllTestPayments,
  reviewTestPayment,
} = require('../controllers/paymentController');

const router = express.Router();

// Public/Authenticated config endpoint
router.get('/config', protect, getPaymentConfig);

// User endpoints
// 1. Submit payment details + screenshot
router.post(
  '/',
  protect,
  uploadLimiter,
  uploadPaymentScreenshot,
  createPaymentRules,
  validate,
  createPayment
);

// 2. View user's own payments
router.get('/my', protect, paginationRules, validate, getMyPayments);

// Admin endpoints (MUST come before /:id to prevent /admin/all matching :id)
router.get('/admin/all', protect, adminOnly, paginationRules, validate, getAllPayments);
router.get('/admin/test/all', protect, adminOnly, paginationRules, validate, getAllTestPayments);
router.patch(
  '/admin/test/:id/review',
  protect,
  adminOnly,
  mongoIdParam(),
  reviewPaymentRules,
  validate,
  reviewTestPayment
);
router.patch(
  '/admin/:id/review',
  protect,
  adminOnly,
  mongoIdParam(),
  reviewPaymentRules,
  validate,
  reviewPayment
);

router.post('/test', protect, createTestPaymentRules, validate, createTestPayment);

// Specific payment detail (owner or admin)
router.get('/:id', protect, mongoIdParam(), validate, getPaymentById);

module.exports = router;
