const { body } = require('express-validator');
const isValidPhoneNumber = require('../utils/phoneNumber');

const createPaymentRules = [
  body('bookingId')
    .notEmpty()
    .withMessage('Booking ID is required')
    .isMongoId()
    .withMessage('Invalid Booking ID format'),
  body('transactionId')
    .trim()
    .notEmpty()
    .withMessage('Transaction reference / UTR is required')
    .isLength({ min: 4, max: 64 })
    .withMessage('Transaction reference must be between 4 and 64 characters'),
  body('freeFireAccountName')
    .trim()
    .notEmpty()
    .withMessage('Free Fire account name is required')
    .isLength({ max: 80 })
    .withMessage('Free Fire account name cannot exceed 80 characters'),
  body('freeFireUid')
    .notEmpty()
    .withMessage('Free Fire UID is required')
    .matches(/^\d{1,20}$/)
    .withMessage('Free Fire UID must contain 1 to 20 digits only'),
  body('phoneNumber')
    .trim()
    .notEmpty()
    .withMessage('Phone number is required')
    .bail()
    .custom(isValidPhoneNumber)
    .withMessage('Please provide a valid phone number'),
  body('note')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 500 })
    .withMessage('Payment note cannot exceed 500 characters'),
];

const createTestPaymentRules = [
  body('bookingId')
    .notEmpty()
    .withMessage('Booking ID is required')
    .isMongoId()
    .withMessage('Invalid Booking ID format'),
];

const reviewPaymentRules = [
  body('action')
    .notEmpty()
    .withMessage('Action is required')
    .isIn(['APPROVE', 'REJECT'])
    .withMessage('Action must be either APPROVE or REJECT'),
  body('rejectionReason')
    .if(body('action').equals('REJECT'))
    .trim()
    .notEmpty()
    .withMessage('Rejection reason is required when rejecting a payment')
    .isLength({ max: 500 })
    .withMessage('Rejection reason cannot exceed 500 characters'),
];

module.exports = {
  createPaymentRules,
  createTestPaymentRules,
  reviewPaymentRules,
};
