const express = require('express');
const { protect } = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const { mongoIdParam } = require('../validators/paramValidator');
const {
  getPublicProfile,
  getOrganizerProfile,
  getUserStats,
} = require('../controllers/userController');

const router = express.Router();

// Protected route (specific path BEFORE :id param routes)
router.get('/me/stats', protect, getUserStats);

// Public routes
router.get('/:id/profile', mongoIdParam(), validate, getPublicProfile);
router.get('/:id/organizer', mongoIdParam(), validate, getOrganizerProfile);

module.exports = router;
