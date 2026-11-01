const Event = require('../models/Event');
const EventRoom = require('../models/EventRoom');
const Registration = require('../models/Registration');
const AppError = require('../utils/AppError');
const { isPaidEvent } = require('../utils/eventPricing');
const { sendEmail } = require('../utils/emailService');
const generateEventRoomEmail = require('../templates/eventRoomEmail');
const {
  getTeamFormat,
  isValidTeamRegistration,
} = require('../utils/teamFormat');

const forwardRoomError = (error, next) => {
  if (error.name === 'VersionError') {
    return next(new AppError('Room details changed concurrently. Reload the page and try again.', 409));
  }
  return next(error);
};

const isRoomEligible = (registration, event) =>
  isValidTeamRegistration(registration, event) &&
  registration.status === 'confirmed' &&
  (isPaidEvent(event)
    ? registration.paymentStatus === 'APPROVED'
    : registration.paymentStatus === 'NOT_REQUIRED');

const getEventForRoomManagement = async (eventId) => {
  const event = await Event.findById(eventId);
  if (!event) throw new AppError('Event not found', 404);
  if (!getTeamFormat(event)) {
    throw new AppError('Configure a team mode before managing this event room', 400);
  }
  return event;
};

const normalizeAssignments = (assignments = []) =>
  assignments.map(({ registrationId, registration, slotNumber }) => ({
    registration: registrationId || registration,
    slotNumber: Number(slotNumber),
  }));

const validateAssignments = (assignments, eligibleRegistrations, requireAll = false) => {
  const eligibleIds = new Set(
    eligibleRegistrations.map((registration) => registration._id.toString())
  );
  const registrationIds = assignments.map(({ registration }) => registration.toString());
  const slotNumbers = assignments.map(({ slotNumber }) => slotNumber);
  if (
    (requireAll && assignments.length !== eligibleIds.size) ||
    assignments.some(({ registration, slotNumber }) =>
      !eligibleIds.has(registration.toString()) ||
      !Number.isInteger(slotNumber) ||
      slotNumber < 1 ||
      slotNumber > 100000
    ) ||
    new Set(registrationIds).size !== registrationIds.length ||
    new Set(slotNumbers).size !== slotNumbers.length
  ) {
    throw new AppError(
      'Assign unique positive slots only to eligible teams; every eligible team needs a slot before publishing',
      400
    );
  }
};

const deliverRoomEmail = async (registration, event, room, assignment, { force = false } = {}) => {
  const previousAttempts = assignment.emailAttempts || 0;
  const emailStatusCondition = force
    ? { $ne: 'sending' }
    : { $nin: ['sent', 'sending'] };
  const claim = await EventRoom.updateOne(
    {
      _id: room._id,
      assignments: {
        $elemMatch: {
          registration: registration._id,
          emailStatus: emailStatusCondition,
        },
      },
    },
    {
      $set: { 'assignments.$.emailStatus': 'sending' },
      $unset: { 'assignments.$.emailError': 1 },
      $inc: { 'assignments.$.emailAttempts': 1, __v: 1 },
    }
  );
  if (!claim.matchedCount) return null;
  assignment.emailAttempts = previousAttempts + 1;
  assignment.emailStatus = 'sending';
  assignment.emailError = undefined;

  let success = false;
  try {
    const result = await sendEmail({
      to: registration.user?.email,
      subject: `Your Free Fire Tournament Room Details - ${event.title}`,
      html: generateEventRoomEmail({
        userName: registration.user?.name,
        eventTitle: event.title,
        roomId: room.roomId,
        roomPassword: room.roomPassword,
        slotNumber: assignment.slotNumber,
        matchAt: room.matchAt,
        teamMode: registration.teamMode || event.teamMode || event.gameMode,
        teamSize: registration.teamSize || event.teamSize || registration.players?.length || 1,
        players: registration.players || [],
        registrationId: registration._id,
        instructions: room.instructions,
      }),
    });
    success = Boolean(result?.success);
  } catch {
    success = false;
  }

  const status = success ? 'sent' : 'failed';
  const sentAt = success ? new Date() : undefined;
  const error = success ? undefined : 'Email delivery failed. Check email service configuration.';
  const deliveryUpdate = await EventRoom.updateOne(
    {
      _id: room._id,
      assignments: {
        $elemMatch: {
          registration: registration._id,
          emailStatus: 'sending',
        },
      },
    },
    {
      $set: {
        'assignments.$.emailStatus': status,
        ...(sentAt && { 'assignments.$.emailSentAt': sentAt }),
        ...(error && { 'assignments.$.emailError': error }),
      },
      ...(!sentAt && { $unset: { 'assignments.$.emailSentAt': 1 } }),
      $inc: { __v: 1 },
    }
  );
  if (!deliveryUpdate.matchedCount) {
    throw new AppError('Email delivery completed but its status could not be recorded. Check the email before retrying.', 409);
  }
  assignment.emailStatus = status;
  assignment.emailSentAt = sentAt;
  assignment.emailError = error;
  return success;
};

