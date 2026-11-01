const assert = require('assert/strict');

process.env.JWT_SECRET = 'test-password-reset-jwt-secret-at-least-thirty-two';
process.env.EMAIL_OTP_SECRET = 'test-password-reset-hmac-secret';
process.env.RESEND_API_KEY = 're_test-only-key';
process.env.EMAIL_FROM = 'EventBooking <sender@example.test>';
process.env.NODE_ENV = 'test';

const userPath = require.resolve('./models/User');
const resetPath = require.resolve('./models/PasswordReset');
const emailServicePath = require.resolve('./utils/emailService');
const users = new Map();
const resetRequests = new Map();
const sentEmails = [];
let nextId = 1;
let failEmail = false;

const matches = (document, filter = {}) => {
  if (!document) return false;
  return Object.entries(filter).every(([key, expected]) => {
    if (key === '$or') return expected.some((condition) => matches(document, condition));
    if (key === '$and') return expected.every((condition) => matches(document, condition));
    const actual = document[key];
    if (expected && typeof expected === 'object' && !(expected instanceof Date)) {
      if ('$exists' in expected && (actual !== undefined) !== expected.$exists) return false;
      if ('$gt' in expected && !(actual > expected.$gt)) return false;
      if ('$lt' in expected && !(actual < expected.$lt)) return false;
      if ('$lte' in expected && !(actual <= expected.$lte)) return false;
      if ('$in' in expected && !expected.$in.some((value) => value === actual || (value === null && actual === undefined))) return false;
      if ('$eq' in expected) {
        const equal = actual instanceof Date && expected.$eq instanceof Date
          ? actual.getTime() === expected.$eq.getTime()
          : actual === expected.$eq;
        if (!equal) return false;
      }
      return true;
    }
    if (actual instanceof Date && expected instanceof Date) {
      return actual.getTime() === expected.getTime();
    }
    if (expected === null) return actual == null;
    return actual === expected;
  });
};

const makeQuery = (value) => ({
  select: async () => value,
  then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
});

const cloneDocument = (document) =>
  document
    ? Object.fromEntries(
        Object.entries(document).map(([key, value]) => [
          key,
          value instanceof Date ? new Date(value) : value,
        ])
      )
    : null;

class FakeUser {
  constructor(data) {
    Object.assign(this, data);
    this._id ||= String(nextId++);
    this.isActive ??= true;
    this.emailVerified ??= true;
  }

  async save() {
    users.set(this.email, this);
    return this;
  }

  async comparePassword(candidate) {
    return this.password === candidate;
  }

  static findOne(filter) {
    return makeQuery([...users.values()].find((user) => matches(user, filter)) || null);
  }

  static findById(id) {
    return makeQuery([...users.values()].find((user) => user._id === id) || null);
  }

  static async updateOne(filter, update) {
    const user = [...users.values()].find((item) => matches(item, filter));
    if (!user) return { matchedCount: 0, modifiedCount: 0 };
    Object.assign(user, update.$set || {});
    return { matchedCount: 1, modifiedCount: 1 };
  }
}

class FakePasswordReset {
  constructor(data) {
    Object.assign(this, data);
    this._id ||= String(nextId++);
  }

  async save() {
    resetRequests.set(this.user, this);
    return this;
  }

  static create(data) {
    if (resetRequests.has(data.user)) {
      const error = new Error('Duplicate user reset request');
      error.code = 11000;
      throw error;
    }
    const reset = new FakePasswordReset(data);
    resetRequests.set(reset.user, reset);
    return reset;
  }

  static findOne(filter) {
    const reset = [...resetRequests.values()].find((item) => matches(item, filter));
    return makeQuery(cloneDocument(reset));
  }

  static findOneAndUpdate(filter, update) {
    const reset = [...resetRequests.values()].find((item) => matches(item, filter));
    if (reset) FakePasswordReset.applyUpdate(reset, update);
    return makeQuery(cloneDocument(reset));
  }

  static async updateOne(filter, update) {
    const reset = [...resetRequests.values()].find((item) => matches(item, filter));
    if (!reset) return { modifiedCount: 0 };
    FakePasswordReset.applyUpdate(reset, update);
    return { modifiedCount: 1 };
  }

  static applyUpdate(reset, update) {
    for (const [key, value] of Object.entries(update.$set || {})) {
      reset[key] = value;
    }
    for (const key of Object.keys(update.$unset || {})) {
      delete reset[key];
    }
    for (const [key, value] of Object.entries(update.$inc || {})) {
      reset[key] = (reset[key] || 0) + value;
    }
  }
}

require.cache[userPath] = {
  id: userPath,
  filename: userPath,
  loaded: true,
  exports: FakeUser,
};
require.cache[resetPath] = {
  id: resetPath,
  filename: resetPath,
  loaded: true,
  exports: FakePasswordReset,
};
require.cache[emailServicePath] = {
  id: emailServicePath,
  filename: emailServicePath,
  loaded: true,
  exports: {
    sendPasswordResetEmail: async ({ html }) => {
      if (failEmail) throw new Error('Simulated SMTP failure');
      sentEmails.push(html);
    },
    sendVerificationEmail: async () => {},
    sendEmail: async () => ({ success: true }),
    verifyConnection: async () => {},
  },
};

