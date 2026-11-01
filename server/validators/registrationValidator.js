const { body, param } = require('express-validator');

const registerForEventRules = [
  body('players')
    .optional()
    .isArray({ min: 1, max: 4 })
    .withMessage('Players must contain between 1 and 4 entries'),

  body('players.*.playerName')
    .if((value, { req }) => Array.isArray(req.body.players))
    .isString()
    .withMessage('Player name must be text')
    .bail()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Player name must be between 2 and 50 characters'),

  body('players.*.freeFireUid')
    .if((value, { req }) => Array.isArray(req.body.players))
    .isString()
    .withMessage('Free Fire UID must be text')
    .bail()
    .matches(/^\d{1,20}$/)
    .withMessage('Free Fire UID must contain 1 to 20 digits only'),

  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes cannot exceed 500 characters')
    .escape(),

  body('ticketType')
    .optional()
    .isIn(['standard', 'vip'])
    .withMessage('Ticket type must be standard or vip'),
];

const confirmationCodeParam = [
  param('code')
    .trim()
    .isLength({ min: 12, max: 12 })
    .withMessage('Invalid confirmation code format')
    .isAlphanumeric()
    .withMessage('Confirmation code must be alphanumeric'),
];

module.exports = { registerForEventRules, confirmationCodeParam };
