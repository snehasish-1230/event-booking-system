const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Event = require('./models/Event');
const Registration = require('./models/Registration');
const Payment = require('./models/Payment');
const EventRoom = require('./models/EventRoom');
const eventController = require('./controllers/eventController');
const {
  createEventRules,
  updateEventRules,
} = require('./validators/eventValidator');
const { validationResult } = require('express-validator');
const emailService = require('./utils/emailService');
const originalSendEmail = emailService.sendEmail;
emailService.sendEmail = async () => {};
const registrationController = require('./controllers/registrationController');
emailService.sendEmail = originalSendEmail;
const { validateTeamRegistration } = registrationController;
const { isPaidEvent } = require('./utils/eventPricing');

const validateDocument = (document) =>
  document.validate().then(
    () => undefined,
    (error) => error
  );

const userId = new mongoose.Types.ObjectId();
const eventData = {
  title: 'Capacity Validation Event',
  description: 'A complete event used to verify event management.',
  category: 'conference',
  date: new Date(Date.now() + 86400000).toISOString(),
  location: { venue: 'Test Venue', city: 'Test City' },
  minParticipants: 2,
  capacity: 10,
  teamMode: 'DUO',
  gameMode: 'DUO',
  teamSize: 2,
  pricingType: 'PAID',
  price: 250,
  tags: ['original'],
  image: '/uploads/original.png',
};

const testCurrencyValidatorContexts = () => {
  const currencyValidator = Event.schema
    .path('currency')
    .validators.find(({ message }) => message === 'New or updated events must use INR')
    .validator;

  assert.equal(currencyValidator.call({ isNew: true }, 'INR'), true);
  assert.equal(currencyValidator.call({ isNew: true }, 'USD'), false);
  assert.equal(
    currencyValidator.call({ isNew: false, isModified: () => false }, 'USD'),
    true
  );
  assert.equal(
    currencyValidator.call({ isNew: false, isModified: () => true }, 'USD'),
    false
  );
  assert.equal(
    currencyValidator.call(
      { getUpdate: () => ({ $set: { title: 'Updated' } }) },
      'USD'
    ),
    true
  );
  assert.equal(
    currencyValidator.call({ getUpdate: () => ({ $set: { currency: 'USD' } }) }, 'USD'),
    false
  );
  assert.equal(
    currencyValidator.call({ getUpdate: () => ({ $set: { currency: 'INR' } }) }, 'INR'),
    true
  );
};

