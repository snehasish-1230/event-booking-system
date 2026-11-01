const assert = require('assert/strict');
const env = require('./config/env');

const originalFetch = global.fetch;
const originalInfo = console.info;
const originalWarn = console.warn;
const originalError = console.error;
const logs = [];
const outcomes = [];
const requests = [];

env.RESEND_API_KEY = 're_test-only-key';
env.EMAIL_FROM = 'EventBooking <sender@example.test>';
env.EMAIL_FROM_NAME = 'EventBooking';

global.fetch = async (url, options) => {
  requests.push({
    url,
    hasAuthorization: Boolean(options.headers.get('authorization')),
    payload: JSON.parse(options.body),
  });
  const outcome = outcomes.shift();
  if (outcome instanceof Error) throw outcome;
  return new Response(JSON.stringify(outcome.body), {
    status: outcome.status,
    headers: { 'Content-Type': 'application/json' },
  });
};
console.info = (...args) => logs.push(args);
console.warn = (...args) => logs.push(args);
console.error = (...args) => logs.push(args);
delete require.cache[require.resolve('./utils/emailService')];
const emailService = require('./utils/emailService');

const response = (body, status = 200) => ({ body, status });

const run = async () => {
  assert.equal(await emailService.verifyConnection(), true);

  const recipients = ['first.recipient@example.test', 'second.recipient@example.test'];
  for (const [index, recipient] of recipients.entries()) {
    outcomes.push(response({ id: `resend-message-${index}` }));
    const result = await emailService.sendVerificationEmail({
      to: recipient,
      subject: 'Test OTP subject',
      html: '<p>OTP 123456</p>',
    });
    assert.equal(result.submitted, true);
    assert.equal(result.messageId, `resend-message-${index}`);
  }

  assert.equal(requests[0].url, 'https://api.resend.com/emails');
  assert.equal(requests[0].hasAuthorization, true);
  assert.equal(requests[0].payload.from, env.EMAIL_FROM);
  assert.equal(requests[0].payload.to, recipients[0]);
  assert.equal(requests[0].payload.subject, 'Test OTP subject');

  outcomes.push(response({
    name: 'validation_error',
    statusCode: 422,
    message: 'Rejected recipient rejected.recipient@example.test',
  }, 422));
  await assert.rejects(
    emailService.sendVerificationEmail({
      to: 'rejected.recipient@example.test',
      subject: 'Test OTP subject',
      html: '<p>OTP 654321</p>',
    }),
    (error) => error.code === 'EMAIL_DELIVERY_FAILED'
  );

  outcomes.push(response({
    name: 'authentication_error',
    statusCode: 401,
    message: 'Invalid key re_test-only-key',
  }, 401));
  await assert.rejects(
    emailService.sendVerificationEmail({
      to: 'authentication.failure@example.test',
      subject: 'Test OTP subject',
      html: '<p>OTP 223344</p>',
    }),
    (error) => error.code === 'EMAIL_PROVIDER_AUTH_FAILED'
  );

  outcomes.push(new Error('Network failed for network.failure@example.test'));
  await assert.rejects(
    emailService.sendVerificationEmail({
      to: 'network.failure@example.test',
      subject: 'Test OTP subject',
      html: '<p>OTP 987654</p>',
    }),
    (error) => error.code === 'EMAIL_DELIVERY_FAILED'
  );

  outcomes.push(response({ id: 'resend-message-not-used' }));
  assert.deepEqual(
    await emailService.sendEmail({
      to: 'notification@example.test',
      subject: 'Notification',
      html: '<p>Notification</p>',
    }),
    { success: true }
  );

  outcomes.push(response({
    name: 'application_error',
    statusCode: 503,
    message: 'Provider unavailable',
  }, 503));
  assert.deepEqual(
    await emailService.sendEmail({
      to: 'notification@example.test',
      subject: 'Notification',
      html: '<p>Notification</p>',
    }),
    { success: false }
  );

  outcomes.push(response({}));
  await assert.rejects(
    emailService.sendVerificationEmail({
      to: 'missing-id@example.test',
      subject: 'Test OTP subject',
      html: '<p>OTP 112233</p>',
    }),
    (error) => error.code === 'EMAIL_DELIVERY_FAILED'
  );

  env.RESEND_API_KEY = undefined;
  env.EMAIL_FROM = undefined;
  assert.equal(await emailService.verifyConnection(), false);
  await assert.rejects(
    emailService.sendVerificationEmail({
      to: 'unconfigured@example.test',
      subject: 'Test',
      html: '<p>Test</p>',
    }),
    (error) => error.code === 'EMAIL_NOT_CONFIGURED'
  );

  const serializedLogs = JSON.stringify(logs);
  for (const recipient of [
    ...recipients,
    'rejected.recipient@example.test',
    'authentication.failure@example.test',
    'network.failure@example.test',
    'notification@example.test',
    'missing-id@example.test',
    'unconfigured@example.test',
  ]) {
    assert.equal(serializedLogs.includes(recipient), false, 'Email diagnostics must mask recipients');
  }
  for (const secret of [
    '123456',
    '654321',
    '223344',
    '987654',
    '112233',
    're_test-only-key',
    'Network failed',
    'Rejected recipient',
  ]) {
    assert.equal(serializedLogs.includes(secret), false, 'Email diagnostics must not log secrets or provider messages');
  }
  assert.ok(serializedLogs.includes('resend-message-0'));
  assert.ok(serializedLogs.includes('recipientAccepted'));

  console.log('Resend submission, failure, configuration, and redaction checks passed.');
};

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    global.fetch = originalFetch;
    console.info = originalInfo;
    console.warn = originalWarn;
    console.error = originalError;
  });
