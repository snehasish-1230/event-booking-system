const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Event = require('./models/Event');
const EventRoom = require('./models/EventRoom');
const Registration = require('./models/Registration');
const registrationController = require('./controllers/registrationController');
const emailService = require('./utils/emailService');

const originalSendEmail = emailService.sendEmail;
let sentEmails = [];
let failEmailDelivery = false;
emailService.sendEmail = async (message) => {
  sentEmails.push(message);
  return {
    success: !failEmailDelivery,
    submitted: !failEmailDelivery,
  };
};
const {
  publishEventRoom,
  isRoomEligible,
} = require('./controllers/eventRoomController');
const { getRoomDetailsForRegistration } = registrationController;
emailService.sendEmail = originalSendEmail;

const validateDocument = (document) =>
  document.validate().then(
    () => undefined,
    (error) => error
  );

const invoke = async (handler, req) => {
  let status;
  let body;
  let nextError;
  const res = {
    status(value) {
      status = value;
      return this;
    },
    json(value) {
      body = value;
      return this;
    },
  };
  await handler(req, res, (error) => {
    nextError = error;
  });
  return nextError
    ? { status: nextError.statusCode, body: { message: nextError.message } }
    : { status, body };
};

const rosterFor = (size) =>
  Array.from({ length: size }, (_, index) => ({
    playerName: `Player ${index + 1}`,
    freeFireUid: String(100000 + index),
  }));

const testRosterValidation = async () => {
  const teamSizes = { SOLO: 1, DUO: 2, TRIO: 3, SQUAD: 4 };
  for (const [teamMode, size] of Object.entries(teamSizes)) {
    const registration = new Registration({
      user: new mongoose.Types.ObjectId(),
      event: new mongoose.Types.ObjectId(),
      teamMode,
      players: rosterFor(size),
    });
    assert.equal(await validateDocument(registration), undefined, `${teamMode} roster should validate`);
    registration.players.pop();
    assert.ok((await validateDocument(registration))?.errors?.players, `${teamMode} must reject an incomplete roster`);
  }

  const duplicateUids = new Registration({
    user: new mongoose.Types.ObjectId(),
    event: new mongoose.Types.ObjectId(),
    teamMode: 'DUO',
    players: [
      { playerName: 'Player One', freeFireUid: '123456' },
      { playerName: 'Player Two', freeFireUid: '123456' },
    ],
  });
  assert.ok((await validateDocument(duplicateUids))?.errors?.players);
};

const testRoomValidation = async () => {
  const baseRoom = {
    event: new mongoose.Types.ObjectId(),
    roomId: 'room-123',
    roomPassword: 'secret',
    matchAt: new Date(Date.now() + 86400000),
    publishedAt: new Date(),
    publishedBy: new mongoose.Types.ObjectId(),
  };
  const validRoom = new EventRoom({
    ...baseRoom,
    assignments: [
      { registration: new mongoose.Types.ObjectId(), slotNumber: 1 },
      { registration: new mongoose.Types.ObjectId(), slotNumber: 2 },
    ],
  });
  assert.equal(await validateDocument(validRoom), undefined);
  assert.equal(EventRoom.schema.path('roomPassword').options.select, false);

  const duplicateSlots = new EventRoom({
    ...baseRoom,
    assignments: [
      { registration: new mongoose.Types.ObjectId(), slotNumber: 1 },
      { registration: new mongoose.Types.ObjectId(), slotNumber: 1 },
    ],
  });
  assert.ok((await validateDocument(duplicateSlots))?.errors?.assignments);
};