const loadRoomForAdmin = (eventId) =>
  EventRoom.findOne({ event: eventId }).select('+roomPassword +draft.roomPassword');

const getEventRoomManagement = async (req, res, next) => {
  try {
    const event = await getEventForRoomManagement(req.params.id);
    const [room, registrations] = await Promise.all([
      loadRoomForAdmin(event._id),
      Registration.find({ event: event._id })
        .sort({ registeredAt: 1 })
        .populate('user', 'name email'),
    ]);

    res.status(200).json({
      success: true,
      data: {
        event: {
          _id: event._id,
          title: event.title,
          date: event.date,
          teamMode: event.teamMode,
          gameMode: event.gameMode || event.teamMode,
          teamSize: event.teamSize || getTeamFormat(event)?.teamSize,
          pricingType: event.pricingType,
          price: event.price,
        },
        room,
        registrations: registrations.map((registration) => ({
          ...registration.toObject(),
          roomEligible: isRoomEligible(registration, event),
          slotNumber:
            room?.assignments.find(
              (assignment) =>
                assignment.registration.toString() === registration._id.toString()
            )?.slotNumber ?? null,
        })),
      },
    });
  } catch (err) {
    forwardRoomError(err, next);
  }
};

const saveEventRoomDraft = async (req, res, next) => {
  try {
    const event = await getEventForRoomManagement(req.params.id);
    const registrations = await Registration.find({ event: event._id }).populate(
      'user',
      'name email'
    );
    const eligibleRegistrations = registrations.filter((registration) =>
      isRoomEligible(registration, event)
    );
    const assignments = normalizeAssignments(req.body.assignments || []);
    validateAssignments(assignments, eligibleRegistrations);
    const room = (await loadRoomForAdmin(event._id)) || new EventRoom({ event: event._id });
    room.draft = {
      roomId: req.body.roomId.trim(),
      roomPassword: req.body.roomPassword.trim(),
      matchAt: new Date(req.body.matchAt),
      instructions: req.body.instructions?.trim() || '',
      assignments,
    };
    await room.save();

    res.status(200).json({
      success: true,
      message: 'Room details saved as a draft. They are not visible to users until published.',
      data: { room },
    });
  } catch (err) {
    forwardRoomError(err, next);
  }
};

