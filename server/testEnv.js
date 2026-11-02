const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

const validProductionEnvironment = {
  PATH: process.env.PATH,
  NODE_ENV: 'production',
  MONGODB_URI: 'mongodb://127.0.0.1:27017/event-booking-test',
  JWT_SECRET: 'test-jwt-secret-with-at-least-thirty-two-characters',
  RESEND_API_KEY: 're_test_only_key',
  EMAIL_FROM: 'EventBooking <sender@example.test>',
  CLIENT_URL: 'https://event-booking-system-bc862y17v-ff-team8.vercel.app',
  EMAIL_OTP_SECRET: 'test-otp-secret-with-at-least-thirty-two-characters',
};

const loadEnvironment = (variables) =>
  spawnSync(process.execPath, ['-e', "require('./config/env')"], {
    cwd: __dirname,
    env: variables,
    encoding: 'utf8',
  });

const run = () => {
  const valid = loadEnvironment(validProductionEnvironment);
  assert.equal(valid.status, 0, valid.stderr);

  const missingOtpSecret = { ...validProductionEnvironment };
  delete missingOtpSecret.EMAIL_OTP_SECRET;
  const missing = loadEnvironment(missingOtpSecret);
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /EMAIL_OTP_SECRET/);

  const wildcardOrigin = {
    ...validProductionEnvironment,
    CLIENT_URL: '*',
  };
  const wildcard = loadEnvironment(wildcardOrigin);
  assert.notEqual(wildcard.status, 0);
  assert.match(wildcard.stderr, /CLIENT_URL must contain valid exact origins/);

  console.log('Production environment validation checks passed.');
};

try {
  run();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
