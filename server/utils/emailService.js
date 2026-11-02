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

const sanitizeProviderMessage = (message) => {
  if (typeof message !== 'string') return undefined;

  return message
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[redacted email]')
    .replace(/\bBearer\s+\S+/gi, '[redacted credential]')
    .replace(/\bre_[A-Za-z0-9_-]+\b/gi, '[redacted credential]')
    .replace(/\b\d{6}\b/g, '[redacted code]')
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .slice(0, 300);
};

const getProviderCode = (result) => {
  const code = result?.name || result?.code;
  return typeof code === 'string' && /^[A-Za-z0-9_.-]{1,80}$/.test(code)
    ? code
    : undefined;
};

const getHttpErrorCode = (status) => {
  if (status === 401) return 'EMAIL_PROVIDER_AUTH_FAILED';
  if (status === 403) return 'EMAIL_PROVIDER_FORBIDDEN';
  if (status === 422) return 'EMAIL_REQUEST_REJECTED';
  if (status === 429) return 'EMAIL_RATE_LIMITED';
  if (status >= 500) return 'EMAIL_PROVIDER_ERROR';
  return 'EMAIL_DELIVERY_FAILED';
};

const logEmailFailure = (error, status, providerCode, providerMessage) => {
  console.error('Resend email submission failed:', {
    code: error.code || 'EMAIL_DELIVERY_FAILED',
    status,
    providerCode,
    diagnostic: sanitizeProviderMessage(providerMessage),
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
  let result;

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
    try {
      result = await response.json();
    } catch {
      result = null;
    }
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

  if (!response.ok) {
    const error = createEmailError(
      getHttpErrorCode(response.status),
      'Email provider did not accept the message'
    );
    logEmailFailure(
      error,
      response.status,
      getProviderCode(result),
      result?.message
    );
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
