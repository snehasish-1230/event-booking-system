const assert = require('assert/strict');
const nodemailer = require('nodemailer');
const env = require('./config/env');

const originalCreateTransport = nodemailer.createTransport;
const originalInfo = console.info;
const originalWarn = console.warn;
const originalError = console.error;
const logs = [];
const outcomes = [];
const sentMessages = [];
const smtpPassword = 'test-only-app-password';
let transportOptions;
let verificationError;
let verifyCount = 0;

env.EMAIL_HOST = 'smtp.gmail.com';
env.EMAIL_PORT = 587;
env.EMAIL_SECURE = false;
env.EMAIL_USER = 'sender@example.test';
env.EMAIL_PASS = smtpPassword;
env.EMAIL_FROM = 'sender@example.test';
env.EMAIL_FROM_NAME = 'EventBooking';

nodemailer.createTransport = (options) => {
  transportOptions = options;
  return {
    sendMail: async (message) => {
      sentMessages.push(message);
      const outcome = outcomes.shift();
      if (outcome instanceof Error) throw outcome;
      return outcome;
    },
    verify: async () => {
      verifyCount += 1;
      if (verificationError) throw verificationError;
      return true;
    },
  };
};
console.info = (...args) => logs.push(args);
console.warn = (...args) => logs.push(args);
console.error = (...args) => logs.push(args);
delete require.cache[require.resolve('./utils/emailService')];
const emailService = require('./utils/emailService');

const smtpAccepted = (to, messageId) => ({
  messageId,
  accepted: [to],
  rejected: [],
  responseCode: 250,
  response: '250 2.0.0 Message accepted for processing',
});

const run = async () => {
  assert.equal(await emailService.verifyConnection(), true);
  assert.equal(transportOptions.host, 'smtp.gmail.com');
  assert.equal(transportOptions.port, 587);
  assert.equal(transportOptions.secure, false);
  assert.equal(transportOptions.requireTLS, true);
  assert.equal(transportOptions.connectionTimeout, 10000);
  assert.equal(transportOptions.greetingTimeout, 10000);
  assert.equal(transportOptions.socketTimeout, 15000);
  assert.equal(transportOptions.auth.user, env.EMAIL_USER);
  assert.equal(transportOptions.auth.pass, env.EMAIL_PASS);
  assert.equal(verifyCount, 1);

  const recipients = ['first.recipient@example.test', 'second.recipient@example.test'];
  for (const [index, recipient] of recipients.entries()) {
    outcomes.push(smtpAccepted(recipient, `test-message-${index}`));
    const result = await emailService.sendVerificationEmail({
      to: recipient,
      subject: 'Test OTP subject',
      html: '<p>OTP 123456</p>',
    });
    assert.equal(result.submitted, true);
    assert.equal(result.messageId, `test-message-${index}`);
  }

  assert.deepEqual(sentMessages[0].from, {
    name: 'EventBooking',
    address: 'sender@example.test',
  });
  assert.equal(sentMessages[0].to, recipients[0]);
  assert.equal(sentMessages[0].subject, 'Test OTP subject');

  const rejectedRecipient = 'rejected.recipient@example.test';
  outcomes.push({
    messageId: 'rejected-message',
    accepted: [],
    rejected: [rejectedRecipient],
    responseCode: 550,
    response: `550 5.1.1 ${rejectedRecipient} user unknown`,
  });
  await assert.rejects(
    emailService.sendVerificationEmail({
      to: rejectedRecipient,
      subject: 'Test OTP subject',
      html: '<p>OTP 654321</p>',
    }),
    (error) => error.code === 'EMAIL_RECIPIENT_REJECTED'
  );

  const smtpError = new Error('SMTP authentication failed for sender@example.test');
  smtpError.code = 'EAUTH';
  smtpError.responseCode = 535;
  smtpError.command = 'AUTH PLAIN';
  outcomes.push(smtpError);
  await assert.rejects(
    emailService.sendVerificationEmail({
      to: 'smtp.failure@example.test',
      subject: 'Test OTP subject',
      html: '<p>OTP 987654</p>',
    }),
    (error) => error.code === 'EMAIL_AUTH_FAILED'
  );

  outcomes.push(smtpAccepted('notification@example.test', 'notification-message'));
  assert.deepEqual(
    await emailService.sendEmail({
      to: 'notification@example.test',
      subject: 'Notification',
      html: '<p>Notification</p>',
    }),
    { success: true }
  );

  outcomes.push(new Error('SMTP unavailable'));
  assert.deepEqual(
    await emailService.sendEmail({
      to: 'notification@example.test',
      subject: 'Notification',
      html: '<p>Notification</p>',
    }),
    { success: false }
  );

  verificationError = Object.assign(new Error('Sensitive SMTP response'), {
    code: 'EAUTH',
    responseCode: 535,
  });
  assert.equal(await emailService.verifyConnection(), false);
  verificationError = undefined;

  env.EMAIL_USER = undefined;
  env.EMAIL_PASS = undefined;
  env.EMAIL_FROM = undefined;
  assert.equal(await emailService.verifyConnection(), false);
  await assert.rejects(
    emailService.sendVerificationEmail({
      to: 'unconfigured@example.test',
      subject: 'Test',
      html: '<p>Test</p>',
    }),
    (error) =>
      error.code === 'EMAIL_NOT_CONFIGURED' &&
      /EMAIL_USER, EMAIL_PASS, and EMAIL_FROM/.test(error.message)
  );

  const serializedLogs = JSON.stringify(logs);
  for (const recipient of [
    ...recipients,
    rejectedRecipient,
    'smtp.failure@example.test',
    'notification@example.test',
    'unconfigured@example.test',
  ]) {
    assert.equal(serializedLogs.includes(recipient), false, 'SMTP diagnostics must mask recipient addresses');
  }
  for (const sensitiveValue of [
    '123456',
    '654321',
    '987654',
    smtpPassword,
    'Sensitive SMTP response',
    'sender@example.test',
  ]) {
    if (sensitiveValue) {
      assert.equal(serializedLogs.includes(sensitiveValue), false, 'SMTP diagnostics must not log OTPs, addresses, responses, or credentials');
    }
  }
  assert.ok(serializedLogs.includes('test-message-0'));
  assert.ok(serializedLogs.includes('recipientAccepted'));

  console.log('Gmail SMTP submission, failure, configuration, and redaction checks passed.');
};

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    nodemailer.createTransport = originalCreateTransport;
    console.info = originalInfo;
    console.warn = originalWarn;
    console.error = originalError;
  });