const testPaymentEligibility = () => {
  const teamSizes = { SOLO: 1, DUO: 2, TRIO: 3, SQUAD: 4 };
  for (const [mode, size] of Object.entries(teamSizes)) {
    const roster = rosterFor(size);
    const eventFormat = { teamMode: mode, gameMode: mode, teamSize: size };
    const freeEvent = { ...eventFormat, pricingType: 'FREE', price: 0 };
    const paidEvent = { ...eventFormat, pricingType: 'PAID', price: 250 };
    const registration = {
      status: 'confirmed',
      teamMode: mode,
      gameMode: mode,
      teamSize: size,
      players: roster,
    };

    assert.equal(
      isRoomEligible({ ...registration, paymentStatus: 'NOT_REQUIRED' }, freeEvent),
      true,
      `${mode} free confirmed team is eligible`
    );
    assert.equal(
      isRoomEligible({ ...registration, paymentStatus: 'APPROVED' }, paidEvent),
      true,
      `${mode} paid and approved team is eligible`
    );
    assert.equal(
      isRoomEligible({ ...registration, paymentStatus: 'PENDING' }, paidEvent),
      false,
      `${mode} unpaid team is not eligible`
    );
    assert.equal(
      isRoomEligible(
        {
          ...registration,
          teamMode: mode === 'SQUAD' ? 'SOLO' : 'SQUAD',
          gameMode: mode === 'SQUAD' ? 'SOLO' : 'SQUAD',
          paymentStatus: 'NOT_REQUIRED',
        },
        freeEvent
      ),
      false,
      `${mode} must not receive credentials assigned for another mode`
    );
    assert.equal(
      isRoomEligible(
        { ...registration, players: roster.slice(1), paymentStatus: 'NOT_REQUIRED' },
        freeEvent
      ),
      false,
      `${mode} incomplete roster is not eligible`
    );
    const duplicateUidRoster = roster.map((player) => ({ ...player }));
    if (size > 1) duplicateUidRoster[size - 1].freeFireUid = duplicateUidRoster[0].freeFireUid;
    if (size > 1) {
      assert.equal(
        isRoomEligible(
          { ...registration, players: duplicateUidRoster, paymentStatus: 'NOT_REQUIRED' },
          freeEvent
        ),
        false,
        `${mode} duplicate UIDs are not eligible`
      );
    }
  }

  assert.equal(
    isRoomEligible(
      { status: 'cancelled', teamMode: 'SOLO', players: rosterFor(1), paymentStatus: 'NOT_REQUIRED' },
      { teamMode: 'SOLO', pricingType: 'FREE', price: 0 }
    ),
    false
  );
};

