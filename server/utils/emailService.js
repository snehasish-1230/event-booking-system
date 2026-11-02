const nodemailer = require('nodemailer');
const env = require('../config/env');

const EMAIL_CONNECTION_TIMEOUT_MS = 10000;
const EMAIL_GREETING_TIMEOUT_MS = 10000;
const EMAIL_SOCKET_TIMEOUT_MS = 15000;
let transporter;

const hasEmailConfiguration = () =>
  Boolean(env.EMAIL_USER && env.EMAIL_PASS && env.EMAIL_FROM);

const createTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.EMAIL_HOST,
      port: env.EMAIL_PORT,
      secure: env.EMAIL_SECURE,
      requireTLS: !env.EMAIL_SECURE,
      connectionTimeout: EMAIL_CONNECTION_TIMEOUT_MS,
      greetingTimeout: EMAIL_GREETING_TIMEOUT_MS,
      socketTimeout: EMAIL_SOCKET_TIMEOUT_MS,
      auth: {
        user: env.EMAIL_USER,
        pass: env.EMAIL_PASS,
      },
    });
  }
  return transporter;
};

const getAddress = (value) => {
  const address = typeof value === 'string' ? value : value?.address;
  if (typeof address !== 'string') return '';
  return address.match(/<([^<>]+)>/)?.[1]?.trim().toLowerCase()
    || address.trim().toLowerCase();
};

const maskRecipient = (recipient) => {
  const value = Array.isArray(recipient) ? recipient[0] : recipient;
  const address = getAddress(value);
  const [localPart, domain] = address.split('@');
  if (!localPart || !domain) return 'unavailable';
  return `${localPart.slice(0, 1)}***@${domain}`;
};

const logTransactionalAttempt = ({ to, info, error, recipientAccepted }) => {
  const diagnostics = {
    recipient: maskRecipient(to),
    submissionStatus: recipientAccepted ? 'accepted' : 'failed_or_rejected',
    recipientAccepted,
    messageId: recipientAccepted ? info?.messageId : undefined,
    acceptedCount: Array.isArray(info?.accepted) ? info.accepted.length : 0,
    rejectedCount: Array.isArray(info?.rejected) ? info.rejected.length : 0,
    responseCode: info?.responseCode || error?.responseCode || undefined,
    smtpCode: error?.code || undefined,
    errorName: error?.name || undefined,
  };
  (recipientAccepted ? console.info : console.error)(
    'Transactional email SMTP submission result:',
    diagnostics
  );
};

const logSmtpFailure = (event, error) => {
  console.error(event, {
    name: error?.name,
    code: error?.code,
    responseCode: error?.responseCode,
  });
};

const createSafeDeliveryError = (code = 'EMAIL_DELIVERY_FAILED') => {
  const error = new Error('Email provider did not accept the recipient');
  error.code = code;
  return error;
};

const sendEmailMessage = async ({ to, subject, html }) => {
  if (!hasEmailConfiguration()) {
    const error = new Error(
      'EMAIL_USER, EMAIL_PASS, and EMAIL_FROM must be configured for email delivery'
    );
    error.code = 'EMAIL_NOT_CONFIGURED';
    throw error;
  }

  const from = env.EMAIL_FROM.includes('<')
    ? env.EMAIL_FROM
    : { name: env.EMAIL_FROM_NAME, address: env.EMAIL_FROM };
  let info;
  try {
    info = await createTransporter().sendMail({ from, to, subject, html });
  } catch (error) {
    logTransactionalAttempt({ to, error, recipientAccepted: false });
    throw createSafeDeliveryError(
      error?.code === 'EAUTH' ? 'EMAIL_AUTH_FAILED' : 'EMAIL_DELIVERY_FAILED'
    );
  }

  const recipient = getAddress(to);
  const acceptedRecipients = new Set((info.accepted || []).map(getAddress));
  const rejectedRecipients = new Set((info.rejected || []).map(getAddress));
  const recipientAccepted =
    acceptedRecipients.has(recipient) && !rejectedRecipients.has(recipient);
  logTransactionalAttempt({ to, info, recipientAccepted });

  if (!recipientAccepted) {
    throw createSafeDeliveryError('EMAIL_RECIPIENT_REJECTED');
  }

  return {
    submitted: true,
    messageId: info.messageId,
  };
};

const sendEmail = async (options) => {
  try {
    await sendEmailMessage(options);
    return { success: true };
  } catch {
    return { success: false };
  }
};

const verifyConnection = async () => {
  if (!hasEmailConfiguration()) {
    const error = new Error(
      'EMAIL_USER, EMAIL_PASS, and EMAIL_FROM must be configured before production startup'
    );
    error.code = 'EMAIL_NOT_CONFIGURED';
    if (env.NODE_ENV === 'production') throw error;
    console.warn('Gmail SMTP configuration is incomplete — email sending is disabled');
    return false;
  }

  try {
    await createTransporter().verify();
    console.info('Gmail SMTP connection verified — email service is ready');
    return true;
  } catch (error) {
    logSmtpFailure('Gmail SMTP connection verification failed:', error);
    if (env.NODE_ENV === 'production') {
      const verificationError = new Error(
        'Gmail SMTP connection verification failed; check email configuration and Gmail App Password'
      );
      verificationError.code = 'SMTP_VERIFICATION_FAILED';
      throw verificationError;
    }
    return false;
  }
};

const sendVerificationEmail = (options) => sendEmailMessage(options);
const sendPasswordResetEmail = (options) => sendEmailMessage(options);

module.exports = {
  sendEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  verifyConnection,
};
