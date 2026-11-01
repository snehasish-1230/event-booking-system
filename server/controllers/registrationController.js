const Registration = require('../models/Registration');
const Payment = require('../models/Payment');
const Event = require('../models/Event');
const EventRoom = require('../models/EventRoom');
const AppError = require('../utils/AppError');
const escapeRegex = require('../utils/escapeRegex');
const { sendEmail } = require('../utils/emailService');
const generateConfirmationEmail = require('../templates/confirmationEmail');
const generateCancellationEmail = require('../templates/cancellationEmail');
const { isPaidEvent } = require('../utils/eventPricing');
const {
  getTeamFormat,
  isValidTeamRegistration,
} = require('../utils/teamFormat');

const validateTeamRegistration = (event, body) => {
  const players = Array.isArray(body.players) ? body.players : [];
  const teamFormat = getTeamFormat(event);
  if (!teamFormat) {
    if (players.length) {
      throw new AppError('This event does not accept a Free Fire team roster', 400);
    }
    return { teamMode: undefined, gameMode: undefined, teamSize: undefined, players: [] };
  }

  if (
    (body.teamMode &&
      String(body.teamMode).toUpperCase() !== teamFormat.teamMode) ||
    (body.gameMode &&
      String(body.gameMode).toUpperCase() !== teamFormat.gameMode) ||
    (body.teamSize !== undefined && Number(body.teamSize) !== teamFormat.teamSize)
  ) {
    throw new AppError('Team format does not match this event', 400);
  }
  if (players.length !== teamFormat.teamSize) {
    throw new AppError(
      `${teamFormat.teamMode} registration requires exactly ${teamFormat.teamSize} player${teamFormat.teamSize === 1 ? '' : 's'}`,
      400
    );
  }

  const normalizedPlayers = players.map((player) => ({
    playerName: typeof player.playerName === 'string' ? player.playerName.trim() : '',
    freeFireUid: typeof player.freeFireUid === 'string' ? player.freeFireUid.trim() : '',
  }));
  if (
    normalizedPlayers.some(
      ({ playerName, freeFireUid }) =>
        playerName.length < 2 ||
        playerName.length > 50 ||
        !/^\d{1,20}$/.test(freeFireUid)
    )
  ) {
    throw new AppError('Enter a valid player name and numeric Free Fire UID for every team member', 400);
  }
  if (new Set(normalizedPlayers.map((player) => player.freeFireUid)).size !== normalizedPlayers.length) {
    throw new AppError('Each team member must have a unique Free Fire UID', 400);
  }

  return {
    ...teamFormat,
    players: normalizedPlayers,
  };
};

const getRoomDetailsForRegistration = async (registration) => {
  const event = registration.event;
  const eligible =
    registration.status === 'confirmed' &&
    event &&
    isValidTeamRegistration(registration, event) &&
    (isPaidEvent(event)
      ? registration.paymentStatus === 'APPROVED'
      : registration.paymentStatus === 'NOT_REQUIRED');
  if (!eligible) return null;

  const room = await EventRoom.findOne({
    event: event._id,
    $or: [
      { status: 'published' },
      { status: { $exists: false }, publishedAt: { $exists: true } },
    ],
  }).select('+roomPassword');
  const assignment = room?.assignments.find(
    (entry) => entry.registration.toString() === registration._id.toString()
  );
  if (!room || !assignment) return null;

  return {
    roomId: room.roomId,
    roomPassword: room.roomPassword,
    matchAt: room.matchAt,
    slotNumber: assignment.slotNumber,
    instructions: room.instructions || '',
  };
};