const testRoomPublication = async () => {
  const originalFindById = Event.findById;
  const originalFind = Registration.find;
  const originalFindOne = EventRoom.findOne;
  const originalUpdateOne = EventRoom.updateOne;
  const originalSave = EventRoom.prototype.save;
  const eventId = new mongoose.Types.ObjectId();
  const adminId = new mongoose.Types.ObjectId();
  const eligible = {
    _id: new mongoose.Types.ObjectId(),
    status: 'confirmed',
    paymentStatus: 'NOT_REQUIRED',
    teamMode: 'DUO',
    players: rosterFor(2),
    user: { name: 'Team Captain', email: 'captain@example.test' },
  };
  const unpaid = {
    _id: new mongoose.Types.ObjectId(),
    status: 'pending',
    paymentStatus: 'PENDING',
    teamMode: 'DUO',
    players: rosterFor(2),
    user: { name: 'Unpaid Captain', email: 'unpaid@example.test' },
  };
  const mismatchedMode = {
    _id: new mongoose.Types.ObjectId(),
    status: 'confirmed',
    paymentStatus: 'NOT_REQUIRED',
    teamMode: 'SQUAD',
    gameMode: 'SQUAD',
    teamSize: 4,
    players: rosterFor(4),
    user: { name: 'Other Mode Captain', email: 'other-mode@example.test' },
  };
  let savedRoom;
  let roomSaveCount = 0;
  const draftRoom = new EventRoom({
    event: eventId,
    status: 'draft',
    draft: {
      roomId: 'room-123',
      roomPassword: 'pass-123',
      matchAt: new Date(Date.now() + 86400000),
      assignments: [{ registration: eligible._id, slotNumber: 7 }],
    },
  });
  sentEmails = [];
  failEmailDelivery = false;

  Event.findById = async () => ({
    _id: eventId,
    title: 'Room Test Event',
    teamMode: 'DUO',
    pricingType: 'FREE',
    price: 0,
  });
  Registration.find = () => ({
    populate: async () => [eligible, unpaid, mismatchedMode],
  });
  EventRoom.findOne = () => ({ select: async () => draftRoom });
  EventRoom.prototype.save = async function save() {
    roomSaveCount += 1;
    savedRoom = this;
    return this;
  };
  EventRoom.updateOne = async (filter, update) => {
    const assignmentQuery = filter.assignments?.$elemMatch;
    const assignment = draftRoom.assignments.find(
      (item) => item.registration.toString() === assignmentQuery.registration.toString()
    );
    if (
      !assignment ||
      (assignmentQuery.emailStatus?.$nin &&
        assignmentQuery.emailStatus.$nin.includes(assignment.emailStatus)) ||
      (assignmentQuery.emailStatus &&
        !assignmentQuery.emailStatus.$nin &&
        assignment.emailStatus !== assignmentQuery.emailStatus)
    ) {
      return { matchedCount: 0 };
    }
    if (update.$inc) {
      assignment.emailAttempts += update.$inc['assignments.$.emailAttempts'];
    }
    for (const [path, value] of Object.entries(update.$set || {})) {
      const field = path.split('.').at(-1);
      assignment[field] = value;
    }
    for (const path of Object.keys(update.$unset || {})) {
      assignment[path.split('.').at(-1)] = undefined;
    }
    return { matchedCount: 1 };
  };

  const req = {
    params: { id: eventId.toString() },
    user: { _id: adminId },
    body: {
      roomId: 'room-123',
      roomPassword: 'pass-123',
      matchAt: new Date(Date.now() + 86400000).toISOString(),
      assignments: [{ registrationId: eligible._id.toString(), slotNumber: 7 }],
    },
  };
  try {
    const result = await invoke(publishEventRoom, req);
    assert.equal(result.status, 200);
    assert.equal(result.body.data.eligibleCount, 1);
    assert.equal(result.body.data.skippedRegistrations, 2);
    assert.equal(result.body.data.emailsSent, 1);
    assert.equal(result.body.data.emailsSubmitted, 1);
    assert.equal(result.body.data.emailsFailed, 0);
    assert.equal(roomSaveCount, 1);
    assert.equal(savedRoom.assignments.length, 1);
    assert.equal(savedRoom.assignments[0].slotNumber, 7);
    assert.equal(sentEmails.length, 1);
    assert.equal(sentEmails[0].to, eligible.user.email);
    assert.match(sentEmails[0].html, /room-123/);
    assert.match(sentEmails[0].html, /DUO, 2 players/);
    assert.match(sentEmails[0].html, /Player 2 — UID 100001/);
    assert.equal(savedRoom.assignments[0].emailStatus, 'sent');

    const repeatedPublish = await invoke(publishEventRoom, req);
    assert.equal(repeatedPublish.body.data.emailsSent, 0);
    assert.equal(repeatedPublish.body.data.emailsSubmitted, 0);
    assert.equal(repeatedPublish.body.data.emailsSkipped, 1);
    assert.equal(sentEmails.length, 1, 'Publishing unchanged room details must not resend successful emails');

    draftRoom.draft.roomId = 'room-456';
    draftRoom.draft.roomPassword = 'updated-pass';
    failEmailDelivery = true;
    const failedDelivery = await invoke(publishEventRoom, req);
    assert.equal(failedDelivery.body.data.emailsFailed, 1);
    assert.equal(savedRoom.assignments[0].emailStatus, 'failed');

    failEmailDelivery = false;
    const retriedDelivery = await invoke(publishEventRoom, req);
    assert.equal(retriedDelivery.body.data.emailsSent, 1);
    assert.equal(retriedDelivery.body.data.emailsSubmitted, 1);
    assert.equal(savedRoom.assignments[0].emailStatus, 'sent');
    assert.equal(savedRoom.assignments[0].emailAttempts, 2);

    req.body.assignments = [
      { registrationId: eligible._id.toString(), slotNumber: 7 },
      { registrationId: unpaid._id.toString(), slotNumber: 8 },
      { registrationId: mismatchedMode._id.toString(), slotNumber: 9 },
    ];
    const invalidAssignment = await invoke(publishEventRoom, req);
    assert.equal(invalidAssignment.status, 400);
    assert.equal(sentEmails.length, 3, 'Invalid assignments must not send room details');
  } finally {
    Event.findById = originalFindById;
    Registration.find = originalFind;
    EventRoom.findOne = originalFindOne;
    EventRoom.updateOne = originalUpdateOne;
    EventRoom.prototype.save = originalSave;
  }
};

const testRoomDraftSave = async () => {
  const originalFindById = Event.findById;
  const originalFindOne = EventRoom.findOne;
  const originalRegistrationFind = Registration.find;
  const originalSave = EventRoom.prototype.save;
  const eventId = new mongoose.Types.ObjectId();
  const teamLeader = new mongoose.Types.ObjectId();
  const eligible = {
    _id: new mongoose.Types.ObjectId(),
    status: 'confirmed',
    paymentStatus: 'NOT_REQUIRED',
    teamMode: 'SOLO',
    gameMode: 'SOLO',
    teamSize: 1,
    players: rosterFor(1),
    user: { name: 'Captain', email: 'captain@example.test' },
  };
  Event.findById = async () => ({
    _id: eventId,
    title: 'Draft Event',
    teamMode: 'SOLO',
    gameMode: 'SOLO',
    teamSize: 1,
    price: 0,
    pricingType: 'FREE',
  });
  Registration.find = () => ({ populate: async () => [eligible] });
  EventRoom.findOne = () => ({ select: async () => null });
  EventRoom.prototype.save = async function save() { return this; };

  try {
    const { saveEventRoomDraft } = require('./controllers/eventRoomController');
    const result = await invoke(saveEventRoomDraft, {
      params: { id: eventId.toString() },
      user: { _id: teamLeader },
      body: {
        roomId: 'draft-room',
        roomPassword: 'draft-password',
        matchAt: new Date(Date.now() + 86400000).toISOString(),
        instructions: 'Join ten minutes early.',
        assignments: [{ registrationId: eligible._id.toString(), slotNumber: 1 }],
      },
    });
    assert.equal(result.status, 200);
    assert.equal(result.body.data.room.status, 'draft');
    assert.equal(result.body.data.room.draft.roomId, 'draft-room');
    assert.equal(result.body.data.room.roomId, undefined);
  } finally {
    Event.findById = originalFindById;
    EventRoom.findOne = originalFindOne;
    Registration.find = originalRegistrationFind;
    EventRoom.prototype.save = originalSave;
  }
};

