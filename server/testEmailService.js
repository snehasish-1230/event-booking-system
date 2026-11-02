const assert = require('node:assert/strict');
const env = require('./config/env');

const originalFetch = global.fetch;
const originalInfo = console.info;
const originalWarn = console.warn;
const originalError = console.error;
const logs = [];
const calls = [];
const responses = [];

env.NODE_ENV = 'test';
env.RESEND_API_KEY = 're_test_secret_value';
env.EMAIL_FROM = 'EventBooking <sender@example.test>';

global.fetch = async (url, options) => {
  calls.push({ url, options });
  const outcome = responses.shift();
  if (outcome instanceof Error) throw outcome;
  return {
    ok: outcome.ok,
    status: outcome.status,
    json: async () => outcome.body,
  };
};
console.info = (...args) => logs.push(args);
console.warn = (...args) => logs.push(args);
console.error = (...args) => logs.push(args);

delete require.cache[require.resolve('./utils/emailService')];
const emailService = require('./utils/emailService');

const enqueueResponse = (status, body) => {
  responses.push({
    ok: status >= 200 && status < 300,
    status,
    body,
  });
};

const run = async () => {
  assert.equal(await emailService.verifyConnection(), true);
  assert.equal(calls.length, 0, 'startup verification must not make SMTP or API calls');

  enqueueResponse(200, { id: 'resend-message-1' });
  const result = await emailService.sendVerificationEmail({
    to: 'recipient@example.test',
    subject: 'Verification code',
    html: '<p>OTP 123456</p>',
  });
  assert.deepEqual(result, {
    submitted: true,
    messageId: 'resend-message-1',
  });
  assert.equal(calls[0].url, 'https://api.resend.com/emails');
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(
    calls[0].options.headers.Authorization,
    `Bearer ${env.RESEND_API_KEY}`
  );
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    from: env.EMAIL_FROM,
    to: ['recipient@example.test'],
    subject: 'Verification code',
    html: '<p>OTP 123456</p>',
  });

  enqueueResponse(401, { message: 'private API key detail' });
  await assert.rejects(
    emailService.sendVerificationEmail({
      to: 'recipient@example.test',
      subject: 'Verification code',
      html: '<p>OTP 654321</p>',
    }),
    (error) => error.code === 'EMAIL_PROVIDER_AUTH_FAILED'
  );

  enqueueResponse(422, { message: 'recipient@example.test was rejected' });
  await assert.rejects(
    emailService.sendPasswordResetEmail({
      to: 'recipient@example.test',
      subject: 'Password reset',
      html: '<p>OTP 987654</p>',
    }),
    (error) => error.code === 'EMAIL_REQUEST_REJECTED'
  );

  enqueueResponse(429, { message: 'private rate limit response' });
  await assert.rejects(
    emailService.sendVerificationEmail({
      to: 'recipient@example.test',
      subject: 'Rate limited',
      html: '<p>Test</p>',
    }),
    (error) => error.code === 'EMAIL_RATE_LIMITED'
  );

  enqueueResponse(403, { message: 'sender domain is not verified' });
  await assert.rejects(
    emailService.sendVerificationEmail({
      to: 'recipient@example.test',
      subject: 'Unverified sender',
      html: '<p>Test</p>',
    }),
    (error) => error.code === 'EMAIL_PROVIDER_FORBIDDEN'
  );

  enqueueResponse(500, {
    name: 'internal_server_error',
    message:
      'Delivery failed for recipient@example.test; OTP 123456; key re_private_test_key',
  });
  await assert.rejects(
    emailService.sendVerificationEmail({
      to: 'recipient@example.test',
      subject: 'Provider failure',
      html: '<p>Test</p>',
    }),
    (error) => error.code === 'EMAIL_PROVIDER_ERROR'
  );

  responses.push(new Error('private request failure detail'));
  assert.deepEqual(
    await emailService.sendEmail({
      to: 'recipient@example.test',
      subject: 'Notification',
      html: '<p>Notification</p>',
    }),
    { success: false, submitted: false }
  );

  const timeoutError = new Error('private timeout detail');
  timeoutError.name = 'AbortError';
  responses.push(timeoutError);
  await assert.rejects(
    emailService.sendVerificationEmail({
      to: 'recipient@example.test',
      subject: 'Timed out',
      html: '<p>Test</p>',
    }),
    (error) => error.code === 'EMAIL_REQUEST_TIMEOUT'
  );

  enqueueResponse(200, {});
  await assert.rejects(
    emailService.sendVerificationEmail({
      to: 'recipient@example.test',
      subject: 'Invalid provider response',
      html: '<p>Test</p>',
    }),
    (error) => error.code === 'EMAIL_INVALID_PROVIDER_RESPONSE'
  );

  env.RESEND_API_KEY = undefined;
  env.EMAIL_FROM = '';
  assert.equal(await emailService.verifyConnection(), false);
  await assert.rejects(
    emailService.sendVerificationEmail({
      to: 'recipient@example.test',
      subject: 'Unconfigured',
      html: '<p>Test</p>',
    }),
    (error) => error.code === 'EMAIL_NOT_CONFIGURED'
  );

  env.NODE_ENV = 'production';
  await assert.rejects(
    emailService.verifyConnection(),
    (error) => error.code === 'EMAIL_NOT_CONFIGURED'
  );

  const serializedLogs = JSON.stringify(logs);
  for (const sensitiveValue of [
    'recipient@example.test',
    '123456',
    '654321',
    '987654',
    'private request failure detail',
    'Delivery failed for recipient@example.test',
    'recipient@example.test; OTP 123456',
    'key re_private_test_key',
    'private timeout detail',
    're_test_secret_value',
  ]) {
    assert.equal(
      serializedLogs.includes(sensitiveValue),
      false,
      'email diagnostics must not log recipients, OTPs, API keys, or provider details'
    );
  }
  assert.ok(serializedLogs.includes('EMAIL_PROVIDER_AUTH_FAILED'));
  assert.ok(serializedLogs.includes('EMAIL_PROVIDER_FORBIDDEN'));
  assert.ok(serializedLogs.includes('EMAIL_PROVIDER_ERROR'));
  assert.ok(serializedLogs.includes('internal_server_error'));
  assert.ok(serializedLogs.includes('[redacted email]'));
  assert.ok(serializedLogs.includes('sender domain is not verified'));
  assert.ok(serializedLogs.includes('"status":401'));
  assert.ok(serializedLogs.includes('"status":403'));
  assert.ok(serializedLogs.includes('"status":422'));
  assert.ok(serializedLogs.includes('"status":500'));

  console.log('Resend submission, failure, configuration, and redaction checks passed.');
};

run()
  .catch((error) => {
    originalError(error);
    process.exitCode = 1;
  })
  .finally(() => {
    global.fetch = originalFetch;
    console.info = originalInfo;
    console.warn = originalWarn;
    console.error = originalError;
  });
