const assert = require('assert/strict');
const path = require('path');

process.env.JWT_SECRET = 'test-only-jwt-secret-long-enough-for-otp-hashing';
process.env.EMAIL_OTP_SECRET = 'test-only-email-otp-secret';
process.env.RESEND_API_KEY = 're_test_only_key';
process.env.EMAIL_FROM = 'sender@example.test';
process.env.NODE_ENV = 'test';

const userPath = require.resolve('./models/User');
const emailServicePath = require.resolve('./utils/emailService');
const users = new Map();
const savedAuthStates = new Map();
let nextId = 1;
const sentEmails = [];
let failEmailDelivery = false;

const matches = (user, filter) => {
  if (!user) return false;
  return Object.entries(filter).every(([key, expected]) => {
    if (key === '$and') return expected.every((condition) => matches(user, condition));
    if (key === '$or') return expected.some((condition) => matches(user, condition));
    const actual = user[key];
    if (expected && typeof expected === 'object' && !(expected instanceof Date)) {
      if ('$gt' in expected && !(actual > expected.$gt)) return false;
      if ('$lt' in expected && !(actual < expected.$lt)) return false;
      if ('$lte' in expected && !(actual <= expected.$lte)) return false;
      if ('$exists' in expected && (actual !== undefined) !== expected.$exists) return false;
      if ('$in' in expected && !expected.$in.some((value) => value === actual || (value === null && actual === undefined))) return false;
      return true;
    }
    if (expected === null) return actual == null;
    return actual === expected;
  });
};

class FakeUser {
  constructor(data) {
    Object.assign(this, data);
    this._id = String(nextId++);
    this.emailVerified ??= true;
    this.isActive ??= true;
    this.emailOtpAttempts ??= 0;
  }

  async save() {
    users.set(this.email, this);
    const snapshots = savedAuthStates.get(this.email) || [];
    snapshots.push({
      loginAttempts: this.loginAttempts,
      lockUntil: this.lockUntil,
    });
    savedAuthStates.set(this.email, snapshots);
    return this;
  }

  async comparePassword(candidate) {
    return candidate === this.password;
  }

  static async create(data) {
    const user = new FakeUser(data);
    await user.save();
    return user;
  }

  static findOne(filter) {
    const user = [...users.values()].find((candidate) =>
      matches(candidate, filter)
    );
    const document = user
      ? Object.assign(Object.create(FakeUser.prototype), user)
      : null;
    return { select: async () => document };
  }

  static async updateOne(filter, update) {
    const user = [...users.values()].find((candidate) =>
      matches(candidate, filter)
    );
    if (!user) return { matchedCount: 0, modifiedCount: 0 };
    FakeUser.applyUpdate(user, update);
    return { matchedCount: 1, modifiedCount: 1 };
  }

  static async findOneAndUpdate(filter, update) {
    const user = [...users.values()].find((candidate) =>
      matches(candidate, filter)
    );
    if (!user) return null;
    FakeUser.applyUpdate(user, update);
    return user;
  }

  static applyUpdate(user, update) {
    for (const [key, value] of Object.entries(update.$set || {})) {
      user[key] = value;
    }
    for (const key of Object.keys(update.$unset || {})) {
      delete user[key];
    }
    for (const [key, value] of Object.entries(update.$inc || {})) {
      user[key] = (user[key] || 0) + value;
    }
  }
}

require.cache[userPath] = {
  id: userPath,
  filename: userPath,
  loaded: true,
  exports: FakeUser,
};
require.cache[emailServicePath] = {
  id: emailServicePath,
  filename: emailServicePath,
  loaded: true,
  exports: {
    sendVerificationEmail: async ({ html }) => {
      if (failEmailDelivery) throw new Error('Simulated SMTP failure');
      sentEmails.push(html);
      return { submitted: true, messageId: `<test-${sentEmails.length}@example.test>` };
    },
    sendEmail: async () => ({ success: true }),
    verifyConnection: async () => {},
  },
};