const testFailedRoomEmailRetry = async () => {
  const eventId = new mongoose.Types.ObjectId();
  const adminId = new mongoose.Types.ObjectId();
  const registration = {
    _id: new mongoose.Types.ObjectId(),
    status: 'confirmed',
    paymentStatus: 'NOT_REQUIRED',
    teamMode: 'SOLO',
    players: rosterFor(1),
    user: { name: 'Team Captain', email: 'captain@example.test' },
  };
  const room = new EventRoom({
    event: eventId,
    roomId: 'retry-room',
    roomPassword: 'retry-pass',
    matchAt: new Date(Date.now() + 86400000),
    assignments: [{
      registration: registration._id,
      slotNumber: 1,
      emailStatus: 'failed',
    }],
    status: 'published',
    publishedAt: new Date(),
    publishedBy: adminId,
  });
  const originals = {
    findById: Event.findById,
    registrationFind: Registration.find,
    roomFindOne: EventRoom.findOne,
    roomUpdateOne: EventRoom.updateOne,
    save: EventRoom.prototype.save,
  };
  sentEmails = [];
  failEmailDelivery = false;
  Event.findById = async () => ({
    _id: eventId,
    title: 'Retry Event',
    teamMode: 'SOLO',
    gameMode: 'SOLO',
    teamSize: 1,
    pricingType: 'FREE',
    price: 0,
  });
  Registration.find = () => ({
    populate: async () => [registration],
  });
  EventRoom.findOne = () => ({ select: async () => room });
  EventRoom.prototype.save = async function save() { return this; };
  EventRoom.updateOne = async (filter, update) => {
    const assignmentQuery = filter.assignments.$elemMatch;
    const assignment = room.assignments.find(
      (item) => item.registration.toString() === assignmentQuery.registration.toString()
    );
    const statusCondition = assignmentQuery.emailStatus;
    const statusIsInvalid = statusCondition?.$nin
      ? statusCondition.$nin.includes(assignment?.emailStatus)
      : statusCondition?.$ne
        ? assignment?.emailStatus === statusCondition.$ne
        : statusCondition && assignment?.emailStatus !== statusCondition;
    if (!assignment || statusIsInvalid) {
      return { matchedCount: 0 };
    }
    if (update.$inc) assignment.emailAttempts += update.$inc['assignments.$.emailAttempts'];
    for (const [path, value] of Object.entries(update.$set || {})) {
      assignment[path.split('.').at(-1)] = value;
    }
    for (const path of Object.keys(update.$unset || {})) {
      assignment[path.split('.').at(-1)] = undefined;
    }
    return { matchedCount: 1 };
  };

  try {
    const result = await invoke(require('./controllers/eventRoomController').resendFailedRoomEmails, {
      params: { id: eventId.toString() },
      user: { _id: adminId },
    });
    assert.equal(result.status, 200);
    assert.equal(result.body.data.emailsSent, 1);
    assert.equal(result.body.data.emailsSubmitted, 1);
    assert.equal(room.assignments[0].emailStatus, 'sent');
    assert.equal(room.assignments[0].emailAttempts, 1);
  } finally {
    Event.findById = originals.findById;
    Registration.find = originals.registrationFind;
    EventRoom.findOne = originals.roomFindOne;
    EventRoom.updateOne = originals.roomUpdateOne;
    EventRoom.prototype.save = originals.save;
    failEmailDelivery = false;
  }
};