const testRegistrationRosterValidation = async () => {
  const teamSizes = { SOLO: 1, DUO: 2, TRIO: 3, SQUAD: 4 };
  const playersValidator = Registration.schema
    .path('players')
    .validators.find((validator) => validator.type === 'user defined').validator;
  const createRegistration = (teamMode, players, extra = {}) =>
    new Registration({
      user: userId,
      event: new mongoose.Types.ObjectId(),
      teamMode,
      gameMode: teamMode,
      teamSize: teamSizes[teamMode],
      players,
      ...extra,
    });
  for (const [mode, size] of Object.entries(teamSizes)) {
    const players = Array.from({ length: size }, (_, index) => ({
      playerName: `${mode} Player ${index + 1}`,
      freeFireUid: String(400000 + index),
    }));
    const eventFormat = { teamMode: mode, gameMode: mode, teamSize: size };
    const validRegistration = validateTeamRegistration(eventFormat, {
      teamMode: mode,
      gameMode: mode,
      teamSize: size,
      players,
    });

    assert.equal(validRegistration.players.length, size, `${mode} API roster size`);
    assert.equal(validRegistration.players[0].playerName, `${mode} Player 1`);
    assert.equal(await validateDocument(createRegistration(mode, players)), undefined, `${mode} model validation`);
    assert.equal(
      playersValidator.call(
        {
          getUpdate: () => ({
            $set: { teamMode: mode, gameMode: mode, teamSize: size, players },
          }),
        },
        players
      ),
      true,
      `${mode} update validation`
    );
    assert.throws(
      () => validateTeamRegistration(eventFormat, {
        teamMode: mode,
        players: players.slice(1),
      }),
      /requires exactly/
    );
    assert.ok(
      (await validateDocument(createRegistration(mode, players.slice(1))))?.errors?.players,
      `${mode} model rejects a short roster`
    );

    const duplicateUidRoster = players.map((player) => ({ ...player }));
    if (size > 1) duplicateUidRoster[size - 1].freeFireUid = duplicateUidRoster[0].freeFireUid;
    if (size > 1) {
      assert.throws(
        () => validateTeamRegistration(eventFormat, { players: duplicateUidRoster }),
        /unique Free Fire UID/
      );
      assert.ok((await validateDocument(createRegistration(mode, duplicateUidRoster)))?.errors?.players);
    }

    const missingUidRoster = players.map((player) => ({ ...player }));
    missingUidRoster[0].freeFireUid = '';
    assert.throws(
      () => validateTeamRegistration(eventFormat, { players: missingUidRoster }),
      /valid player name and numeric Free Fire UID/
    );
    const missingNameRoster = players.map((player) => ({ ...player }));
    missingNameRoster[0].playerName = ' ';
    assert.throws(
      () => validateTeamRegistration(eventFormat, { players: missingNameRoster }),
      /valid player name and numeric Free Fire UID/
    );
    assert.ok((await validateDocument(createRegistration(mode, missingUidRoster)))?.errors?.players);

    const paidEvent = { ...eventFormat, pricingType: 'PAID', price: 1 };
    const freeEvent = { ...eventFormat, pricingType: 'FREE', price: 0 };
    assert.equal(isPaidEvent(paidEvent), true, `${mode} paid registration`);
    assert.equal(isPaidEvent(freeEvent), false, `${mode} free registration`);
  }

  const soloPlayers = [{ playerName: 'Solo Player', freeFireUid: '123456789' }];
  assert.equal(
    await validateDocument(createRegistration(undefined, soloPlayers, {
      gameMode: 'SOLO',
      teamSize: 1,
    })),
    undefined
  );
  assert.equal(
    await validateDocument(createRegistration(undefined, soloPlayers, { teamSize: 1 })),
    undefined
  );
  assert.equal(
    validateTeamRegistration(
      { teamMode: 'solo', gameMode: 'solo', teamSize: 1 },
      { teamMode: 'solo', players: soloPlayers }
    ).teamMode,
    'SOLO'
  );
  assert.throws(
    () => validateTeamRegistration(
      { teamMode: 'DUO', gameMode: 'DUO', teamSize: 2 },
      { teamMode: 'SOLO', players: soloPlayers }
    ),
    /Team format does not match/
  );
  assert.ok(
    (await validateDocument(createRegistration('SQUAD', [
      { playerName: '', freeFireUid: '1234' },
      ...Array.from({ length: 3 }, (_, index) => ({
        playerName: `Player ${index + 2}`,
        freeFireUid: String(500000 + index),
      })),
    ])))?.errors?.['players.0.playerName']
  );
};

const validateCreatePayload = async (body) => {
  const req = { body, method: 'POST' };
  await Promise.all(createEventRules.map((rule) => rule.run(req)));
  return validationResult(req).array();
};

const testEditingPastEvents = async () => {
  const req = {
    body: { date: new Date(Date.now() - 86400000).toISOString() },
    method: 'PUT',
  };
  await Promise.all(updateEventRules.map((rule) => rule.run(req)));
  assert.deepEqual(validationResult(req).array(), []);
};

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