// @desc    Register for an event (race-condition safe)
// @route   POST /api/events/:id/register
const registerForEvent = async (req, res, next) => {
  try {
    const eventId = req.params.id;
    const userId = req.user._id;

    const event = await Event.findById(eventId);

    if (!event) {
      throw new AppError('Event not found', 404);
    }

    if (event.status !== 'published') {
      throw new AppError('Event is not available for registration', 400);
    }

    if (event.date < new Date()) {
      throw new AppError('Event has already passed', 400);
    }

    if (await EventRoom.exists({
      event: eventId,
      $or: [
        { status: 'published' },
        { status: { $exists: false }, publishedAt: { $exists: true } },
      ],
    })) {
      throw new AppError('Registration is closed after room details are published', 400);
    }
    const teamRegistration = validateTeamRegistration(event, req.body);

    const existingRegistration = await Registration.findOne({
      user: userId,
      event: eventId,
    });

    if (existingRegistration && existingRegistration.status !== 'cancelled') {
      throw new AppError('You are already registered for this event', 409);
    }
    const previouslyApprovedPayment = existingRegistration
      ? await Payment.findOne({ booking: existingRegistration._id, status: 'APPROVED' })
      : null;

    // Atomic capacity check — prevents race conditions on last-spot registration
    const updatedEvent = await Event.findOneAndUpdate(
      {
        _id: eventId,
        status: 'published',
        teamMode: event.teamMode ?? null,
        $expr: { $lt: ['$registeredCount', '$capacity'] },
      },
      { $inc: { registeredCount: 1 } },
      { returnDocument: 'after' }
    );

    if (!updatedEvent) {
      throw new AppError('Event is full, no spots available', 400);
    }

    let registration;
    try {
      const requiresPayment = isPaidEvent(updatedEvent);
      if (
        requiresPayment &&
        previouslyApprovedPayment &&
        previouslyApprovedPayment.amount !== updatedEvent.price
      ) {
        throw new AppError('Previously verified payment does not match the current ticket price', 409);
      }
      const paymentAlreadyVerified =
        requiresPayment &&
        previouslyApprovedPayment &&
        previouslyApprovedPayment.amount === updatedEvent.price;
      const initialPaymentStatus = paymentAlreadyVerified
        ? 'APPROVED'
        : requiresPayment
          ? 'PENDING'
          : 'NOT_REQUIRED';
      if (existingRegistration && existingRegistration.status === 'cancelled') {
        registration = await Registration.findOneAndUpdate(
          { _id: existingRegistration._id, status: 'cancelled' },
          {
            $set: {
              status: requiresPayment && !paymentAlreadyVerified ? 'pending' : 'confirmed',
              paymentStatus: initialPaymentStatus,
              ticketType: req.body.ticketType || 'standard',
              notes: req.body.notes || '',
              teamMode: teamRegistration.teamMode,
              gameMode: teamRegistration.gameMode,
              teamSize: teamRegistration.teamSize,
              players: teamRegistration.players,
              registeredAt: new Date(),
              cancelledAt: null,
            },
          },
          { returnDocument: 'after', runValidators: true }
        );
        if (!registration) {
          throw new AppError('You are already registered for this event', 409);
        }
      } else {
        registration = await Registration.create({
          user: userId,
          event: eventId,
          status: requiresPayment && !paymentAlreadyVerified ? 'pending' : 'confirmed',
          paymentStatus: initialPaymentStatus,
          ticketType: req.body.ticketType || 'standard',
          notes: req.body.notes || '',
          teamMode: teamRegistration.teamMode,
          gameMode: teamRegistration.gameMode,
          teamSize: teamRegistration.teamSize,
          players: teamRegistration.players,
        });
      }
    } catch (regError) {
      await Event.findOneAndUpdate(
        { _id: eventId, registeredCount: { $gt: 0 } },
        { $inc: { registeredCount: -1 } }
      );
      throw regError;
    }

    await registration.populate(
      'event',
      'title slug date time location image status organizer price pricingType currency'
    );

    if (registration.status === 'confirmed') {
      sendEmail({
        to: req.user.email,
        subject: `Registration Confirmed — ${updatedEvent.title}`,
        html: generateConfirmationEmail({
          userName: req.user.name,
          eventTitle: updatedEvent.title,
          eventDate: updatedEvent.date,
          eventTime: updatedEvent.time || 'TBA',
          venue: updatedEvent.location?.venue || '',
          city: updatedEvent.location?.city || '',
          confirmationCode: registration.confirmationCode,
          eventSlug: updatedEvent.slug,
        }),
      }).catch((err) => console.error('Confirmation email failed:', err.message));
    }

    res.status(201).json({
      success: true,
      data: {
        registration,
        confirmationCode: registration.confirmationCode,
      },
    });
  } catch (err) {
    if (err.code === 11000 && err.keyPattern?.user && err.keyPattern?.event) {
      return next(new AppError('You are already registered for this event', 409));
    }
    next(err);
  }
};

