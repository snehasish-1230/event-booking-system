const assert = require('node:assert/strict');

const Payment = require('./models/Payment');
const Registration = require('./models/Registration');
const emailService = require('./utils/emailService');

const originalFindById = Payment.findById;
const originalPaymentFindOneAndUpdate = Payment.findOneAndUpdate;
const originalRegistrationFindOneAndUpdate = Registration.findOneAndUpdate;
const originalSendEmail = emailService.sendEmail;
const originalInfo = console.info;
const originalError = console.error;

const submittedEmails = [];
let currentPayment;

const populated = {
  populate() {
    return this;
  },
};

const makePayment = () => ({
  _id: 'payment-id',
  amount: 250,
  status: 'PENDING',
  booking: {
    _id: 'registration-id',
    status: 'pending',
    paymentStatus: 'PENDING',
    confirmationCode: 'CONFIRM-123',
    event: {
      title: 'Mock Resend Cup',
      slug: 'mock-resend-cup',
      date: new Date('2030-01-02T00:00:00.000Z'),
      time: '18:30',
      location: { venue: 'Test Arena', city: 'Test City' },
      pricingType: 'PAID',
      price: 250,
    },
  },
  user: {
    name: 'Authorized Test Recipient',
    email: 'authorized-recipient@example.test',
  },
  populate() {
    return this;
  },
});

emailService.sendEmail = async (email) => {
  submittedEmails.push(email);
  return { success: true, submitted: true, messageId: 'mock-resend-id' };
};
console.info = () => {};
console.error = () => {};

Payment.findById = () => currentPayment;
Payment.findOneAndUpdate = async (_filter, update) => {
  if (update.$set?.status) {
    currentPayment.status = update.$set.status;
    currentPayment.rejectionReason = update.$set.rejectionReason;
  }
  return currentPayment;
};
Registration.findOneAndUpdate = () => ({
  ...populated,
  confirmationCode: 'CONFIRM-123',
  event: currentPayment.booking.event,
});

delete require.cache[require.resolve('./controllers/paymentController')];
const { reviewPayment } = require('./controllers/paymentController');

const invoke = async (body) => {
  let statusCode;
  let responseBody;
  let forwardedError;
  const res = {
    status(status) {
      statusCode = status;
      return this;
    },
    json(bodyValue) {
      responseBody = bodyValue;
      return this;
    },
  };

  await reviewPayment(
    {
      params: { id: 'payment-id' },
      body,
      user: { _id: 'admin-id', role: 'admin' },
    },
    res,
    (error) => {
      forwardedError = error;
    }
  );
  await new Promise((resolve) => setImmediate(resolve));

  if (forwardedError) {
    return {
      statusCode: forwardedError.statusCode,
      error: forwardedError.stack || forwardedError.message,
      responseBody: { message: forwardedError.message },
    };
  }
  return { statusCode, responseBody };
};

const run = async () => {
  currentPayment = makePayment();
  const approved = await invoke({ action: 'APPROVE' });
  assert.equal(approved.statusCode, 200, approved.error);
  assert.equal(submittedEmails.length, 1);
  assert.equal(
    submittedEmails[0].to,
    'authorized-recipient@example.test'
  );
  assert.match(submittedEmails[0].subject, /Payment Verified/);
  assert.match(submittedEmails[0].html, /Mock Resend Cup/);
  assert.match(submittedEmails[0].html, /CONFIRM-123/);
  assert.equal(currentPayment.status, 'APPROVED');

  currentPayment = makePayment();
  submittedEmails.length = 0;
  const rejectionReason =
    '  Screenshot does not show the transaction ID. <script>alert("x")</script>  ';
  const rejected = await invoke({
    action: 'REJECT',
    rejectionReason,
  });
  assert.equal(rejected.statusCode, 200);
  assert.equal(submittedEmails.length, 1);
  assert.equal(
    submittedEmails[0].to,
    'authorized-recipient@example.test'
  );
  assert.match(submittedEmails[0].subject, /Payment Needs Attention/);
  assert.match(
    submittedEmails[0].html,
    /Screenshot does not show the transaction ID\./
  );
  assert.match(submittedEmails[0].html, /&lt;script&gt;/);
  assert.doesNotMatch(submittedEmails[0].html, /<script>/);
  assert.equal(currentPayment.status, 'REJECTED');
  assert.equal(
    currentPayment.rejectionReason,
    'Screenshot does not show the transaction ID. <script>alert("x")</script>'
  );

  submittedEmails.length = 0;
  const invalidRejection = await invoke({
    action: 'REJECT',
    rejectionReason: '  ',
  });
  assert.equal(invalidRejection.statusCode, 400);
  assert.equal(submittedEmails.length, 0);

  console.log('Mocked payment approval and rejection email workflow checks passed.');
};

run()
  .catch((error) => {
    originalError(error);
    process.exitCode = 1;
  })
  .finally(() => {
    Payment.findById = originalFindById;
    Payment.findOneAndUpdate = originalPaymentFindOneAndUpdate;
    Registration.findOneAndUpdate = originalRegistrationFindOneAndUpdate;
    emailService.sendEmail = originalSendEmail;
    console.info = originalInfo;
    console.error = originalError;
  });
