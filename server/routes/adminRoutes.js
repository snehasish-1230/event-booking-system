const express = require('express');
const { protect, adminOnly } = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const {
  updateUserRoleRules,
  updateEventStatusRules,
} = require('../validators/adminValidator');
const { paginationRules } = require('../validators/queryValidator');
const { mongoIdParam } = require('../validators/paramValidator');
const {
  saveEventRoomDraftRules,
  publishEventRoomRules,
} = require('../validators/eventRoomValidator');
const {
  getAdminDashboard,
  getAllUsers,
  updateUserRole,
  toggleUserActive,
  deleteUser,
  getAllEvents,
  adminUpdateEventStatus,
  adminDeleteEvent,
  getAllRegistrations,
} = require('../controllers/adminController');
const {
  getEventRoomManagement,
  saveEventRoomDraft,
  publishEventRoom,
  resendRoomEmails,
  resendFailedRoomEmails,
} = require('../controllers/eventRoomController');

const router = express.Router();

// All admin routes require authentication + admin role
router.use(protect, adminOnly);

// Dashboard
router.get('/dashboard', getAdminDashboard);

// User management
router.get('/users', paginationRules, validate, getAllUsers);
router.put('/users/:id/role', mongoIdParam(), updateUserRoleRules, validate, updateUserRole);
router.put('/users/:id/toggle-active', mongoIdParam(), validate, toggleUserActive);
router.delete('/users/:id', mongoIdParam(), validate, deleteUser);

// Event management
router.get('/events', paginationRules, validate, getAllEvents);
router.put(
  '/events/:id/status',
  mongoIdParam(),
  updateEventStatusRules,
  validate,
  adminUpdateEventStatus
);
router.delete('/events/:id', mongoIdParam(), validate, adminDeleteEvent);
router.get('/events/:id/room', mongoIdParam(), validate, getEventRoomManagement);
router.put(
  '/events/:id/room/draft',
  mongoIdParam(),
  saveEventRoomDraftRules,
  validate,
  saveEventRoomDraft
);
router.put(
  '/events/:id/room',
  mongoIdParam(),
  publishEventRoomRules,
  validate,
  publishEventRoom
);
router.post('/events/:id/room/resend-failed', mongoIdParam(), validate, resendFailedRoomEmails);
router.post('/events/:id/room/resend', mongoIdParam(), validate, resendRoomEmails);

// Registration management
router.get('/registrations', paginationRules, validate, getAllRegistrations);

module.exports = router;
