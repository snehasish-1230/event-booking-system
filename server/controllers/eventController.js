const mongoose = require('mongoose');
const Event = require('../models/Event');
const Registration = require('../models/Registration');
const Payment = require('../models/Payment');
const AppError = require('../utils/AppError');
const escapeRegex = require('../utils/escapeRegex');
const { isPaidEvent } = require('../utils/eventPricing');
const { getTeamFormat } = require('../utils/teamFormat');

const ALLOWED_FIELDS = [
  'title',
  'description',
  'date',
  'endDate',
  'time',
  'location',
  'capacity',
  'minParticipants',
  'teamMode',
  'gameMode',
  'teamSize',
  'price',
  'pricingType',
  'currency',
  'category',
  'tags',
  'image',
  'maxRegistrationsPerUser',
];

/**
 * Pick only whitelisted keys from an object to prevent mass-assignment.
 */
const pickAllowedFields = (source, fields) => {
  const result = {};
  for (const key of fields) {
    if (source[key] !== undefined) {
      result[key] = source[key];
    }
  }
  return result;
};

const normalizeTags = (tags) => {
  if (tags === undefined) return undefined;
  const values = Array.isArray(tags) ? tags : [tags];
  return [...new Set(
    values
      .flatMap((tag) => (typeof tag === 'string' ? tag.split(',') : []))
      .map((tag) => tag.trim())
      .filter(Boolean)
  )].slice(0, 10);
};

/**
 * Check whether the requesting user owns the event or is an admin.
 */
const isOwnerOrAdmin = (event, user) =>
  event.organizer.toString() === user._id.toString() || user.role === 'admin';

const applyPricingUpdate = async (event, fields) => {
  if (fields.price === undefined && fields.pricingType === undefined) return;

  const currentPricingType = isPaidEvent(event) ? 'PAID' : 'FREE';
  const pricingType =
    fields.pricingType ??
    (fields.price === undefined
      ? currentPricingType
      : Number(fields.price) > 0
        ? 'PAID'
        : 'FREE');
  let price = Number(fields.price);
  if (fields.price === undefined) {
    if (pricingType === 'FREE') {
      price = 0;
    } else if (pricingType === currentPricingType) {
      price = Number(event.price ?? 0);
    } else {
      price = undefined;
    }
  }

  if (pricingType === 'FREE' && price !== 0) {
    throw new AppError('FREE events must have a price of 0', 400);
  }
  if (pricingType === 'PAID' && !(price > 0)) {
    throw new AppError('PAID events require a price greater than 0', 400);
  }

  const priceChanged = price !== Number(event.price ?? 0);
  const pricingTypeChanged = pricingType !== currentPricingType;
  if (priceChanged || pricingTypeChanged) {
    const [activeRegistration, registrationIds] = await Promise.all([
      Registration.exists({
        event: event._id,
        status: { $in: ['pending', 'confirmed', 'attended'] },
      }),
      Registration.distinct('_id', { event: event._id }),
    ]);
    const paymentHistory = registrationIds.length
      ? await Payment.exists({ booking: { $in: registrationIds } })
      : null;

    if (activeRegistration || paymentHistory) {
      throw new AppError(
        'Pricing cannot be changed while active registrations or payment history exist',
        409
      );
    }
  }

  fields.pricingType = pricingType;
  fields.price = price;
};

const normalizeEventTeamFormat = (fields, currentEvent) => {
  const hasTeamFormatInput =
    fields.teamMode !== undefined ||
    fields.gameMode !== undefined ||
    fields.teamSize !== undefined;
  if (!hasTeamFormatInput && currentEvent) return false;

  const submitted = getTeamFormat({
    teamMode:
      fields.teamMode ||
      (!fields.gameMode && fields.teamSize === undefined ? currentEvent?.teamMode : undefined),
    gameMode:
      fields.gameMode ||
      (!fields.teamMode && fields.teamSize === undefined ? currentEvent?.gameMode : undefined),
    teamSize:
      fields.teamSize ??
      (!fields.teamMode && !fields.gameMode ? currentEvent?.teamSize : undefined),
  });
  if (!submitted) {
    throw new AppError('Team size and game mode must match (1/SOLO, 2/DUO, 3/TRIO, 4/SQUAD)', 400);
  }
  Object.assign(fields, submitted);
  return Boolean(currentEvent && submitted.teamMode !== currentEvent.teamMode);
};

