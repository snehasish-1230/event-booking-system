const { body } = require('express-validator');

const roomDetailsRules = [
  body('roomId')
    .isString()
    .withMessage('Room ID is required')
    .bail()
    .trim()
    .notEmpty()
    .withMessage('Room ID is required')
    .isLength({ max: 80 })
    .withMessage('Room ID cannot exceed 80 characters'),
  body('roomPassword')
    .isString()
    .withMessage('Room password is required')
    .bail()
    .trim()
    .notEmpty()
    .withMessage('Room password is required')
    .isLength({ max: 80 })
    .withMessage('Room password cannot exceed 80 characters'),
  body('matchAt')
    .isISO8601()
    .withMessage('Match date and time must be valid')
    .bail()
    .custom((value) => {
      if (new Date(value) <= new Date()) {
        throw new Error('Match date and time must be in the future');
      }
      return true;
    }),
  body('instructions')
    .optional()
    .isString()
    .withMessage('Instructions must be text')
    .bail()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Instructions cannot exceed 1000 characters'),
];

const assignmentRules = [
  body('assignments')
    .isArray({ min: 1 })
    .withMessage('At least one eligible team slot assignment is required'),
  body('assignments.*.registrationId')
    .isMongoId()
    .withMessage('Each slot assignment must have a valid registration ID'),
  body('assignments.*.slotNumber')
    .isInt({ min: 1, max: 100000 })
    .withMessage('Slot numbers must be positive whole numbers'),
];

const saveEventRoomDraftRules = [
  ...roomDetailsRules,
  body('assignments')
    .optional()
    .isArray()
    .withMessage('Assignments must be an array'),
  body('assignments.*.registrationId')
    .optional()
    .isMongoId()
    .withMessage('Each slot assignment must have a valid registration ID'),
  body('assignments.*.slotNumber')
    .optional()
    .isInt({ min: 1, max: 100000 })
    .withMessage('Slot numbers must be positive whole numbers'),
];

const publishEventRoomRules = [...roomDetailsRules, ...assignmentRules];

module.exports = { saveEventRoomDraftRules, publishEventRoomRules };
