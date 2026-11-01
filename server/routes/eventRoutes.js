const express = require('express');
const { protect, optionalAuth, organizerOnly } = require('../middlewares/auth');
const {
  registrationLimiter,
  eventCreationLimiter,
} = require('../middlewares/rateLimiter');
const validate = require('../middlewares/validate');
const { createEventRules, updateEventRules } = require('../validators/eventValidator');
const { registerForEventRules } = require('../validators/registrationValidator');
const { eventFilterRules } = require('../validators/queryValidator');
const { mongoIdParam } = require('../validators/paramValidator');
const {
  createEvent,
  updateEvent,
  deleteEvent,
  publishEvent,
  cancelEvent,
  getMyEvents,
  getEvents,
  getEventBySlug,
  getEventById,
  getFeaturedEvents,
  getEventCategories,
} = require('../controllers/eventController');
const {
  registerForEvent,
  getEventRegistrations,
  getEventStats,
} = require('../controllers/registrationController');

const router = express.Router();

// Public routes (specific paths BEFORE :slug param route)
router.get('/featured', getFeaturedEvents);
router.get('/categories', getEventCategories);

// Organizer routes (require authentication + organizer/admin role)
router.get('/my/organized', protect, organizerOnly, getMyEvents);
router.post(
  '/',
  protect,
  organizerOnly,
  eventCreationLimiter,
  createEventRules,
  validate,
  createEvent
);
router.put('/:id', protect, organizerOnly, mongoIdParam(), updateEventRules, validate, updateEvent);
router.delete('/:id', protect, organizerOnly, mongoIdParam(), validate, deleteEvent);
router.put('/:id/publish', protect, organizerOnly, mongoIdParam(), validate, publishEvent);
router.put('/:id/cancel', protect, organizerOnly, mongoIdParam(), validate, cancelEvent);

// Event registration management (organizer/admin)
router.get('/:id/registrations', protect, organizerOnly, mongoIdParam(), validate, getEventRegistrations);
router.get('/:id/stats', protect, organizerOnly, mongoIdParam(), validate, getEventStats);

// Event registration (authenticated users)
router.post(
  '/:id/register',
  protect,
  registrationLimiter,
  mongoIdParam(),
  registerForEventRules,
  validate,
  registerForEvent
);

// Public routes with param (AFTER specific routes)
router.get('/', optionalAuth, eventFilterRules, validate, getEvents);
router.get('/id/:id', optionalAuth, mongoIdParam(), validate, getEventById);
router.get('/:slug', optionalAuth, getEventBySlug);

module.exports = router;