const authController = require('./controllers/authController');
const authRoutes = require('./routes/authRoutes');
const registerRules = require('./validators/authValidator').registerRules;
const { validationResult } = require('express-validator');
const express = require('express');
const {
  globalLimiter,
  loginLimiter,
  registrationOtpLimiter,
  otpRequestLimiter,
  otpVerifyLimiter,
} = require('./middlewares/rateLimiter');

const invoke = async (handler, body) => {
  let responseStatus;
  let responseBody;
  let nextError;
  const res = {
    status(status) {
      responseStatus = status;
      return this;
    },
    json(json) {
      responseBody = json;
      return this;
    },
  };
  await handler({ body }, res, (error) => {
    nextError = error;
  });
  return nextError
    ? {
        status: nextError.statusCode,
        body: {
          message: nextError.message,
          ...(nextError.retryAfterSeconds && {
            retryAfterSeconds: nextError.retryAfterSeconds,
          }),
        },
      }
    : { status: responseStatus, body: responseBody };
};

const extractOtp = (emailHtml) =>
  emailHtml.match(/letter-spacing:10px;">(\d{6})<\/p>/)?.[1];

const validateRegistration = async (body) => {
  const req = { body };
  await Promise.all(registerRules.map((rule) => rule.run(req)));
  return validationResult(req).array();
};

const testRegistrationPhoneValidation = async () => {
  const base = {
    name: 'Phone Validation User',
    email: 'phone-validation@example.com',
    password: 'Pass123',
    phone: '+91 98765-43210',
    whatsappNumber: '+1 (415) 555-2671',
  };
  assert.deepEqual(await validateRegistration({ ...base, phone: '' }).then((errors) => errors.map((error) => error.path)), ['phone']);
  assert.deepEqual(await validateRegistration({ ...base, whatsappNumber: '' }).then((errors) => errors.map((error) => error.path)), ['whatsappNumber']);
  assert.ok((await validateRegistration({ ...base, phone: '+91 12345' })).some((error) => error.path === 'phone'));
  assert.ok((await validateRegistration({ ...base, whatsappNumber: 'abc' })).some((error) => error.path === 'whatsappNumber'));
  assert.equal((await validateRegistration(base)).length, 0);
};

const testOtpRateLimits = async () => {
  const app = express();
  app.set('trust proxy', 1);
  app.post('/request', otpRequestLimiter, (_req, res) => res.sendStatus(204));
  app.post('/verify', otpVerifyLimiter, (_req, res) => res.sendStatus(204));
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, () => resolve(listener));
  });

  try {
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const requestStatuses = [];
    for (let i = 0; i < 11; i += 1) {
      const response = await fetch(`${baseUrl}/request`, {
        method: 'POST',
        headers: { 'x-forwarded-for': '198.51.100.40' },
      });
      requestStatuses.push(response.status);
    }
    assert.equal(requestStatuses.filter((status) => status === 204).length, 10);
    assert.equal(requestStatuses.at(-1), 429);

    const verificationStatuses = [];
    for (let i = 0; i < 21; i += 1) {
      const response = await fetch(`${baseUrl}/verify`, {
        method: 'POST',
        headers: { 'x-forwarded-for': '198.51.100.41' },
      });
      verificationStatuses.push(response.status);
    }
    assert.equal(verificationStatuses.filter((status) => status === 204).length, 20);
    assert.equal(verificationStatuses.at(-1), 429);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
};

const testRegistrationLimiterIsIndependent = async () => {
  const app = express();
  app.set('trust proxy', 1);
  app.post('/register', registrationOtpLimiter, (_req, res) => res.sendStatus(204));
  app.post('/resend', otpRequestLimiter, (_req, res) => res.sendStatus(204));
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });

  try {
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const response = await fetch(`${baseUrl}/resend`, {
        method: 'POST',
        headers: { 'x-forwarded-for': '198.51.100.42' },
      });
      assert.equal(response.status, 204);
    }

    const registrationResponse = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'x-forwarded-for': '198.51.100.42' },
    });
    assert.equal(registrationResponse.status, 204);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
};

