const env = require('../config/env');

const RESEND_API_URL = 'https://api.resend.com/emails';
const EMAIL_REQUEST_TIMEOUT_MS = 10000;

const createEmailError = (code, message) => {
  const error = new Error(message);
  error.code = code;
  return error;
};

const hasEmailConfiguration = () =>
  Boolean(env.RESEND_API_KEY && env.EMAIL_FROM);

const logEmailFailure = (error, status) => {
  console.error('Resend email submission failed:', {
    code: error.code || 'EMAIL_DELIVERY_FAILED',
    status,
    errorName: error.name,
  });
};

const sendEmailMessage = async ({ to, subject, html }) => {
  if (!hasEmailConfiguration()) {
    const error = createEmailError(
      'EMAIL_NOT_CONFIGURED',
      'RESEND_API_KEY and EMAIL_FROM must be configured for email delivery'
    );
    logEmailFailure(error);
    throw error;
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    EMAIL_REQUEST_TIMEOUT_MS
  );
  let response;

  try {
    response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
      }),
      signal: controller.signal,
    });
  } catch (cause) {
    const error = createEmailError(
      cause.name === 'AbortError'
        ? 'EMAIL_REQUEST_TIMEOUT'
        : 'EMAIL_NETWORK_ERROR',
      cause.name === 'AbortError'
        ? 'Email provider request timed out'
        : 'Unable to reach the email provider'
    );
    logEmailFailure(error);
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  let result;
  try {
    result = await response.json();
  } catch {
    result = null;
  }

  if (!response.ok) {
    const error = createEmailError(
      response.status === 401 || response.status === 403
        ? 'EMAIL_PROVIDER_AUTH_FAILED'
        : response.status === 422
          ? 'EMAIL_REQUEST_REJECTED'
          : response.status === 429
            ? 'EMAIL_RATE_LIMITED'
            : 'EMAIL_DELIVERY_FAILED',
      'Email provider did not accept the message'
    );
    logEmailFailure(error, response.status);
    throw error;
  }

  if (typeof result?.id !== 'string' || !result.id) {
    const error = createEmailError(
      'EMAIL_INVALID_PROVIDER_RESPONSE',
      'Email provider returned an invalid submission response'
    );
    logEmailFailure(error, response.status);
    throw error;
  }

  console.info('Resend accepted email submission:', {
    messageId: result.id,
  });

  return {
    submitted: true,
    messageId: result.id,
  };
};

const sendEmail = async (options) => {
  try {
    const submission = await sendEmailMessage(options);
    return { success: true, ...submission };
  } catch {
    return { success: false, submitted: false };
  }
};

const verifyConnection = async () => {
  if (!hasEmailConfiguration()) {
    const error = createEmailError(
      'EMAIL_NOT_CONFIGURED',
      'RESEND_API_KEY and EMAIL_FROM must be configured'
    );
    if (env.NODE_ENV === 'production') throw error;
    console.warn('Resend email configuration is incomplete');
    return false;
  }

  console.info('Resend email configuration is ready');
  return true;
};

module.exports = {
  sendEmail,
  sendVerificationEmail: sendEmailMessage,
  sendPasswordResetEmail: sendEmailMessage,
  verifyConnection,
};