const testMinimumMembers = async () => {
  assert.deepEqual(await validateCreatePayload(eventData), []);
  const dateOnlyToday = new Date();
  const todayDate = `${dateOnlyToday.getFullYear()}-${String(dateOnlyToday.getMonth() + 1).padStart(2, '0')}-${String(dateOnlyToday.getDate()).padStart(2, '0')}`;
  const todayErrors = await validateCreatePayload({ ...eventData, date: todayDate });
  assert.ok(
    todayErrors.some((error) => error.path === 'date'),
    'A date-only event scheduled for today must report the date field because its parsed time is already past'
  );
  const tagsRequest = {
    body: { ...eventData, tags: 'free, gaming, free' },
    method: 'POST',
  };
  await Promise.all(createEventRules.map((rule) => rule.run(tagsRequest)));
  assert.deepEqual(tagsRequest.body.tags, ['free', 'gaming']);
  assert.deepEqual(validationResult(tagsRequest).array(), []);
  assert.deepEqual(
    await validateCreatePayload({ ...eventData, pricingType: 'FREE', price: 0 }),
    []
  );
  assert.ok(
    (await validateCreatePayload({ ...eventData, pricingType: 'FREE', price: 250 }))
      .some((error) => error.path === 'pricingType'),
    'FREE events must not accept a positive price'
  );
  assert.ok(
    (await validateCreatePayload({ ...eventData, pricingType: 'PAID', price: 0 }))
      .some((error) => error.path === 'pricingType'),
    'PAID events must require a positive price'
  );
  const tooSmallCapacity = await validateCreatePayload({
    ...eventData,
    capacity: 1,
  });
  assert.ok(
    tooSmallCapacity.some((error) => error.path === 'capacity'),
    'Minimum members must not exceed capacity'
  );

  const event = new Event({
    ...eventData,
    organizer: userId,
    date: new Date(eventData.date),
    teamMode: 'DUO',
    gameMode: 'DUO',
    teamSize: 2,
  });
  assert.equal(event.minParticipants, 2);
  assert.equal(event.pricingType, 'PAID');
  assert.equal(await validateDocument(event), undefined);
  const mismatchedTeamFormat = new Event({
    ...eventData,
    organizer: userId,
    date: new Date(eventData.date),
    teamMode: 'DUO',
    gameMode: 'DUO',
    teamSize: 4,
  });
  assert.ok((await validateDocument(mismatchedTeamFormat))?.errors?.teamSize);
  event.capacity = 1;
  assert.ok((await validateDocument(event))?.errors?.minParticipants);

  const minimumValidator = Event.schema
    .path('minParticipants')
    .validators.find((validator) => validator.type === 'user defined').validator;
  assert.equal(minimumValidator.call({ get: () => 2 }, 2), true);
  assert.equal(minimumValidator.call({ get: () => 1 }, 2), false);

  const freeEvent = new Event({
    ...eventData,
    organizer: userId,
    date: new Date(eventData.date),
    pricingType: 'FREE',
    price: 0,
  });
  assert.equal(await validateDocument(freeEvent), undefined);
  freeEvent.price = 250;
  assert.ok((await validateDocument(freeEvent))?.errors?.pricingType);
  freeEvent.price = 0;
  freeEvent.pricingType = 'PAID';
  assert.ok((await validateDocument(freeEvent))?.errors?.pricingType);

  const legacyPaidEvent = Event.hydrate({
    _id: new mongoose.Types.ObjectId(),
    title: 'Legacy paid event',
    description: 'Existing events infer pricing from their stored price.',
    date: new Date(Date.now() + 86400000),
    capacity: 10,
    price: 250,
    organizer: userId,
    location: { venue: 'Legacy Venue', city: 'Legacy City' },
    category: 'conference',
    status: 'published',
  });
  assert.equal(legacyPaidEvent.pricingType, 'PAID');
  assert.equal(await validateDocument(legacyPaidEvent), undefined);
};

const testCapacityCounting = async () => {
  const originalCountDocuments = Registration.countDocuments;
  let filter;
  Registration.countDocuments = async (value) => {
    filter = value;
    return 3;
  };
  try {
    assert.equal(
      await Registration.getCapacityConsumingCount('event-id'),
      3
    );
    assert.deepEqual(filter, {
      event: 'event-id',
      status: { $in: ['pending', 'confirmed', 'attended'] },
    });
  } finally {
    Registration.countDocuments = originalCountDocuments;
  }
};