const testRoomCredentialsAreOwnerScoped = async () => {
  const originalFind = Registration.find;
  const originalCountDocuments = Registration.countDocuments;
  const originalRoomFindOne = EventRoom.findOne;
  const ownerId = new mongoose.Types.ObjectId();
  const confirmed = {
    _id: new mongoose.Types.ObjectId(),
    event: {
      _id: new mongoose.Types.ObjectId(),
      title: 'Free Room Event',
      pricingType: 'FREE',
      price: 0,
      teamMode: 'DUO',
      gameMode: 'DUO',
      teamSize: 2,
    },
    status: 'confirmed',
    paymentStatus: 'NOT_REQUIRED',
    teamMode: 'DUO',
    gameMode: 'DUO',
    teamSize: 2,
    players: rosterFor(2),
    toObject() {
      return { _id: this._id, event: this.event, status: this.status };
    },
  };
  const pending = {
    _id: new mongoose.Types.ObjectId(),
    event: confirmed.event,
    status: 'pending',
    paymentStatus: 'PENDING',
    teamMode: 'DUO',
    gameMode: 'DUO',
    teamSize: 2,
    players: rosterFor(2),
    toObject() {
      return { _id: this._id, event: this.event, status: this.status };
    },
  };
  const privateRoom = {
    roomId: 'private-room',
    roomPassword: 'private-password',
    matchAt: new Date(Date.now() + 86400000),
    assignments: [{ registration: confirmed._id, slotNumber: 4 }],
    status: 'published',
  };
  Registration.find = () => ({
    sort() { return this; },
    skip() { return this; },
    limit() { return this; },
    populate: async () => [confirmed, pending],
  });
  Registration.countDocuments = async () => 2;
  EventRoom.findOne = () => ({
    select: async () => privateRoom,
  });

  try {
    const response = await invoke(registrationController.getMyRegistrations, {
      user: { _id: ownerId },
      query: {},
    });
    const [confirmedTicket, pendingTicket] = response.body.data.registrations;
    assert.equal(confirmedTicket.room.roomId, 'private-room');
    assert.equal(confirmedTicket.room.roomPassword, 'private-password');
    assert.equal(confirmedTicket.room.slotNumber, 4);
    assert.equal(pendingTicket.room, null);

    for (const [mode, size] of Object.entries({
      SOLO: 1,
      DUO: 2,
      TRIO: 3,
      SQUAD: 4,
    })) {
      confirmed.event.teamMode = mode;
      confirmed.event.gameMode = mode;
      confirmed.event.teamSize = size;
      confirmed.teamMode = mode;
      confirmed.gameMode = mode;
      confirmed.teamSize = size;
      confirmed.players = rosterFor(size);
      assert.equal(
        (await getRoomDetailsForRegistration(confirmed))?.roomPassword,
        'private-password',
        `${mode} ticket owner should receive assigned room credentials`
      );
    }

    confirmed.event.pricingType = 'PAID';
    confirmed.event.price = 1;
    confirmed.paymentStatus = 'APPROVED';
    assert.equal(
      (await getRoomDetailsForRegistration(confirmed))?.roomPassword,
      'private-password',
      'Paid confirmed tickets receive credentials only after approval'
    );
    confirmed.paymentStatus = 'PENDING';
    assert.equal(await getRoomDetailsForRegistration(confirmed), null);
    confirmed.event.pricingType = 'FREE';
    confirmed.event.price = 0;
    confirmed.paymentStatus = 'NOT_REQUIRED';

    confirmed.event.teamMode = 'DUO';
    confirmed.event.gameMode = 'DUO';
    confirmed.event.teamSize = 2;
    confirmed.teamMode = 'SQUAD';
    confirmed.gameMode = 'SQUAD';
    confirmed.teamSize = 4;
    confirmed.players = rosterFor(4);
    assert.equal(
      await getRoomDetailsForRegistration(confirmed),
      null,
      'A registration with a team mode different from its event must not receive credentials'
    );
    confirmed.teamMode = 'DUO';
    confirmed.gameMode = 'DUO';
    confirmed.teamSize = 2;
    confirmed.players = rosterFor(2);
    confirmed.paymentStatus = 'APPROVED';
    assert.equal(
      await getRoomDetailsForRegistration(confirmed),
      null,
      'Free registrations require NOT_REQUIRED payment status'
    );
  } finally {
    Registration.find = originalFind;
    Registration.countDocuments = originalCountDocuments;
    EventRoom.findOne = originalRoomFindOne;
  }
};

const run = async () => {
  await testRosterValidation();
  await testRoomValidation();
  testPaymentEligibility();
  await testRoomPublication();
  await testRoomDraftSave();
  await testFailedRoomEmailRetry();
  await testRoomCredentialsAreOwnerScoped();
  console.log('Free Fire team roster, room slot, payment eligibility, and publication checks passed.');
};

run().catch((error) => {
  console.error('Event room management checks failed:', error);
  process.exitCode = 1;
});