// @desc    Create a new event (draft)
// @route   POST /api/events
const createEvent = async (req, res, next) => {
  try {
    const fields = pickAllowedFields(req.body, ALLOWED_FIELDS);
    if (fields.tags !== undefined) fields.tags = normalizeTags(fields.tags);

    if (new Date(fields.date) <= new Date()) {
      throw new AppError('Event date must be in the future', 400);
    }

    fields.pricingType ??= Number(fields.price ?? 0) > 0 ? 'PAID' : 'FREE';
    fields.price ??= 0;
    fields.teamMode ??=
      fields.gameMode ||
      ({ 1: 'SOLO', 2: 'DUO', 3: 'TRIO', 4: 'SQUAD' }[Number(fields.teamSize)]) ||
      'SOLO';
    normalizeEventTeamFormat(fields);
    if (fields.pricingType === 'FREE' && Number(fields.price) !== 0) {
      throw new AppError('FREE events must have a price of 0', 400);
    }
    if (fields.pricingType === 'PAID' && !(Number(fields.price) > 0)) {
      throw new AppError('PAID events require a price greater than 0', 400);
    }
    fields.price = Number(fields.price);
    fields.currency = 'INR';
    fields.organizer = req.user._id;
    fields.status = 'draft';

    const event = await Event.create(fields);

    res.status(201).json({
      success: true,
      data: { event },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update an existing event
// @route   PUT /api/events/:id
const updateEvent = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      throw new AppError('Event not found', 404);
    }

    if (!isOwnerOrAdmin(event, req.user)) {
      throw new AppError('Not authorized to update this event', 403);
    }

    if (event.status === 'cancelled') {
      throw new AppError('Cannot update a cancelled event', 400);
    }

    const fields = pickAllowedFields(req.body, ALLOWED_FIELDS);
    if (fields.tags !== undefined) fields.tags = normalizeTags(fields.tags);
    const teamModeChanged = normalizeEventTeamFormat(fields, event);
    if (
      teamModeChanged &&
      await Registration.exists({ event: event._id })
    ) {
      throw new AppError(
        'Team format cannot change after registrations have been created',
        409
      );
    }
    if (fields.price !== undefined || fields.pricingType !== undefined) {
      await applyPricingUpdate(event, fields);
      fields.currency = 'INR';
    }

    const updatedCapacity = Number(fields.capacity ?? event.capacity);
    const updatedMinimum = Number(
      fields.minParticipants ?? event.minParticipants ?? 1
    );
    if (updatedMinimum > updatedCapacity) {
      throw new AppError(
        'Minimum members cannot exceed event capacity',
        400
      );
    }

    const activeRegistrationCount =
      await Registration.getCapacityConsumingCount(event._id);
    if (
      fields.capacity !== undefined &&
      Number(fields.capacity) !== event.capacity &&
      Number(fields.capacity) < activeRegistrationCount
    ) {
      throw new AppError(
        `Capacity cannot be set below ${activeRegistrationCount} active registration${activeRegistrationCount === 1 ? '' : 's'}.`,
        400
      );
    }

    let updatedEvent;
    const capacityChanged =
      fields.capacity !== undefined &&
      Number(fields.capacity) !== event.capacity;
    const pricingChanged =
      fields.pricingType !== undefined &&
      (fields.pricingType !== (isPaidEvent(event) ? 'PAID' : 'FREE') ||
        Number(fields.price) !== Number(event.price ?? 0));
    if (capacityChanged || pricingChanged || teamModeChanged) {
      const registrationCountFilter =
        event.registeredCount > 0
          ? { registeredCount: event.registeredCount }
          : {
              $or: [
                { registeredCount: 0 },
                { registeredCount: { $exists: false } },
              ],
            };
      updatedEvent = await Event.findOneAndUpdate(
        {
          _id: event._id,
          status: { $ne: 'cancelled' },
          ...(teamModeChanged && {
            registeredCount: event.registeredCount ?? 0,
          }),
          ...registrationCountFilter,
        },
        fields,
        { new: true, runValidators: true }
      );
      if (!updatedEvent) {
        throw new AppError(
          'Event registrations changed while updating. Refresh and try again.',
          409
        );
      }
    } else {
      Object.assign(event, fields);
      await event.save();
      updatedEvent = event;
    }

    res.status(200).json({
      success: true,
      data: { event: updatedEvent },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete an event
// @route   DELETE /api/events/:id
const deleteEvent = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      throw new AppError('Event not found', 404);
    }

    if (!isOwnerOrAdmin(event, req.user)) {
      throw new AppError('Not authorized to delete this event', 403);
    }

    if (event.registeredCount > 0) {
      throw new AppError(
        'Cannot delete event with active registrations. Cancel the event first.',
        400
      );
    }

    const Registration = mongoose.models.Registration;
    if (Registration) {
      await Registration.deleteMany({ event: event._id });
    }

    await Event.findByIdAndDelete(event._id);

    res.status(200).json({
      success: true,
      message: 'Event deleted successfully',
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Publish a draft event
// @route   PUT /api/events/:id/publish
const publishEvent = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      throw new AppError('Event not found', 404);
    }

    if (!isOwnerOrAdmin(event, req.user)) {
      throw new AppError('Not authorized to publish this event', 403);
    }

    if (event.status !== 'draft') {
      throw new AppError('Only draft events can be published', 400);
    }

    const requiredFields = ['title', 'description', 'date', 'capacity', 'category'];
    const missingFields = requiredFields.filter((field) => !event[field]);

    if (!event.location?.venue || !event.location?.city) {
      missingFields.push('location (venue and city)');
    }

    if (missingFields.length > 0) {
      throw new AppError(
        `Missing required fields: ${missingFields.join(', ')}`,
        400
      );
    }

    event.status = 'published';
    await event.save();

    res.status(200).json({
      success: true,
      data: { event },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Cancel a published or draft event
// @route   PUT /api/events/:id/cancel
const cancelEvent = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      throw new AppError('Event not found', 404);
    }

    if (!isOwnerOrAdmin(event, req.user)) {
      throw new AppError('Not authorized to cancel this event', 403);
    }

    if (!['published', 'draft'].includes(event.status)) {
      throw new AppError('Only published or draft events can be cancelled', 400);
    }

    event.status = 'cancelled';
    await event.save();

    res.status(200).json({
      success: true,
      data: { event },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    List published events with filtering, search, sorting, pagination
// @route   GET /api/events
const getEvents = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 12,
      search,
      category,
      city,
      dateFrom,
      dateTo,
      priceMin,
      priceMax,
      sort = 'date',
      upcoming,
    } = req.query;

    const filter = { status: 'published' };

    if (search) {
      const searchRegex = new RegExp(escapeRegex(search), 'i');
      filter.$or = [{ title: searchRegex }, { description: searchRegex }];
    }

    if (category) filter.category = category;
    if (city) filter['location.city'] = new RegExp(`^${escapeRegex(city)}$`, 'i');

    if (dateFrom || dateTo) {
      filter.date = {};
      if (dateFrom) filter.date.$gte = new Date(dateFrom);
      if (dateTo) filter.date.$lte = new Date(dateTo);
    }

    if (priceMin !== undefined || priceMax !== undefined) {
      filter.price = {};
      if (priceMin !== undefined) filter.price.$gte = Number(priceMin);
      if (priceMax !== undefined) filter.price.$lte = Number(priceMax);
    }

    if (upcoming === 'true') {
      filter.date = { ...filter.date, $gte: new Date() };
    }

    const sortOptions = {
      date: { date: 1 },
      '-date': { date: -1 },
      price: { price: 1 },
      '-price': { price: -1 },
      title: { title: 1 },
      createdAt: { createdAt: -1 },
    };
    const sortBy = sortOptions[sort] || { date: 1 };

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 12));
    const skip = (pageNum - 1) * limitNum;

    const [events, total] = await Promise.all([
      Event.find(filter)
        .sort(sortBy)
        .skip(skip)
        .limit(limitNum)
        .populate('organizer', 'name avatar'),
      Event.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limitNum);

    res.status(200).json({
      success: true,
      data: {
        events,
        page: pageNum,
        totalPages,
        total,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get a single published event by slug
// @route   GET /api/events/:slug
const getEventBySlug = async (req, res, next) => {
  try {
    const event = await Event.findOne({
      slug: req.params.slug,
      status: 'published',
    }).populate('organizer', 'name avatar');

    if (!event) {
      throw new AppError('Event not found', 404);
    }

    const response = { event };

    if (req.user) {
      const Registration = mongoose.models.Registration;
      if (Registration) {
        const existingRegistration = await Registration.findOne({
          event: event._id,
          user: req.user._id,
          status: { $ne: 'cancelled' },
        });
        response.isRegistered = !!existingRegistration;
        if (existingRegistration) {
          response.userRegistration = {
            _id: existingRegistration._id,
            status: existingRegistration.status,
            confirmationCode: existingRegistration.confirmationCode,
          };
        }
      }
    }

    res.status(200).json({
      success: true,
      data: response,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get a single event by ID (owners/admins can see any status)
// @route   GET /api/events/id/:id
const getEventById = async (req, res, next) => {
  try {
    const filter = { _id: req.params.id };

    const isOwnerOrAdminUser =
      req.user &&
      (req.user.role === 'admin' || req.user.role === 'organizer');

    if (!isOwnerOrAdminUser) {
      filter.status = 'published';
    }

    const event = await Event.findOne(filter).populate('organizer', 'name avatar');

    if (!event) {
      throw new AppError('Event not found', 404);
    }

    if (
      isOwnerOrAdminUser &&
      req.user.role === 'organizer' &&
      event.organizer?._id?.toString() !== req.user._id.toString()
    ) {
      if (event.status !== 'published') {
        throw new AppError('Event not found', 404);
      }
    }

    const activeRegistrationCount =
      req.user &&
      (req.user.role === 'admin' ||
        event.organizer?._id?.toString() === req.user._id.toString())
        ? await Registration.getCapacityConsumingCount(event._id)
        : undefined;

    res.status(200).json({
      success: true,
      data: {
        event,
        ...(activeRegistrationCount !== undefined && { activeRegistrationCount }),
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get featured upcoming published events
// @route   GET /api/events/featured
const getFeaturedEvents = async (req, res, next) => {
  try {
    const events = await Event.find({
      status: 'published',
      isFeatured: true,
      date: { $gte: new Date() },
    })
      .sort({ date: 1 })
      .limit(6)
      .populate('organizer', 'name avatar');

    res.status(200).json({
      success: true,
      data: { events },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get aggregated category list with event counts
// @route   GET /api/events/categories
const getEventCategories = async (req, res, next) => {
  try {
    const categories = await Event.aggregate([
      { $match: { status: 'published' } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $project: { _id: 0, category: '$_id', count: 1 } },
    ]);

    res.status(200).json({
      success: true,
      data: { categories },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get events organized by the current user
// @route   GET /api/events/my/organized
const getMyEvents = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    const filter = { organizer: req.user._id };
    if (status) {
      filter.status = status;
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    const [events, total] = await Promise.all([
      Event.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('organizer', 'name email'),
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

module.exports = {
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
};
