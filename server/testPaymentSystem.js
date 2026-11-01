const assert = require('assert');
const mongoose = require('mongoose');

const Payment = require('./models/Payment');
const TestPayment = require('./models/TestPayment');
const Registration = require('./models/Registration');
const Event = require('./models/Event');
const User = require('./models/User');
const { validationResult } = require('express-validator');
const { createPaymentRules } = require('./validators/paymentValidator');
const { getImageExtension } = require('./controllers/paymentController');
const { isPaidEvent } = require('./utils/eventPricing');

const id = () => new mongoose.Types.ObjectId();

const validateDocument = (document) =>
  document.validate().then(
    () => undefined,
    (error) => error
  );

const testPaymentSchemas = async () => {
  const payment = new Payment({
    user: id(),
    booking: id(),
    amount: 499,
    transactionId: 'TX1234567890',
    paymentScreenshot: '/uploads/payment-test.jpg',
    freeFireAccountName: '  Player One  ',
    freeFireUid: '00123456789',
    phoneNumber: '+91 98765-43210',
  });
  assert.strictEqual(payment.freeFireAccountName, 'Player One');
  assert.strictEqual(payment.freeFireUid, '00123456789');
  assert.strictEqual(payment.phoneNumber, '+91 98765-43210');
  assert.strictEqual(payment.status, 'PENDING');
  assert.strictEqual(payment.currency, 'INR');
  assert.strictEqual(payment.paymentMethod, 'UPI_QR');
  assert.strictEqual(await validateDocument(payment), undefined);

  payment.status = 'COMPLETED';
  assert.ok((await validateDocument(payment))?.errors?.status, 'Unknown payment statuses must be rejected');

  const invalidFreeFireUid = new Payment({
    user: id(),
    booking: id(),
    amount: 499,
    transactionId: 'TX1234567891',
    paymentScreenshot: '/uploads/payment-test.jpg',
    freeFireAccountName: 'Player Two',
    freeFireUid: '12AB34',
  });
  assert.ok((await validateDocument(invalidFreeFireUid))?.errors?.freeFireUid, 'Free Fire UID must contain digits only');

  const invalidPaymentPhone = new Payment({
    user: id(),
    booking: id(),
    amount: 499,
    transactionId: 'TX1234567892',
    paymentScreenshot: '/uploads/payment-test.jpg',
    phoneNumber: 'not a phone',
  });
  assert.ok((await validateDocument(invalidPaymentPhone))?.errors?.phoneNumber, 'Payment phone number must be valid');

  const legacyPayment = Payment.hydrate({
    _id: id(),
    user: id(),
    booking: id(),
    amount: 499,
    transactionId: 'LEGACY1234',
    paymentScreenshot: '/uploads/legacy-payment.jpg',
    status: 'PENDING',
  });
  assert.strictEqual(await validateDocument(legacyPayment), undefined, 'Legacy payments without Free Fire details must remain valid');

  const testPayment = new TestPayment({
    user: id(),
    booking: id(),
    amount: 499,
    transactionId: 'TEST_ONLY-EXAMPLE',
  });
  assert.strictEqual(testPayment.testOnly, true);
  assert.strictEqual(testPayment.status, 'PENDING');
  assert.strictEqual(await validateDocument(testPayment), undefined);
};

const testEventCurrencyDefaults = async () => {
  const event = new Event({
    title: 'INR Currency Test',
    description: 'An event model currency default test.',
    date: new Date(Date.now() + 86400000),
    capacity: 10,
    organizer: id(),
    location: { venue: 'Test venue', city: 'Test city' },
    category: 'conference',
    price: 499,
  });
  assert.strictEqual(event.currency, 'INR');
  assert.strictEqual(event.pricingType, 'PAID');
  assert.strictEqual(isPaidEvent(event), true);

  const freeEvent = new Event({
    title: 'Free Event Pricing Test',
    description: 'An event model free pricing type test.',
    date: new Date(Date.now() + 86400000),
    capacity: 10,
    organizer: id(),
    location: { venue: 'Test venue', city: 'Test city' },
    category: 'conference',
    price: 0,
    pricingType: 'FREE',
  });
  assert.strictEqual(freeEvent.pricingType, 'FREE');
  assert.strictEqual(await validateDocument(freeEvent), undefined);
  assert.strictEqual(isPaidEvent(freeEvent), false);
  assert.strictEqual(isPaidEvent({ price: 250 }), true, 'Legacy positive prices remain paid');

  const nonInrNewEvent = new Event({
    title: 'Non-INR Currency Test',
    description: 'New events must use the configured currency.',
    date: new Date(Date.now() + 86400000),
    capacity: 10,
    organizer: id(),
    location: { venue: 'Test venue', city: 'Test city' },
    category: 'conference',
    price: 499,
    currency: 'USD',
  });
  assert.ok((await validateDocument(nonInrNewEvent))?.errors?.currency);

  const legacyEvent = Event.hydrate({
    _id: id(),
    title: 'Legacy Currency Test',
    description: 'Legacy currency data remains readable.',
    date: new Date(Date.now() + 86400000),
    capacity: 10,
    registeredCount: 0,
    price: 499,
    currency: 'USD',
    location: { venue: 'Legacy venue', city: 'Legacy city' },
    category: 'conference',
    organizer: id(),
    status: 'published',
  });
  assert.strictEqual(await validateDocument(legacyEvent), undefined);
};

