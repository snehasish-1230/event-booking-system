const assert = require('assert/strict');
const nodemailer = require('nodemailer');
const env = require('./config/env');

const originalCreateTransport = nodemailer.createTransport;
const originalInfo = console.info;
const originalError = console.error;
const logs = [];
const outcomes = [];
const sentMessages = [];

env.SMTP_USER = 'sender@example.test';
env.SMTP_PASS = 'test-secret-not-for-logging';
nodemailer.createTransport = () => ({
  sendMail: async (message) => {
    sentMessages.push(message);
    const outcome = outcomes.shift();
    if (outcome instanceof Error) throw outcome;
    return outcome;
  },
});
console.info = (...args) => logs.push(args);
console.error = (...args) => logs.push(args);
delete require.cache[require.resolve('./utils/emailService')];
const emailService = require('./utils/emailService');

const smtpAccepted = (to, messageId) => ({
  messageId,
  accepted: [to],
  rejected: [],
  response: '250 2.0.0 Message accepted for processing',
});

const run = async () => {
  const recipients = ['first.recipient@gmail.com', 'second.recipient@gmail.com'];
  for (const [index, recipient] of recipients.entries()) {
    outcomes.push(smtpAccepted(recipient, `<accepted-${index}@example.test>`));
    const result = await emailService.sendVerificationEmail({
      to: recipient,
      subject: 'Test OTP subject',
      html: '<p>OTP 123456</p>',
    });
    assert.equal(result.submitted, true);
    assert.equal(result.messageId, `<accepted-${index}@example.test>`);
  }

  const rejectedRecipient = 'rejected.recipient@gmail.com';
  outcomes.push({
    messageId: '<rejected@example.test>',
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

  const smtpError = new Error('SMTP authentication failed');
  smtpError.code = 'EAUTH';
  smtpError.responseCode = 535;
  smtpError.command = 'AUTH PLAIN';
  outcomes.push(smtpError);
  await assert.rejects(
    emailService.sendVerificationEmail({
      to: 'smtp.failure@gmail.com',
      subject: 'Test OTP subject',
      html: '<p>OTP 987654</p>',
    }),
    (error) => error.code === 'EAUTH'
  );

  assert.equal(sentMessages.length, 4);
  assert.deepEqual(
    logs.filter(([message]) => message === 'Transactional email SMTP submission result:').length,
    4
  );
  const serializedLogs = JSON.stringify(logs);
  for (const recipient of [...recipients, rejectedRecipient, 'smtp.failure@gmail.com']) {
    assert.equal(serializedLogs.includes(recipient), false, 'SMTP diagnostics must mask recipient addresses');
  }
  for (const secret of ['123456', '654321', '987654', env.SMTP_PASS]) {
    assert.equal(serializedLogs.includes(secret), false, 'SMTP diagnostics must not log OTPs or credentials');
  }
  assert.ok(serializedLogs.includes('<accepted-0@example.test>'), 'SMTP message IDs should be recorded');
  assert.ok(serializedLogs.includes('recipientAccepted'));

  console.log('Transactional email SMTP result checks passed for multiple simulated recipients.');
};

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    nodemailer.createTransport = originalCreateTransport;
    console.info = originalInfo;
    console.error = originalError;
  });
