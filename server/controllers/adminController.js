const mongoose = require('mongoose');
const User = require('../models/User');
const Event = require('../models/Event');
const Registration = require('../models/Registration');
const AppError = require('../utils/AppError');
const escapeRegex = require('../utils/escapeRegex');

/**
 * Valid role values for user role updates.
 */
const VALID_ROLES = ['attendee', 'organizer', 'admin'];

/**
 * Valid event status values and allowed transitions.
 */
const VALID_EVENT_STATUSES = ['draft', 'published', 'cancelled', 'completed'];

const STATUS_TRANSITIONS = {
  draft: ['published', 'cancelled'],
  published: ['cancelled', 'completed'],
  cancelled: [],
  completed: [],
};

// @desc    Aggregate system-wide dashboard stats
// @route   GET /api/admin/dashboard
// @access  Admin
const getAdminDashboard = async (req, res, next) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [userStats, eventStats, registrationStats, newUsersThisMonth, newEventsThisMonth, topEvents] =
      await Promise.all([
        User.aggregate([
          {
            $group: {
              _id: '$role',
              count: { $sum: 1 },
            },
          },
        ]),

        Event.aggregate([
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 },
            },
          },
        ]),

        Registration.aggregate([
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 },
            },
          },
        ]),

        User.countDocuments({ createdAt: { $gte: startOfMonth } }),

        Event.countDocuments({ createdAt: { $gte: startOfMonth } }),

        Event.aggregate([
          { $sort: { registeredCount: -1 } },
          { $limit: 5 },
          {
            $lookup: {
              from: 'users',
              localField: 'organizer',
              foreignField: '_id',
              as: 'organizerInfo',
            },
          },
          { $unwind: { path: '$organizerInfo', preserveNullAndEmptyArrays: true } },
          {
            $project: {
              title: 1,
              slug: 1,
              registeredCount: 1,
              capacity: 1,
              status: 1,
              date: 1,
              price: 1,
              organizer: {
                _id: '$organizerInfo._id',
                name: '$organizerInfo.name',
              },
            },
          },
        ]),
      ]);

    const usersByRole = { attendee: 0, organizer: 0, admin: 0 };
    let totalUsers = 0;
    for (const stat of userStats) {
      usersByRole[stat._id] = stat.count;
      totalUsers += stat.count;
    }

    const eventsByStatus = { draft: 0, published: 0, cancelled: 0, completed: 0 };
    let totalEvents = 0;
    for (const stat of eventStats) {
      eventsByStatus[stat._id] = stat.count;
      totalEvents += stat.count;
    }

    const registrationsByStatus = { confirmed: 0, cancelled: 0, attended: 0 };
    let totalRegistrations = 0;
    for (const stat of registrationStats) {
      registrationsByStatus[stat._id] = stat.count;
      totalRegistrations += stat.count;
    }

    res.status(200).json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          byRole: usersByRole,
          newThisMonth: newUsersThisMonth,
        },
        events: {
          total: totalEvents,
          byStatus: eventsByStatus,
          newThisMonth: newEventsThisMonth,
        },
        registrations: {
          total: totalRegistrations,
          byStatus: registrationsByStatus,
        },
        topEvents,
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    List all users with search, role filter, pagination
// @route   GET /api/admin/users
// @access  Admin
const getAllUsers = async (req, res, next) => {
  try {
    const { search, role, active, page = 1, limit = 20 } = req.query;

    const filter = {};

    if (search) {
      const searchRegex = new RegExp(escapeRegex(search), 'i');
      filter.$or = [{ name: searchRegex }, { email: searchRegex }];
    }

    if (role && VALID_ROLES.includes(role)) {
      filter.role = role;
    }

    if (active === 'true') {
      filter.isActive = true;
    } else if (active === 'false') {
      filter.isActive = false;
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('-password')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      User.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: {
        users,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Change a user's role
// @route   PUT /api/admin/users/:id/role
// @access  Admin
const updateUserRole = async (req, res, next) => {
  try {
    const { role } = req.body;

    if (!role || !VALID_ROLES.includes(role)) {
      throw new AppError(
        `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`,
        400
      );
    }

    if (req.params.id === req.user._id.toString()) {
      throw new AppError('Admin cannot change their own role', 403);
    }

    const user = await User.findById(req.params.id).select('-password');

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Prevent removing the last admin
    if (user.role === 'admin' && role !== 'admin') {
      const adminCount = await User.countDocuments({ role: 'admin' });
      if (adminCount <= 1) {
        throw new AppError('Cannot remove the last admin', 400);
      }
    }

    user.role = role;
    await user.save();

    res.status(200).json({
      success: true,
      data: { user },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Toggle user isActive status
// @route   PUT /api/admin/users/:id/toggle-active
// @access  Admin
const toggleUserActive = async (req, res, next) => {
  try {
    if (req.params.id === req.user._id.toString()) {
      throw new AppError('Admin cannot deactivate themselves', 403);
    }

    const user = await User.findById(req.params.id).select('-password');

    if (!user) {
      throw new AppError('User not found', 404);
    }

    user.isActive = !user.isActive;
    await user.save();

    res.status(200).json({
      success: true,
      data: { user },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete user + cascade delete registrations + handle organizer events
// @route   DELETE /api/admin/users/:id
// @access  Admin
const deleteUser = async (req, res, next) => {
  try {
    if (req.params.id === req.user._id.toString()) {
      throw new AppError('Admin cannot delete themselves', 403);
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      throw new AppError('User not found', 404);
    }

    if (user.role === 'admin') {
      const adminCount = await User.countDocuments({ role: 'admin' });
      if (adminCount <= 1) {
        throw new AppError('Cannot delete the last admin', 400);
      }
    }

    // If user is an organizer, cancel their active events
    if (user.role === 'organizer') {
      await Event.updateMany(
        { organizer: user._id, status: { $in: ['draft', 'published'] } },
        { status: 'cancelled' }
      );
    }

    // Cascade delete all registrations belonging to this user
    await Registration.deleteMany({ user: user._id });

    await User.findByIdAndDelete(user._id);

    res.status(200).json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (err) {
    next(err);
  }
};

// @desc    List all events (any status) with search, filters, pagination
// @route   GET /api/admin/events
// @access  Admin
const getAllEvents = async (req, res, next) => {
  try {
    const { search, status, category, organizer, page = 1, limit = 20 } = req.query;

    const filter = {};

    if (search) {
      const searchRegex = new RegExp(escapeRegex(search), 'i');
      filter.title = searchRegex;
    }

    if (status && VALID_EVENT_STATUSES.includes(status)) {
      filter.status = status;
    }

    if (category) {
      filter.category = category;
    }

    if (organizer && mongoose.Types.ObjectId.isValid(organizer)) {
      filter.organizer = organizer;
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [events, total] = await Promise.all([
      Event.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('organizer', 'name email avatar'),
      Event.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: {
        events,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Admin can change any event's status with transition validation
// @route   PUT /api/admin/events/:id/status
// @access  Admin
const adminUpdateEventStatus = async (req, res, next) => {
  try {
    const { status } = req.body;

    if (!status || !VALID_EVENT_STATUSES.includes(status)) {
      throw new AppError(
        `Invalid status. Must be one of: ${VALID_EVENT_STATUSES.join(', ')}`,
        400
      );
    }

    const event = await Event.findById(req.params.id);

    if (!event) {
      throw new AppError('Event not found', 404);
    }

    const allowedTransitions = STATUS_TRANSITIONS[event.status];
    if (!allowedTransitions.includes(status)) {
      throw new AppError(
        `Cannot transition from '${event.status}' to '${status}'`,
        400
      );
    }

    event.status = status;
    await event.save();

    res.status(200).json({
      success: true,
      data: { event },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Admin can delete any event + cascade delete registrations
// @route   DELETE /api/admin/events/:id
// @access  Admin
const adminDeleteEvent = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      throw new AppError('Event not found', 404);
    }

    await Registration.deleteMany({ event: event._id });
    await Event.findByIdAndDelete(event._id);

    res.status(200).json({
      success: true,
      message: 'Event deleted successfully',
    });
  } catch (err) {
    next(err);
  }
};

// @desc    List all registrations system-wide with filters, pagination
// @route   GET /api/admin/registrations
// @access  Admin
const getAllRegistrations = async (req, res, next) => {
  try {
    const { search, event, user, status, page = 1, limit = 20 } = req.query;

    const filter = {};

    if (search) {
      const searchRegex = new RegExp(escapeRegex(search), 'i');
      filter.confirmationCode = searchRegex;
    }

    if (event && mongoose.Types.ObjectId.isValid(event)) {
      filter.event = event;
    }

    if (user && mongoose.Types.ObjectId.isValid(user)) {
      filter.user = user;
    }

    if (status && ['pending', 'confirmed', 'cancelled', 'attended'].includes(status)) {
      filter.status = status;
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [registrations, total] = await Promise.all([
      Registration.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('event', 'title slug date status')
        .populate('user', 'name email avatar'),
      Registration.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: {
        registrations,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAdminDashboard,
  getAllUsers,
  updateUserRole,
  toggleUserActive,
  deleteUser,
  getAllEvents,
  adminUpdateEventStatus,
  adminDeleteEvent,
  getAllRegistrations,
};