const testCapacityUpdatesAndPublishing = async () => {
  const originalFindById = Event.findById;
  const originalFindOneAndUpdate = Event.findOneAndUpdate;
  const originalCreate = Event.create;
  const originalCount = Registration.getCapacityConsumingCount;
  const originalRegistrationExists = Registration.exists;
  const originalRegistrationDistinct = Registration.distinct;
  const originalPaymentExists = Payment.exists;
  const savedEvents = new Map();
  let activeCount = 2;
  let historicalRegistrationCount = 0;
  let paymentHistory = false;
  let failNextCapacityUpdate = false;

  Event.create = async (fields) => {
    const event = {
      ...fields,
      _id: new mongoose.Types.ObjectId(),
      save: async function save() {
        savedEvents.set(this._id.toString(), this);
        return this;
      },
    };
    savedEvents.set(event._id.toString(), event);
    return event;
  };
  Event.findById = async (id) => savedEvents.get(id.toString()) || null;
  Event.findOneAndUpdate = async (filter, fields) => {
    if (failNextCapacityUpdate) {
      failNextCapacityUpdate = false;
      return null;
    }

    const event = savedEvents.get(filter._id.toString());
    if (!event || event.status === 'cancelled') return null;
    if (
      filter.registeredCount !== undefined &&
      event.registeredCount !== filter.registeredCount
    ) {
      return null;
    }
    if (
      filter.$or &&
      !filter.$or.some(
        (condition) =>
          (condition.registeredCount === 0 &&
            (event.registeredCount ?? 0) === 0) ||
          (condition.registeredCount?.$exists === false &&
            event.registeredCount === undefined)
      )
    ) {
      return null;
    }
    Object.assign(event, fields);
    return event;
  };
  Registration.getCapacityConsumingCount = async () => activeCount;
  Registration.exists = async () => activeCount > 0;
  Registration.distinct = async () =>
    Array.from({ length: historicalRegistrationCount }, () => new mongoose.Types.ObjectId());
  Payment.exists = async () => paymentHistory;

  try {
    const createResult = await invoke(eventController.createEvent, {
      body: eventData,
      user: { _id: userId, role: 'admin' },
    });
    assert.equal(createResult.status, 201);
    const createdEvent = createResult.body.data.event;
    assert.equal(createdEvent.minParticipants, 2);
    assert.equal(createdEvent.pricingType, 'PAID');
    assert.equal(createdEvent.status, 'draft');
    assert.equal(createdEvent.price, 250);
    assert.equal(createdEvent.image, '/uploads/original.png');
    assert.equal(createdEvent.teamSize, 2);
    assert.equal(createdEvent.gameMode, 'DUO');

    const freeCreateResult = await invoke(eventController.createEvent, {
      body: {
        ...eventData,
        title: 'Free Pricing Workflow Event',
        pricingType: 'FREE',
        price: 0,
        minParticipants: 1,
        capacity: 1,
        image: '/uploads/free-event.png',
        tags: ['free', 'community'],
      },
      user: { _id: userId, role: 'admin' },
    });
    assert.equal(freeCreateResult.status, 201);
    const freeEvent = freeCreateResult.body.data.event;
    assert.equal(freeEvent.pricingType, 'FREE');
    assert.equal(freeEvent.price, 0);
    assert.equal(freeEvent.minParticipants, 1);
    assert.equal(freeEvent.capacity, 1);
    assert.equal(freeEvent.image, '/uploads/free-event.png');
    const freeEventEdit = await invoke(eventController.updateEvent, {
      params: { id: freeEvent._id.toString() },
      body: { title: 'Updated Free Pricing Workflow Event' },
      user: { _id: userId, role: 'admin' },
    });
    assert.equal(freeEventEdit.status, 200);
    assert.equal(freeEvent.price, 0);
    assert.equal(freeEvent.pricingType, 'FREE');
    const freePublishResult = await invoke(eventController.publishEvent, {
      params: { id: freeEvent._id.toString() },
      user: { _id: userId, role: 'admin' },
    });
    assert.equal(freePublishResult.status, 200);
    assert.equal(freeEvent.status, 'published');

    const oneRupeeCreateResult = await invoke(eventController.createEvent, {
      body: {
        ...eventData,
        title: 'One Rupee Paid Event',
        pricingType: 'PAID',
        price: 1,
        minParticipants: 1,
        capacity: 1,
        image: '/uploads/paid-event.png',
      },
      user: { _id: userId, role: 'admin' },
    });
    assert.equal(oneRupeeCreateResult.status, 201);
    const oneRupeeEvent = oneRupeeCreateResult.body.data.event;
    assert.equal(oneRupeeEvent.price, 1);
    assert.equal(oneRupeeEvent.pricingType, 'PAID');
    assert.equal(oneRupeeEvent.minParticipants, 1);
    assert.equal(oneRupeeEvent.capacity, 1);
    assert.equal(oneRupeeEvent.image, '/uploads/paid-event.png');
    const oneRupeePublish = await invoke(eventController.publishEvent, {
      params: { id: oneRupeeEvent._id.toString() },
      user: { _id: userId, role: 'admin' },
    });
    assert.equal(oneRupeePublish.status, 200);
    assert.equal(oneRupeeEvent.pricingType, 'PAID');
    assert.equal(oneRupeeEvent.price, 1);
    activeCount = 0;
    const unchangedPaidPrice = await invoke(eventController.updateEvent, {
      params: { id: oneRupeeEvent._id.toString() },
      body: { pricingType: 'PAID', price: 1 },
      user: { _id: userId, role: 'admin' },
    });
    assert.equal(unchangedPaidPrice.status, 200);
    assert.equal(oneRupeeEvent.pricingType, 'PAID');
    assert.equal(oneRupeeEvent.price, 1);
    const changedPaidPrice = await invoke(eventController.updateEvent, {
      params: { id: oneRupeeEvent._id.toString() },
      body: { pricingType: 'PAID', price: 10 },
      user: { _id: userId, role: 'admin' },
    });
    assert.equal(changedPaidPrice.status, 200);
    assert.equal(oneRupeeEvent.pricingType, 'PAID');
    assert.equal(oneRupeeEvent.price, 10);
    assert.equal(oneRupeeEvent.currency, 'INR');
    activeCount = 2;

    const publishResult = await invoke(eventController.publishEvent, {
      params: { id: createdEvent._id.toString() },
      user: { _id: userId, role: 'admin' },
    });
    assert.equal(publishResult.status, 200);
    assert.equal(createdEvent.status, 'published');

    createdEvent.registeredCount = 50;
    const updateResult = await invoke(eventController.updateEvent, {
      params: { id: createdEvent._id.toString() },
      body: {
        title: 'Updated Event Title',
        description: 'Updated description for this event.',
        tags: ['updated'],
        pricingType: 'PAID',
        price: 250,
        image: '/uploads/replacement.png',
        capacity: 10,
      },
      user: { _id: userId, role: 'admin' },
    });
    assert.equal(updateResult.status, 200);
    assert.equal(createdEvent.title, 'Updated Event Title');
    assert.equal(createdEvent.price, 250);
    assert.deepEqual(createdEvent.tags, ['updated']);
    assert.equal(createdEvent.image, '/uploads/replacement.png');

    const activePricingChange = await invoke(eventController.updateEvent, {
      params: { id: createdEvent._id.toString() },
      body: { pricingType: 'FREE', price: 0 },
      user: { _id: userId, role: 'admin' },
    });
    assert.equal(activePricingChange.status, 409);

    activeCount = 0;
    historicalRegistrationCount = 1;
    paymentHistory = true;
    const paidAmountHistoryChange = await invoke(eventController.updateEvent, {
      params: { id: createdEvent._id.toString() },
      body: { pricingType: 'PAID', price: 300 },
      user: { _id: userId, role: 'admin' },
    });
    assert.equal(paidAmountHistoryChange.status, 409);

    const paymentHistoryPricingChange = await invoke(eventController.updateEvent, {
      params: { id: createdEvent._id.toString() },
      body: { pricingType: 'FREE', price: 0 },
      user: { _id: userId, role: 'admin' },
    });
    assert.equal(paymentHistoryPricingChange.status, 409);

    historicalRegistrationCount = 0;
    paymentHistory = false;
    const freePricingChange = await invoke(eventController.updateEvent, {
      params: { id: createdEvent._id.toString() },
      body: { pricingType: 'FREE', price: 0 },
      user: { _id: userId, role: 'admin' },
    });
    assert.equal(freePricingChange.status, 200);
    assert.equal(createdEvent.pricingType, 'FREE');
    assert.equal(createdEvent.price, 0);

    const invalidPaidPrice = await invoke(eventController.updateEvent, {
      params: { id: createdEvent._id.toString() },
      body: { pricingType: 'PAID', price: 0 },
      user: { _id: userId, role: 'admin' },
    });
    assert.equal(invalidPaidPrice.status, 400);

    const capacityIncrease = await invoke(eventController.updateEvent, {
      params: { id: createdEvent._id.toString() },
      body: { capacity: 20 },
      user: { _id: userId, role: 'admin' },
    });
    assert.equal(capacityIncrease.status, 200);

    failNextCapacityUpdate = true;
    const concurrentCapacityUpdate = await invoke(eventController.updateEvent, {
      params: { id: createdEvent._id.toString() },
      body: { capacity: 25 },
      user: { _id: userId, role: 'admin' },
    });
    assert.equal(concurrentCapacityUpdate.status, 409);
    assert.equal(createdEvent.capacity, 20);

    const validReduction = await invoke(eventController.updateEvent, {
      params: { id: createdEvent._id.toString() },
      body: { capacity: 2, minParticipants: 1 },
      user: { _id: userId, role: 'admin' },
    });
    assert.equal(validReduction.status, 200);

    activeCount = 3;
    const unchangedCapacityWithExistingOverage = await invoke(
      eventController.updateEvent,
      {
        params: { id: createdEvent._id.toString() },
        body: { title: 'Update Existing Event', capacity: 2 },
        user: { _id: userId, role: 'admin' },
      }
    );
    assert.equal(unchangedCapacityWithExistingOverage.status, 200);

    const invalidReduction = await invoke(eventController.updateEvent, {
      params: { id: createdEvent._id.toString() },
      body: { capacity: 1 },
      user: { _id: userId, role: 'admin' },
    });
    assert.equal(invalidReduction.status, 400);
    assert.match(invalidReduction.body.message, /3 active registrations/);

    activeCount = 0;
    const imagePreserved = await invoke(eventController.updateEvent, {
      params: { id: createdEvent._id.toString() },
      body: { title: 'Image Preserved Event' },
      user: { _id: userId, role: 'admin' },
    });
    assert.equal(imagePreserved.status, 200);
    assert.equal(createdEvent.image, '/uploads/replacement.png');
  } finally {
    Event.findById = originalFindById;
    Event.findOneAndUpdate = originalFindOneAndUpdate;
    Event.create = originalCreate;
    Registration.getCapacityConsumingCount = originalCount;
    Registration.exists = originalRegistrationExists;
    Registration.distinct = originalRegistrationDistinct;
    Payment.exists = originalPaymentExists;
  }
};