const authController = require('./controllers/authController');
const resetController = require('./controllers/passwordResetController');

const invoke = async (handler, body) => {
  let statusCode;
  let responseBody;
  let error;
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
  await handler({ body }, res, (nextError) => {
    error = nextError;
  });
  return error
    ? { status: error.statusCode || 500, body: { message: error.message } }
    : { status: statusCode, body: responseBody };
};

const extractOtp = (html) => html.match(/letter-spacing:10px;">(\d{6})<\/p>/)?.[1];

const testValidation = async () => {
  const {
    resetPasswordRules,
    verifyPasswordResetOtpRules,
  } = require('./validators/authValidator');
  const { validationResult } = require('express-validator');
  const validateBody = async (rules, body) => {
    const req = { body };
    await Promise.all(rules.map((rule) => rule.run(req)));
    return validationResult(req).array().map((issue) => issue.msg);
  };

  assert.ok(
    (await validateBody(resetPasswordRules, {
      resetToken: 'token',
      newPassword: 'weak',
      confirmPassword: 'weak',
    })).some((message) => /uppercase/.test(message))
  );
  assert.ok(
    (await validateBody(resetPasswordRules, {
      resetToken: 'token',
      newPassword: 'Strong123',
      confirmPassword: 'Different123',
    })).some((message) => /Passwords do not match/.test(message))
  );
  assert.ok(
    (await validateBody(verifyPasswordResetOtpRules, {
      email: 'reset-test@example.com',
      otp: '',
    })).length > 0
  );
};

const run = async () => {
  await FakeUser.prototype.save.call(
    new FakeUser({
      _id: 'user-reset',
      name: 'Reset User',
      email: 'reset-test@example.com',
      password: 'OldPass123',
      emailVerified: true,
      isActive: true,
    })
  );

  const unknown = await invoke(resetController.requestPasswordReset, {
    email: 'unknown@example.com',
  });
  assert.equal(unknown.status, 202);
  assert.equal(unknown.body.data.otp, undefined);
  assert.equal(sentEmails.length, 0);

  const requested = await invoke(resetController.requestPasswordReset, {
    email: 'reset-test@example.com',
  });
  assert.equal(requested.status, 202);
  assert.match(requested.body.message, /If an active account exists/);
  assert.equal(requested.body.data.resetToken, undefined);
  assert.equal(sentEmails.length, 1);
  assert.deepEqual(unknown.body, requested.body);
  const originalOtp = extractOtp(sentEmails[0]);
  const user = users.get('reset-test@example.com');
  const reset = resetRequests.get(user._id);
  assert.match(originalOtp, /^\d{6}$/);
  assert.notEqual(reset.otpHash, originalOtp);
  assert.equal(reset.resetTokenHash, undefined);

  assert.equal(
    (await invoke(resetController.resetPassword, {
      resetToken: 'not-verified',
      newPassword: 'NewPass123',
      confirmPassword: 'NewPass123',
    })).status,
    401
  );
  assert.equal(user.password, 'OldPass123');

  const wrong = originalOtp === '000000' ? '000001' : '000000';
  const wrongAttempts = [];
  for (let attempt = 0; attempt < 5; attempt += 1) {
    wrongAttempts.push(
      await invoke(resetController.verifyPasswordResetOtp, {
        email: user.email,
        otp: wrong,
      })
    );
  }
  assert.deepEqual(wrongAttempts.map((result) => result.status), [400, 400, 400, 400, 429]);

  reset.resendAvailableAt = new Date(Date.now() - 1000);
  const resendResults = await Promise.all([
    invoke(resetController.resendPasswordResetOtp, { email: user.email }),
    invoke(resetController.resendPasswordResetOtp, { email: user.email }),
  ]);
  assert.ok(resendResults.every((result) => result.status === 200));
  assert.equal(sentEmails.length, 2);
  const replacementOtp = extractOtp(sentEmails[1]);
  assert.notEqual(replacementOtp, originalOtp);
  assert.equal(
    (await invoke(resetController.verifyPasswordResetOtp, {
      email: user.email,
      otp: originalOtp,
    })).status,
    400
  );
  const verified = await invoke(resetController.verifyPasswordResetOtp, {
    email: user.email,
    otp: replacementOtp,
  });
  assert.equal(verified.status, 200);
  const resetToken = verified.body.data.resetToken;
  assert.equal(typeof resetToken, 'string');
  assert.equal(verified.body.data.token, undefined);
  assert.equal(reset.otpHash, undefined);
  assert.ok(reset.resetTokenHash);
  assert.notEqual(reset.resetTokenHash, resetToken);

  const resetResponse = await invoke(resetController.resetPassword, {
    resetToken,
    newPassword: 'NewPass123',
    confirmPassword: 'NewPass123',
  });
  assert.equal(resetResponse.status, 200);
  assert.equal(resetResponse.body.message, 'Your password has been reset successfully.');
  assert.equal(user.password, 'NewPass123');
  assert.equal(reset.resetTokenHash, undefined);
  assert.ok(reset.usedAt);
  assert.equal(
    (await invoke(resetController.resetPassword, {
      resetToken,
      newPassword: 'OtherPass123',
      confirmPassword: 'OtherPass123',
    })).status,
    401
  );
  assert.equal(
    (await invoke(authController.login, {
      email: user.email,
      password: 'OldPass123',
    })).status,
    401
  );
  assert.equal(
    (await invoke(authController.login, {
      email: user.email,
      password: 'NewPass123',
    })).status,
    200
  );

  await FakeUser.prototype.save.call(
    new FakeUser({
      _id: 'legacy-admin',
      name: 'Legacy Admin',
      email: 'legacy-admin@example.com',
      password: 'AdminPass123',
      role: 'admin',
      isActive: true,
    })
  );
  const legacyAdmin = users.get('legacy-admin@example.com');
  delete legacyAdmin.emailVerified;
  assert.equal(
    (await invoke(authController.login, {
      email: legacyAdmin.email,
      password: 'AdminPass123',
    })).status,
    200
  );

  await FakeUser.prototype.save.call(
    new FakeUser({
      _id: 'user-expired',
      name: 'Expired Reset User',
      email: 'expired-reset@example.com',
      password: 'OldPass123',
      emailVerified: true,
      isActive: true,
    })
  );
  await invoke(resetController.requestPasswordReset, {
    email: 'expired-reset@example.com',
  });
  const expiredUser = users.get('expired-reset@example.com');
  const expiredOtp = extractOtp(sentEmails[2]);
  const expiredRecord = resetRequests.get(expiredUser._id);
  expiredRecord.otpExpiresAt = new Date(Date.now() - 1000);
  assert.equal(
    (await invoke(resetController.verifyPasswordResetOtp, {
      email: expiredUser.email,
      otp: expiredOtp,
    })).status,
    410
  );
  assert.equal(expiredRecord.resetTokenHash, undefined);

  await FakeUser.prototype.save.call(
    new FakeUser({
      _id: 'user-expired-token',
      name: 'Expired Token User',
      email: 'expired-token@example.com',
      password: 'OldPass123',
      emailVerified: true,
      isActive: true,
    })
  );
  await invoke(resetController.requestPasswordReset, {
    email: 'expired-token@example.com',
  });
  const expiredTokenUser = users.get('expired-token@example.com');
  const expiredTokenOtp = extractOtp(sentEmails[3]);
  const expiredTokenRecord = resetRequests.get(expiredTokenUser._id);
  const expiredTokenVerification = await invoke(
    resetController.verifyPasswordResetOtp,
    { email: expiredTokenUser.email, otp: expiredTokenOtp }
  );
  assert.equal(expiredTokenVerification.status, 200);
  expiredTokenRecord.resetTokenExpiresAt = new Date(Date.now() - 1000);
  assert.equal(
    (await invoke(resetController.resetPassword, {
      resetToken: expiredTokenVerification.body.data.resetToken,
      newPassword: 'NewPass123',
      confirmPassword: 'NewPass123',
    })).status,
    401
  );
  assert.equal(expiredTokenUser.password, 'OldPass123');

  await FakeUser.prototype.save.call(
    new FakeUser({
      _id: 'user-delivery-failure',
      name: 'Mail Failure User',
      email: 'mail-failure@example.com',
      password: 'OldPass123',
      emailVerified: true,
      isActive: true,
    })
  );
  failEmail = true;
  const failedDelivery = await invoke(resetController.requestPasswordReset, {
    email: 'mail-failure@example.com',
  });
  assert.equal(failedDelivery.status, 202);
  assert.equal(failedDelivery.body.message, requested.body.message);
  assert.equal(
    resetRequests.get('user-delivery-failure').otpHash,
    undefined
  );

  await testValidation();
  await testRequestRateLimit();
  console.log('Password reset flow checks passed.');
};

const testRequestRateLimit = async () => {
  const express = require('express');
  const { passwordResetRequestLimiter } = require('./middlewares/rateLimiter');
  const app = express();
  app.post('/forgot-password', passwordResetRequestLimiter, (_req, res) => {
    res.status(200).json({ success: true });
  });
  const server = await new Promise((resolve) => {
    const listeningServer = app.listen(0, '127.0.0.1', () =>
      resolve(listeningServer)
    );
  });
  try {
    const { port } = server.address();
    const statuses = [];
    for (let attempt = 0; attempt < 11; attempt += 1) {
      const response = await fetch(`http://127.0.0.1:${port}/forgot-password`, {
        method: 'POST',
      });
      statuses.push(response.status);
      await response.arrayBuffer();
    }
    assert.equal(statuses.filter((status) => status === 200).length, 10);
    assert.equal(statuses[10], 429);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
  }
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