const publishEventRoom = async (req, res, next) => {
  try {
    const event = await getEventForRoomManagement(req.params.id);
    const registrations = await Registration.find({ event: event._id }).populate(
      'user',
      'name email'
    );
    const eligibleRegistrations = registrations.filter((registration) =>
      isRoomEligible(registration, event)
    );
    if (eligibleRegistrations.length === 0) {
      throw new AppError('There are no confirmed, payment-eligible teams to notify', 400);
    }

    const room = await loadRoomForAdmin(event._id);
    if (!room?.draft) {
      throw new AppError('Save room details before publishing', 400);
    }
    const draft = room.draft;
    const assignments = normalizeAssignments(req.body.assignments || draft.assignments);
    validateAssignments(assignments, eligibleRegistrations, true);
    const now = new Date();

    const previousAssignments = new Map(
      (room.assignments || []).map((assignment) => [
        assignment.registration.toString(),
        assignment,
      ])
    );
    const detailsChanged =
      room.roomId !== draft.roomId ||
      room.roomPassword !== draft.roomPassword ||
      new Date(room.matchAt || 0).getTime() !== new Date(draft.matchAt).getTime() ||
      (room.instructions || '') !== (draft.instructions || '');
    room.roomId = draft.roomId;
    room.roomPassword = draft.roomPassword;
    room.matchAt = draft.matchAt;
    room.instructions = draft.instructions || '';
    room.assignments = assignments.map((assignment) => {
      const previous = previousAssignments.get(assignment.registration.toString());
      const changed = detailsChanged || previous?.slotNumber !== assignment.slotNumber;
      return {
        ...assignment,
        emailStatus: previous && !changed ? previous.emailStatus : 'pending',
        emailSentAt: previous && !changed ? previous.emailSentAt : undefined,
        emailAttempts: previous && !changed ? previous.emailAttempts : 0,
      };
    });
    room.status = 'published';
    room.publishedAt = now;
    room.publishedBy = req.user._id;
    await room.save();

    let emailsSent = 0;
    let emailsFailed = 0;
    let emailsSkipped = 0;
    for (const registration of eligibleRegistrations) {
      const assignment = room.assignments.find(
        (item) => item.registration.toString() === registration._id.toString()
      );
      if (!registration.user?.email) {
        assignment.emailStatus = 'failed';
        assignment.emailError = 'No email address is associated with this team leader.';
        await EventRoom.updateOne(
          { _id: room._id, 'assignments.registration': assignment.registration },
          {
            $set: {
              'assignments.$.emailStatus': 'failed',
              'assignments.$.emailError': assignment.emailError,
            },
          }
        );
        emailsFailed += 1;
        continue;
      }
      if (assignment.emailStatus === 'sent') {
        emailsSkipped += 1;
        continue;
      }
      const delivery = await deliverRoomEmail(registration, event, room, assignment);
      if (delivery === null) {
        emailsSkipped += 1;
      } else if (delivery) {
        emailsSent += 1;
      } else {
        emailsFailed += 1;
      }
    }

    res.status(200).json({
      success: true,
      message: 'Room details published to eligible teams.',
      data: {
        room,
        eligibleCount: eligibleRegistrations.length,
        emailsSent,
        emailsFailed,
        emailsSkipped,
        skippedRegistrations: registrations.length - eligibleRegistrations.length,
      },
    });
  } catch (err) {
    if (err.code === 11000) {
      return next(new AppError('Room slots must be unique for this event', 409));
    }
    forwardRoomError(err, next);
  }
};

const resendRoomEmails = async (req, res, next, failedOnly = false) => {
  try {
    const event = await getEventForRoomManagement(req.params.id);
    const room = await loadRoomForAdmin(event._id);
    if (!room || room.status !== 'published') {
      throw new AppError('Publish room details before resending emails', 400);
    }
    const registrations = await Registration.find({
      event: event._id,
      _id: { $in: room.assignments.map(({ registration }) => registration) },
    }).populate('user', 'name email');
    const registrationById = new Map(
      registrations.map((registration) => [registration._id.toString(), registration])
    );
    let emailsSent = 0;
    let emailsFailed = 0;
    let emailsSkipped = 0;
    for (const assignment of room.assignments) {
      if (failedOnly && assignment.emailStatus !== 'failed') {
        emailsSkipped += 1;
        continue;
      }
      const registration = registrationById.get(assignment.registration.toString());
      if (!registration || !isRoomEligible(registration, event) || !registration.user?.email) {
        emailsSkipped += 1;
        continue;
      }
      const delivery = await deliverRoomEmail(
        registration,
        event,
        room,
        assignment,
        { force: !failedOnly }
      );
      if (delivery === null) {
        emailsSkipped += 1;
      } else if (delivery) {
        emailsSent += 1;
      } else {
        emailsFailed += 1;
      }
    }
    res.status(200).json({
      success: true,
      data: { emailsSent, emailsFailed, emailsSkipped },
    });
  } catch (err) {
    forwardRoomError(err, next);
  }
};

const resendFailedRoomEmails = (req, res, next) =>
  resendRoomEmails(req, res, next, true);

module.exports = {
  getEventRoomManagement,
  saveEventRoomDraft,
  publishEventRoom,
  resendRoomEmails: (req, res, next) => resendRoomEmails(req, res, next, false),
  resendFailedRoomEmails,
  isRoomEligible,
};
