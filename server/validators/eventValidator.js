const { body } = require('express-validator');

const CATEGORIES = [
  'conference',
  'workshop',
  'seminar',
  'meetup',
  'concert',
  'sports',
  'networking',
  'webinar',
  'other',
];

const CURRENCIES = ['INR'];

const createEventRules = [
  body('title')
    .notEmpty()
    .withMessage('Title is required')
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage('Title must be between 3 and 100 characters')
    .escape(),

  body('description')
    .notEmpty()
    .withMessage('Description is required')
    .trim()
    .isLength({ min: 10, max: 5000 })
    .withMessage('Description must be between 10 and 5000 characters')
    .escape(),

  body('date')
    .notEmpty()
    .withMessage('Event date is required')
    .isISO8601()
    .withMessage('Date must be a valid ISO 8601 format')
    .custom((value, { req }) => {
      if (req.method === 'PUT') return true;
      if (new Date(value) <= new Date()) {
        throw new Error('Event date must be in the future');
      }
      return true;
    }),

  body('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 format')
    .custom((value, { req }) => {
      if (new Date(value) <= new Date(req.body.date)) {
        throw new Error('End date must be after start date');
      }
      return true;
    }),

  body('time').optional().trim().escape(),

  body('location.venue')
    .notEmpty()
    .withMessage('Venue is required')
    .trim()
    .isLength({ max: 200 })
    .withMessage('Venue cannot exceed 200 characters')
    .escape(),

  body('location.address')
    .optional()
    .trim()
    .isLength({ max: 300 })
    .withMessage('Address cannot exceed 300 characters')
    .escape(),

  body('location.city')
    .notEmpty()
    .withMessage('City is required')
    .trim()
    .isLength({ max: 100 })
    .withMessage('City cannot exceed 100 characters')
    .escape(),

  body('location.country')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Country cannot exceed 100 characters')
    .escape(),

  body('capacity')
    .notEmpty()
    .withMessage('Capacity is required')
    .isInt({ min: 1, max: 100000 })
    .withMessage('Capacity must be between 1 and 100,000')
    .custom((value, { req }) => {
      const minParticipants = Number(req.body.minParticipants ?? 1);
      if (Number(value) < minParticipants) {
        throw new Error('Capacity cannot be lower than minimum members');
      }
      return true;
    }),

  body('minParticipants')
    .optional()
    .isInt({ min: 1, max: 100000 })
    .withMessage('Minimum members must be between 1 and 100,000')
    .custom((value, { req }) => {
      if (
        req.body.capacity !== undefined &&
        Number(value) > Number(req.body.capacity)
      ) {
        throw new Error('Minimum members cannot exceed event capacity');
      }
      return true;
    }),

  body('teamMode')
    .optional()
    .isIn(['SOLO', 'DUO', 'TRIO', 'SQUAD'])
    .withMessage('Team mode must be SOLO, DUO, TRIO, or SQUAD'),

  body('gameMode')
    .optional()
    .isIn(['SOLO', 'DUO', 'TRIO', 'SQUAD'])
    .withMessage('Game mode must be SOLO, DUO, TRIO, or SQUAD'),

  body('teamSize')
    .optional()
    .isInt({ min: 1, max: 4 })
    .withMessage('Team size must be between 1 and 4')
    .bail()
    .custom((value, { req }) => {
      const expected = { SOLO: 1, DUO: 2, TRIO: 3, SQUAD: 4 };
      const mode = req.body.gameMode || req.body.teamMode;
      if (mode && expected[mode] !== Number(value)) {
        throw new Error('Team size does not match the selected game mode');
      }
      return true;
    }),

  body('price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Price must be a non-negative number'),

  body('pricingType')
    .optional()
    .isIn(['FREE', 'PAID'])
    .withMessage('Pricing type must be FREE or PAID')
    .bail()
    .custom((value, { req }) => {
      if (value === 'FREE' && Number(req.body.price ?? 0) !== 0) {
        throw new Error('FREE events must have a price of 0');
      }
      if (value === 'PAID' && !(Number(req.body.price) > 0)) {
        throw new Error('PAID events require a price greater than 0');
      }
      return true;
    }),

  body('image')
    .optional()
    .isString()
    .withMessage('Image must be a URL string')
    .trim()
    .isLength({ max: 2048 })
    .withMessage('Image URL cannot exceed 2048 characters'),

  body('currency')
    .optional()
    .isIn(CURRENCIES)
    .withMessage(`Currency must be one of: ${CURRENCIES.join(', ')}`),

  body('category')
    .notEmpty()
    .withMessage('Category is required')
    .isIn(CATEGORIES)
    .withMessage(`Category must be one of: ${CATEGORIES.join(', ')}`),

  body('tags')
    .optional()
    .customSanitizer((value) => {
      const tags = Array.isArray(value) ? value : [value];
      return [...new Set(tags
        .flatMap((tag) => (typeof tag === 'string' ? tag.split(',') : [tag]))
        .map((tag) => (typeof tag === 'string' ? tag.trim() : tag))
        .filter(Boolean))];
    })
    .isArray({ max: 10 })
    .withMessage('Tags must contain no more than 10 entries'),

  body('tags.*')
    .optional()
    .isString()
    .withMessage('Each tag must be text')
    .bail()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Tags cannot exceed 50 characters')
    .escape(),

  body('maxRegistrationsPerUser')
    .optional()
    .isInt({ min: 1, max: 10 })
    .withMessage('Max registrations per user must be between 1 and 10'),
];

const updateEventRules = createEventRules.map((rule) => rule.optional());

module.exports = {
  createEventRules,
  updateEventRules,
};
