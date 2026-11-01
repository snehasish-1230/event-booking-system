const { Resend } = require('resend');
const env = require('../config/env');

const EMAIL_REQUEST_TIMEOUT_MS = 10000;
let resendClient;

const getResendClient = () => {
  if (!env.RESEND_API_KEY) {
    const error = new Error('RESEND_API_KEY must be configured');
    error.code = 'EMAIL_NOT_CONFIGURED';
    throw error;
  }

  if (!resendClient) {
    resendClient = new Resend(env.RESEND_API_KEY);
  }
  return resendClient;
};

const maskRecipient = (recipient) => {
  const address = Array.isArray(recipient) ? recipient[0] : recipient;
  if (typeof address !== 'string') return 'unavailable';
  const normalizedAddress =
    address.match(/<([^<>]+)>/)?.[1]?.trim().toLowerCase()
    || address.trim().toLowerCase();
  const [localPart, domain] = normalizedAddress.split('@');
  if (!localPart || !domain) return 'unavailable';
  return `${localPart.slice(0, 1)}***@${domain}`;
};

const logSubmission = ({ to, messageId, error, success }) => {
  const diagnostics = {
    recipient: maskRecipient(to),
    submissionStatus: success ? 'accepted' : 'failed_or_rejected',
    recipientAccepted: success,
    messageId: success ? messageId : undefined,
    providerError: error?.name,
    statusCode: Number.isInteger(error?.statusCode)
      ? error.statusCode
      : undefined,
  };
  (success ? console.info : console.error)(
    'Transactional email Resend submission result:',
    diagnostics
  );
};

const createDeliveryError = (code = 'EMAIL_DELIVERY_FAILED') => {
  const error = new Error('Email provider did not confirm the submission');
  error.code = code;
  return error;
};

const sendTransactionalEmail = async ({ to, subject, html }) => {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
    const error = new Error(
      'RESEND_API_KEY and EMAIL_FROM must be configured for email delivery'
    );
    error.code = 'EMAIL_NOT_CONFIGURED';
    logSubmission({ to, error, success: false });
    throw error;
  }

  let response;
  try {
    response = await getResendClient().emails.send(
      {
        from: env.EMAIL_FROM,
        to,
        subject,
        html,
      },
      { signal: AbortSignal.timeout(EMAIL_REQUEST_TIMEOUT_MS) }
    );
  } catch (error) {
    logSubmission({ to, error, success: false });
    throw createDeliveryError();
  }

  const messageId = response?.data?.id;
  if (response?.error || typeof messageId !== 'string' || !messageId) {
    logSubmission({
      to,
      error: response?.error,
      success: false,
    });
    throw createDeliveryError(
      response?.error?.statusCode === 401 ||
        response?.error?.statusCode === 403
        ? 'EMAIL_PROVIDER_AUTH_FAILED'
        : 'EMAIL_DELIVERY_FAILED'
    );
  }

  logSubmission({ to, messageId, success: true });
  return { submitted: true, messageId };
};

const sendEmail = async (options) => {
  try {
    await sendTransactionalEmail(options);
    return { success: true };
  } catch {
    return { success: false };
  }
};

const verifyConnection = async () => {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
    const error = new Error(
      'RESEND_API_KEY and EMAIL_FROM must be configured before production startup'
    );
    error.code = 'EMAIL_NOT_CONFIGURED';
    if (env.NODE_ENV === 'production') throw error;
    console.warn('Resend email configuration is incomplete — email sending is disabled');
    return false;
  }

  getResendClient();
  console.info('Resend email service configuration is ready');
  return true;
};

const sendVerificationEmail = (options) => sendTransactionalEmail(options);
const sendPasswordResetEmail = (options) => sendTransactionalEmail(options);

module.exports = {
  sendEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  verifyConnection,
};