const testRegistrationPricingBehavior = async () => {
  const originalFindById = Event.findById;
  const originalFindOneAndUpdate = Event.findOneAndUpdate;
  const originalRegistrationFindOne = Registration.findOne;
  const originalRegistrationCreate = Registration.create;
  const originalPaymentFindOne = Payment.findOne;
  const originalRoomExists = EventRoom.exists;
  let capacityUpdateCount = 0;
  const event = {
    _id: new mongoose.Types.ObjectId(),
    title: 'Pricing Registration Test',
    slug: 'pricing-registration-test',
    date: new Date(Date.now() + 86400000),
    status: 'published',
    capacity: 10,
    registeredCount: 0,
    location: { venue: 'Test Venue', city: 'Test City' },
    price: 0,
    pricingType: 'FREE',
  };
  let createdRegistration;

  Event.findById = async () => event;
  Event.findOneAndUpdate = async () => {
    capacityUpdateCount += 1;
    event.registeredCount += 1;
    return event;
  };
  Registration.findOne = async () => null;
  EventRoom.exists = async () => false;
  Registration.create = async (fields) => {
    createdRegistration = {
      ...fields,
      _id: new mongoose.Types.ObjectId(),
      confirmationCode: 'TESTCONFIRM',
      populate: async function populate() {
        return this;
      },
    };
    return createdRegistration;
  };
  Payment.findOne = async () => null;

  const req = {
    params: { id: event._id.toString() },
    user: { _id: userId, email: 'attendee@example.com', name: 'Test Attendee' },
    body: {},
  };
  try {
    const freeResult = await invoke(registrationController.registerForEvent, req);
    assert.equal(freeResult.status, 201);
    assert.equal(createdRegistration.status, 'confirmed');
    assert.equal(createdRegistration.paymentStatus, 'NOT_REQUIRED');

    const squadRoster = Array.from({ length: 4 }, (_, index) => ({
      playerName: `Squad Player ${index + 1}`,
      freeFireUid: String(300000 + index),
    }));
    event.teamMode = 'SQUAD';
    event.gameMode = 'SQUAD';
    event.teamSize = 4;
    req.body = { gameMode: 'SQUAD', teamSize: 4, players: squadRoster };
    const freeSquadResult = await invoke(registrationController.registerForEvent, req);
    assert.equal(freeSquadResult.status, 201);
    assert.equal(createdRegistration.status, 'confirmed');
    assert.equal(createdRegistration.paymentStatus, 'NOT_REQUIRED');
    assert.equal(createdRegistration.user.toString(), userId.toString());
    assert.equal(createdRegistration.event.toString(), event._id.toString());
    assert.deepEqual(createdRegistration.players, squadRoster);

    event.price = 250;
    event.pricingType = 'PAID';
    const paidSquadResult = await invoke(registrationController.registerForEvent, req);
    assert.equal(paidSquadResult.status, 201);
    assert.equal(createdRegistration.status, 'pending');
    assert.equal(createdRegistration.paymentStatus, 'PENDING');
    assert.deepEqual(createdRegistration.players, squadRoster);

    event.teamMode = 'DUO';
    event.gameMode = 'DUO';
    event.teamSize = 2;
    const capacityBeforeInvalidRoster = capacityUpdateCount;
    req.body = { players: [{ playerName: 'Only One', freeFireUid: '123456' }] };
    const invalidRoster = await invoke(registrationController.registerForEvent, req);
    assert.equal(invalidRoster.status, 400);
    assert.equal(capacityUpdateCount, capacityBeforeInvalidRoster);

    req.body = {
      players: [
        { playerName: 'Player One', freeFireUid: '123456' },
        { playerName: 'Player Two', freeFireUid: '654321' },
      ],
    };
    const teamResult = await invoke(registrationController.registerForEvent, req);
    assert.equal(teamResult.status, 201);
    assert.equal(createdRegistration.teamMode, 'DUO');
    assert.equal(createdRegistration.gameMode, 'DUO');
    assert.equal(createdRegistration.teamSize, 2);
    assert.equal(createdRegistration.players.length, 2);

    for (const [mode, size] of [['SOLO', 1], ['TRIO', 3], ['SQUAD', 4]]) {
      event.teamMode = mode;
      event.gameMode = mode;
      event.teamSize = size;
      req.body = {
        gameMode: mode,
        teamSize: size,
        players: Array.from({ length: size }, (_, index) => ({
          playerName: `Player ${index + 1}`,
          freeFireUid: String(200000 + index),
        })),
      };
      const teamFormatResult = await invoke(registrationController.registerForEvent, req);
      assert.equal(teamFormatResult.status, 201);
      assert.equal(createdRegistration.teamMode, mode);
      assert.equal(createdRegistration.gameMode, mode);
      assert.equal(createdRegistration.teamSize, size);
      assert.equal(createdRegistration.players.length, size);
    }

    const updatesBeforeMismatch = capacityUpdateCount;
    req.body = {
      gameMode: 'SQUAD',
      teamSize: 4,
      players: [{ playerName: 'Player One', freeFireUid: '777777' }],
    };
    const mismatchedMode = await invoke(registrationController.registerForEvent, req);
    assert.equal(mismatchedMode.status, 400);
    assert.equal(capacityUpdateCount, updatesBeforeMismatch);
  } finally {
    Event.findById = originalFindById;
    Event.findOneAndUpdate = originalFindOneAndUpdate;
    Registration.findOne = originalRegistrationFindOne;
    Registration.create = originalRegistrationCreate;
    Payment.findOne = originalPaymentFindOne;
    EventRoom.exists = originalRoomExists;
  }
};

const run = async () => {
  testCurrencyValidatorContexts();
  await testRegistrationRosterValidation();
  await testMinimumMembers();
  await testEditingPastEvents();
  await testCapacityCounting();
  await testCapacityUpdatesAndPublishing();
  await testRegistrationPricingBehavior();
  console.log('Event minimum-member, publishing, update, and capacity checks passed.');
};

run().catch((error) => {
  console.error('Event management checks failed:', error);
  process.exitCode = 1;
});