// @desc    Cancel a registration
// @route   DELETE /api/registrations/:id
const cancelRegistration = async (req, res, next) => {
  try {
    const registration = await Registration.findById(req.params.id);

    if (!registration) {
      throw new AppError('Registration not found', 404);
    }

    if (registration.user.toString() !== req.user._id.toString()) {
      throw new AppError('Not authorized to cancel this registration', 403);
    }

    if (registration.status === 'cancelled') {
      throw new AppError('Registration is already cancelled', 400);
    }

    registration.status = 'cancelled';
    registration.cancelledAt = new Date();
    await registration.save();

    // Atomic decrement with floor at 0
    await Event.findOneAndUpdate(
      { _id: registration.event, registeredCount: { $gt: 0 } },
      { $inc: { registeredCount: -1 } }
    );

    const event = await Event.findById(registration.event).select(
      'title date location'
    );

    // Fire-and-forget cancellation email
    if (event) {
      sendEmail({
        to: req.user.email,
        subject: `Registration Cancelled — ${event.title}`,
        html: generateCancellationEmail({
          userName: req.user.name,
          eventTitle: event.title,
          eventDate: event.date,
          venue: event.location?.venue || '',
          city: event.location?.city || '',
        }),
      }).catch((err) => console.error('Cancellation email failed:', err.message));
    }

    res.status(200).json({
      success: true,
      message: 'Registration cancelled successfully',
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get current user's registrations
// @route   GET /api/registrations/my
const getMyRegistrations = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    const filter = { user: req.user._id };
    if (status && ['pending', 'confirmed', 'cancelled', 'attended'].includes(status)) {
      filter.status = status;
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    const [registrations, total] = await Promise.all([
      Registration.find(filter)
        .sort({ registeredAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('event', 'title slug date location image status organizer price pricingType currency teamMode gameMode teamSize'),
      Registration.countDocuments(filter),
    ]);
    const registrationsWithRooms = await Promise.all(
      registrations.map(async (registration) => ({
        ...registration.toObject(),
        room: await getRoomDetailsForRegistration(registration),
      }))
    );

    res.status(200).json({
      success: true,
      data: {
        registrations: registrationsWithRooms,
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

// @desc    Get a single registration by ID
// @route   GET /api/registrations/:id
const getRegistrationById = async (req, res, next) => {
  try {
    const registration = await Registration.findById(req.params.id)
      .populate('event', 'title slug date time location image status organizer price pricingType currency teamMode gameMode teamSize')
      .populate('user', 'name email avatar');

    if (!registration) {
      throw new AppError('Registration not found', 404);
    }

    const isOwner =
      registration.user._id.toString() === req.user._id.toString();
    const isAdminOrOrganizer =
      req.user.role === 'admin' ||
      registration.event.organizer?.toString() === req.user._id.toString();

    if (!isOwner && !isAdminOrOrganizer) {
      throw new AppError('Not authorized to view this registration', 403);
    }

    const registrationData = registration.toObject();
    if (isOwner || req.user.role === 'admin') {
      registrationData.room = await getRoomDetailsForRegistration(registration);
    }

    res.status(200).json({
      success: true,
      data: { registration: registrationData },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Find registration by confirmation code
// @route   GET /api/registrations/code/:code
const getRegistrationByCode = async (req, res, next) => {
  try {
    const registration = await Registration.findOne({
      confirmationCode: req.params.code.toUpperCase(),
    })
      .populate('event', 'title slug date time location image status organizer price pricingType currency teamMode gameMode teamSize')
      .populate('user', 'name email avatar');

    if (!registration) {
      throw new AppError('Registration not found', 404);
    }

    const isOwner =
      registration.user._id.toString() === req.user._id.toString();
    const isAdminOrOrganizer =
      req.user.role === 'admin' ||
      registration.event.organizer?.toString() === req.user._id.toString();

    if (!isOwner && !isAdminOrOrganizer) {
      throw new AppError('Not authorized to view this registration', 403);
    }

    res.status(200).json({
      success: true,
      data: { registration },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get all registrations for a specific event (organizer/admin)
// @route   GET /api/events/:id/registrations
const getEventRegistrations = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      throw new AppError('Event not found', 404);
    }

    const isOrganizer =
      event.organizer.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isOrganizer && !isAdmin) {
      throw new AppError('Not authorized to view registrations for this event', 403);
    }

    const { status, search, page = 1, limit = 20 } = req.query;

    const filter = { event: event._id };
    if (status && ['pending', 'confirmed', 'cancelled', 'attended'].includes(status)) {
      filter.status = status;
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    let registrationsQuery = Registration.find(filter)
      .sort({ registeredAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate('user', 'name email phone avatar');

    const [registrations, total, pendingCount, confirmedCount, cancelledCount, attendedCount] =
      await Promise.all([
        registrationsQuery,
        Registration.countDocuments(filter),
        Registration.countDocuments({ event: event._id, status: 'pending' }),
        Registration.countDocuments({ event: event._id, status: 'confirmed' }),
        Registration.countDocuments({ event: event._id, status: 'cancelled' }),
        Registration.countDocuments({ event: event._id, status: 'attended' }),
      ]);

    let filteredRegistrations = registrations;
    if (search) {
      const searchRegex = new RegExp(escapeRegex(search), 'i');
      filteredRegistrations = registrations.filter(
        (reg) =>
          searchRegex.test(reg.user?.name) || searchRegex.test(reg.user?.email)
      );
    }

    const totalConfirmed = confirmedCount;
    const totalCancelled = cancelledCount;
    const capacityPercentage =
      event.capacity > 0
        ? Math.round(((pendingCount + confirmedCount + attendedCount) / event.capacity) * 100)
        : 0;

    res.status(200).json({
      success: true,
      data: {
        registrations: filteredRegistrations,
        stats: {
          totalConfirmed,
          totalPending: pendingCount,
          totalCancelled,
          totalAttended: attendedCount,
          capacityPercentage,
        },
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

// @desc    Check in an attendee (organizer/admin)
// @route   PUT /api/registrations/:id/check-in
const checkInAttendee = async (req, res, next) => {
  try {
    // Find by ID or confirmation code
    let registration = await Registration.findById(req.params.id).populate(
      'event',
      'organizer title price'
    );

    if (!registration) {
      registration = await Registration.findOne({
        confirmationCode: req.params.id.toUpperCase(),
      }).populate('event', 'organizer title price pricingType');
    }

    if (!registration) {
      throw new AppError('Registration not found', 404);
    }

    const isOrganizer =
      registration.event.organizer.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isOrganizer && !isAdmin) {
      throw new AppError('Not authorized to check in attendees for this event', 403);
    }

    if (registration.status === 'attended') {
      throw new AppError('Attendee has already been checked in', 400);
    }

    if (registration.status === 'cancelled') {
      throw new AppError('Cannot check in a cancelled registration', 400);
    }

    if (registration.status !== 'confirmed') {
      throw new AppError('Only confirmed registrations can be checked in', 400);
    }

    if (isPaidEvent(registration.event) && registration.paymentStatus !== 'APPROVED') {
      throw new AppError('Payment must be verified before checking in this attendee', 400);
    }

    registration.status = 'attended';
    await registration.save();

    await registration.populate('user', 'name email avatar');

    res.status(200).json({
      success: true,
      message: 'Attendee checked in successfully',
      data: { registration },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get event statistics (organizer/admin)
// @route   GET /api/events/:id/stats
const getEventStats = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      throw new AppError('Event not found', 404);
    }

    const isOrganizer =
      event.organizer.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isOrganizer && !isAdmin) {
      throw new AppError('Not authorized to view stats for this event', 403);
    }

    const [totalRegistrations, pendingCount, confirmedCount, cancelledCount, attendedCount] =
      await Promise.all([
        Registration.countDocuments({ event: event._id }),
        Registration.countDocuments({ event: event._id, status: 'pending' }),
        Registration.countDocuments({ event: event._id, status: 'confirmed' }),
        Registration.countDocuments({ event: event._id, status: 'cancelled' }),
        Registration.countDocuments({ event: event._id, status: 'attended' }),
      ]);

    const capacityPercentage =
      event.capacity > 0
        ? Math.round(((pendingCount + confirmedCount + attendedCount) / event.capacity) * 100)
        : 0;

    const revenueEstimate = event.price * confirmedCount;

    res.status(200).json({
      success: true,
      data: {
        event: {
          id: event._id,
          title: event.title,
          capacity: event.capacity,
          price: event.price,
          currency: event.currency,
        },
        stats: {
          totalRegistrations,
          pendingCount,
          confirmedCount,
          cancelledCount,
          attendedCount,
          capacityPercentage,
          revenueEstimate,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  validateTeamRegistration,
  getRoomDetailsForRegistration,
  registerForEvent,
  cancelRegistration,
  getMyRegistrations,
  getRegistrationById,
  getRegistrationByCode,
  getEventRegistrations,
  checkInAttendee,
  getEventStats,
};