const testLoginRateLimits = async () => {
  const app = express();
  app.set('trust proxy', 1);
  app.use('/api', globalLimiter);
  app.post('/api/auth/login', loginLimiter, (req, res) => {
    res.sendStatus(req.header('x-test-login') === 'success' ? 200 : 401);
  });
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });

  try {
    const url = `http://127.0.0.1:${server.address().port}/api/auth/login`;
    for (let attempt = 0; attempt < 101; attempt += 1) {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'x-test-login': 'success',
          'x-forwarded-for': '198.51.100.43',
        },
      });
      await response.arrayBuffer();
      assert.equal(response.status, 200);
    }

    for (let attempt = 0; attempt < 50; attempt += 1) {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'x-forwarded-for': '198.51.100.43' },
      });
      await response.arrayBuffer();
      assert.equal(response.status, 401);
    }

    const limitedResponse = await fetch(url, {
      method: 'POST',
      headers: { 'x-forwarded-for': '198.51.100.43' },
    });
    const limitedBody = await limitedResponse.json();
    assert.equal(limitedResponse.status, 429);
    assert.match(limitedBody.message, /Too many failed login attempts/);
    assert.ok(limitedBody.retryAfterSeconds > 0);
    assert.equal(
      Number(limitedResponse.headers.get('retry-after')),
      limitedBody.retryAfterSeconds
    );
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
};