const testRegistrationStatusesAndIndexes = async () => {
  const paidRegistration = new Registration({
    user: id(),
    event: id(),
    status: 'pending',
    paymentStatus: 'PENDING',
  });
  assert.strictEqual(await validateDocument(paidRegistration), undefined);

  paidRegistration.status = 'awaiting-payment';
  assert.ok((await validateDocument(paidRegistration))?.errors?.status, 'Unknown registration statuses must be rejected');

  const registrationIndexes = Registration.schema.indexes();
  assert.ok(registrationIndexes.some(([keys, options]) =>
    keys.user === 1 && keys.event === 1 && options.unique
  ), 'A user may only have one registration per event');

  const paymentIndexes = Payment.schema.indexes();
  assert.ok(paymentIndexes.some(([keys, options]) => keys.booking === 1 && options.unique));
  assert.ok(paymentIndexes.some(([keys, options]) => keys.transactionId === 1 && options.unique));
};

const testScreenshotFormats = () => {
  const samples = [
    [Buffer.from([0xff, 0xd8, 0xff, 0xe0]), 'jpg'],
    [Buffer.from([0x89, 0x50, 0x4e, 0x47]), 'png'],
    [Buffer.from('GIF89a'), 'gif'],
    [Buffer.from('RIFF0000WEBP'), 'webp'],
    [Buffer.from([0x4d, 0x5a, 0x90, 0x00]), null],
  ];
  for (const [buffer, expectedExtension] of samples) {
    assert.strictEqual(getImageExtension(buffer), expectedExtension);
  }
};

const testEmailVerificationSchema = () => {
  const legacyUser = new User({ email: 'existing@example.com' });
  const pendingUser = new User({
    email: 'pending@example.com',
    emailVerified: false,
  });
  assert.strictEqual(legacyUser.emailVerified, true);
  assert.strictEqual(pendingUser.emailVerified, false);
  assert.strictEqual(User.schema.path('email').options.unique, true);
  assert.strictEqual(User.schema.path('emailOtpHash').options.select, false);
  assert.strictEqual(User.schema.path('emailOtpExpiresAt').options.select, false);
};

const testPaymentPhoneValidation = async () => {
  const baseBody = {
    bookingId: '507f1f77bcf86cd799439011',
    transactionId: 'TX123456',
    freeFireAccountName: 'Player One',
    freeFireUid: '00123456789',
    phoneNumber: '+91 98765-43210',
  };
  const validateBody = async (body) => {
    const req = { body };
    await Promise.all(createPaymentRules.map((rule) => rule.run(req)));
    return validationResult(req).array();
  };

  assert.ok((await validateBody({ ...baseBody, phoneNumber: '' })).some((error) => error.path === 'phoneNumber'));
  assert.ok((await validateBody({ ...baseBody, phoneNumber: 'invalid' })).some((error) => error.path === 'phoneNumber'));
  assert.equal((await validateBody(baseBody)).length, 0);
};

const run = async () => {
  await testPaymentPhoneValidation();
  await testPaymentSchemas();
  await testEventCurrencyDefaults();
  await testRegistrationStatusesAndIndexes();
  testScreenshotFormats();
  testEmailVerificationSchema();
  console.log('Payment and registration schema checks passed.');
};

run().catch((err) => {
  console.error('Payment system verification failed:', err);
  process.exitCode = 1;
});