const run = async () => {
  assert.equal(typeof authRoutes, 'function');
  await testRegistrationPhoneValidation();

  const initial = await invoke(authController.register, {
    name: 'OTP Test User',
    email: 'otp-test@example.com',
    password: 'Pass123',
    phone: '+91 98765-43210',
    whatsappNumber: '+1 (415) 555-2671',
    role: 'organizer',
    emailVerified: true,
  });
  assert.equal(initial.status, 202);
  assert.equal(initial.body.message, 'Verification email submitted. Please check your Inbox and Spam folder.');
  assert.equal(initial.body.data.emailSubmissionStatus, 'submitted');
  assert.equal(sentEmails.length, 1);
  let user = users.get('otp-test@example.com');
  const originalOtp = extractOtp(sentEmails[0]);
  assert.match(originalOtp, /^\d{6}$/);
  assert.equal(user.emailVerified, false);
  assert.equal(user.phone, '+91 98765-43210');
  assert.equal(user.whatsappNumber, '+1 (415) 555-2671');
  assert.notEqual(user.emailOtpHash, originalOtp);
  assert.equal(initial.body.data.token, undefined);
  assert.equal(initial.body.data.otp, undefined);

  const pendingDuplicate = await invoke(authController.register, {
    name: 'OTP Test User',
    email: user.email,
    password: user.password,
    phone: '+91 98765-43210',
    whatsappNumber: '+1 (415) 555-2671',
  });
  assert.equal(pendingDuplicate.status, 429);
  assert.equal(users.size, 1);
  user = users.get('otp-test@example.com');

  const blockedLogin = await invoke(authController.login, {
    email: user.email,
    password: user.password,
  });
  assert.equal(blockedLogin.status, 403);
  user.loginAttempts = 3;
  await user.save();
  await invoke(authController.login, {
    email: user.email,
    password: user.password,
  });
  user = users.get(user.email);
  assert.equal(user.loginAttempts, 0);

  const wrongOtp = originalOtp === '000000' ? '000001' : '000000';
  const failedAttempts = [
    await invoke(authController.verifyEmail, {
      email: user.email,
      otp: 123,
    }),
  ];
  for (let attempt = 0; attempt < 4; attempt += 1) {
    failedAttempts.push(
      await invoke(authController.verifyEmail, {
        email: user.email,
        otp: wrongOtp,
      })
    );
  }
  assert.deepEqual(
    failedAttempts.map((result) => result.status),
    [400, 400, 400, 400, 429]
  );
  assert.equal(user.emailOtpAttempts, 5);

  user.emailOtpResendAvailableAt = new Date(Date.now() - 1000);
  await user.save();
  const resendAttempts = await Promise.all([
    invoke(authController.resendEmailOtp, { email: user.email }),
    invoke(authController.resendEmailOtp, { email: user.email }),
  ]);
  assert.deepEqual(
    resendAttempts.map((result) => result.status).sort(),
    [200, 429]
  );
  const resent = resendAttempts.find((result) => result.status === 200);
  assert.equal(resent.status, 200);
  assert.equal(sentEmails.length, 2);
  const replacementOtp = extractOtp(sentEmails[1]);
  assert.match(replacementOtp, /^\d{6}$/);
  assert.notEqual(replacementOtp, originalOtp);
  assert.equal(
    (await invoke(authController.verifyEmail, {
      email: user.email,
      otp: originalOtp,
    })).status,
    400
  );

  const verified = await invoke(authController.verifyEmail, {
    email: user.email,
    otp: replacementOtp,
  });
  assert.equal(verified.status, 200);
  assert.equal(users.get(user.email).emailVerified, true);
  assert.equal(users.get(user.email).emailOtpHash, undefined);
  const successfulLogin = await invoke(authController.login, {
    email: user.email,
    password: user.password,
  });
  assert.equal(successfulLogin.status, 200, successfulLogin.body?.message);
  assert.ok(successfulLogin.body.data.token);
  const successfulLoginState = savedAuthStates.get(user.email).at(-1);
  assert.equal(successfulLoginState.loginAttempts, 0);
  assert.equal(successfulLoginState.lockUntil, null);
  const legacyAdmin = await FakeUser.create({
    name: 'Legacy Admin',
    email: 'legacy-admin@example.com',
    password: 'Admin123',
    role: 'admin',
  });
  assert.equal(legacyAdmin.emailVerified, true);
  assert.equal(
    (await invoke(authController.login, {
      email: legacyAdmin.email,
      password: legacyAdmin.password,
    })).status,
    200
  );
  legacyAdmin.loginAttempts = 4;
  legacyAdmin.lockUntil = new Date(Date.now() - 1000);
  await legacyAdmin.save();
  const expiredLockLogin = await invoke(authController.login, {
    email: legacyAdmin.email,
    password: legacyAdmin.password,
  });
  assert.equal(expiredLockLogin.status, 200);
  const expiredLockLoginState = savedAuthStates.get(legacyAdmin.email).at(-1);
  assert.equal(expiredLockLoginState.loginAttempts, 0);
  assert.equal(expiredLockLoginState.lockUntil, null);

  legacyAdmin.lockUntil = new Date(Date.now() + 60_000);
  await legacyAdmin.save();
  const lockedLogin = await invoke(authController.login, {
    email: legacyAdmin.email,
    password: legacyAdmin.password,
  });
  assert.equal(lockedLogin.status, 423);
  assert.match(lockedLogin.body.message, /Account temporarily locked/);
  assert.ok(lockedLogin.body.retryAfterSeconds > 0);
  assert.match(lockedLogin.body.message, new RegExp(`${lockedLogin.body.retryAfterSeconds} seconds`));

  legacyAdmin.lockUntil = new Date(Date.now() - 1000);
  await legacyAdmin.save();
  assert.equal(
    (await invoke(authController.login, {
      email: legacyAdmin.email,
      password: 'Wrong123',
    })).status,
    401
  );
  assert.equal(users.get(legacyAdmin.email).loginAttempts, 0);
  assert.ok(users.get(legacyAdmin.email).lockUntil > new Date());

  const concurrentAdmin = await FakeUser.create({
    name: 'Concurrent Admin',
    email: 'concurrent-admin@example.com',
    password: 'Admin123',
    role: 'admin',
  });
  const concurrentFailures = await Promise.all(
    Array.from({ length: 5 }, () =>
      invoke(authController.login, {
        email: concurrentAdmin.email,
        password: 'Wrong123',
      })
    )
  );
  assert.ok(
    concurrentFailures.every((result) => [401, 423].includes(result.status))
  );
  assert.ok(users.get(concurrentAdmin.email).lockUntil > new Date());
  assert.equal(users.get(concurrentAdmin.email).loginAttempts, 0);

  const duplicate = await invoke(authController.register, {
    name: 'Duplicate',
    email: user.email,
    password: 'Other123',
    phone: '+91 98765-43210',
    whatsappNumber: '+1 (415) 555-2671',
  });
  assert.equal(duplicate.status, 409);
  assert.equal(users.size, 3);

  const expiredRegistration = await invoke(authController.register, {
    name: 'Expired Test User',
    email: 'expired-test@example.com',
    password: 'Pass123',
    phone: '9876543210',
    whatsappNumber: '9876543210',
  });
  const expiredUser = users.get('expired-test@example.com');
  const expiredOtp = extractOtp(sentEmails[2]);
  assert.equal(expiredRegistration.status, 202);
  expiredUser.emailOtpExpiresAt = new Date(Date.now() - 1000);
  await expiredUser.save();
  assert.equal(
    (await invoke(authController.verifyEmail, {
      email: expiredUser.email,
      otp: expiredOtp,
    })).status,
    410
  );
  assert.equal(expiredUser.emailVerified, false);

  await invoke(authController.register, {
    name: 'Resend Limit User',
    email: 'resend-limit@example.com',
    password: 'Pass123',
    phone: '9876543210',
    whatsappNumber: '9876543210',
  });
  const resendLimitUser = users.get('resend-limit@example.com');
  for (let resend = 0; resend < 4; resend += 1) {
    resendLimitUser.emailOtpResendAvailableAt = new Date(Date.now() - 1000);
    await resendLimitUser.save();
    assert.equal(
      (await invoke(authController.resendEmailOtp, {
        email: resendLimitUser.email,
      })).status,
      200
    );
  }
  resendLimitUser.emailOtpResendAvailableAt = new Date(Date.now() - 1000);
  await resendLimitUser.save();
  assert.equal(
    (await invoke(authController.resendEmailOtp, {
      email: resendLimitUser.email,
    })).status,
    429
  );

  failEmailDelivery = true;
  const failedDelivery = await invoke(authController.register, {
    name: 'Email Failure User',
    email: 'email-failure@example.com',
    password: 'Pass123',
    phone: '9876543210',
    whatsappNumber: '9876543210',
  });
  const pendingFailureUser = users.get('email-failure@example.com');
  assert.equal(failedDelivery.status, 503);
  assert.equal(pendingFailureUser.emailVerified, false);
  assert.equal(pendingFailureUser.emailOtpHash, undefined);

  const config = require('./config/env');
  config.RESEND_API_KEY = undefined;
  config.EMAIL_FROM = undefined;
  delete require.cache[emailServicePath];
  const emailService = require('./utils/emailService');
  await assert.rejects(
    emailService.sendVerificationEmail({
      to: 'test@example.com',
      subject: 'Test',
      html: '<p>Test</p>',
    }),
    (error) =>
      error.code === 'EMAIL_NOT_CONFIGURED' &&
      /RESEND_API_KEY and EMAIL_FROM/.test(error.message)
  );

  const unknownResend = await invoke(authController.resendEmailOtp, {
    email: 'unknown@example.com',
  });
  assert.equal(unknownResend.status, 200);
  assert.match(unknownResend.body.message, /If this address is eligible/);

  await testOtpRateLimits();
  await testRegistrationLimiterIsIndependent();
  await testLoginRateLimits();
  console.log('Email OTP registration and verification checks passed.');
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
