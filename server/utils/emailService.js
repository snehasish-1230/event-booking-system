const nodemailer = require('nodemailer');
const env = require('../config/env');

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465,
  requireTLS: env.SMTP_PORT !== 465,
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 15000,
  ...(env.SMTP_USER && env.SMTP_PASS
    ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASS } }
    : {}),
});

const getAddress = (value) => {
  if (typeof value !== 'string') return '';
  return value.match(/<([^<>]+)>/)?.[1]?.trim().toLowerCase()
    || value.trim().toLowerCase();
};

const maskRecipient = (recipient) => {
  const address = getAddress(recipient);
  const [localPart, domain] = address.split('@');
  if (!localPart || !domain) return 'unavailable';
  return `${localPart.slice(0, 1)}***@${domain}`;
};

const sanitizeDiagnostic = (value) => {
  if (typeof value !== 'string') return undefined;
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]')
    .replace(/[\r\n]+/g, ' ')
    .slice(0, 300);
};

const logTransactionalAttempt = ({ to, info, error, recipientAccepted }) => {
  const diagnostics = {
    recipient: maskRecipient(to),
    submissionStatus: recipientAccepted ? 'accepted' : 'failed_or_rejected',
    recipientAccepted,
    messageId: info?.messageId || undefined,
    acceptedCount: Array.isArray(info?.accepted) ? info.accepted.length : 0,
    rejectedCount: Array.isArray(info?.rejected) ? info.rejected.length : 0,
    responseCode: info?.responseCode
      || error?.responseCode
      || info?.response?.match(/^\s*(\d{3})/)?.[1]
      || undefined,
    smtpCode: error?.code || undefined,
    command: info?.command || error?.command || undefined,
    response: sanitizeDiagnostic(info?.response || error?.response),
  };
  const log = recipientAccepted ? console.info : console.error;
  log('Transactional email SMTP submission result:', diagnostics);
};

const logSmtpFailure = (event, error) => {
  console.error(event, {
    code: error?.code,
    command: error?.command,
    responseCode: error?.responseCode,
    name: error?.name,
  });
};

/**
 * Sends an email via the configured SMTP transporter.
 * Failures are logged but never thrown — email errors
 * must not break the main application flow.
 */
const sendEmail = async ({ to, subject, html }) => {
  try {
    await transporter.sendMail({
      from: `"${env.SMTP_FROM_NAME}" <${env.SMTP_USER}>`,
      to,
      subject,
      html,
    });

    return { success: true };
  } catch (error) {
    logTransactionalAttempt({ to, error, recipientAccepted: false });
    return { success: false };
  }
};

/**
 * Verifies the SMTP connection at startup.
 * Logs a warning instead of crashing when SMTP is not configured
 * (typical in development mode).
 */
const verifyConnection = async () => {
  if (!env.SMTP_USER || !env.SMTP_PASS) {
    const error = new Error(
      'SMTP_USER and SMTP_PASS must be configured before production startup'
    );
    error.code = 'EMAIL_NOT_CONFIGURED';
    if (env.NODE_ENV === 'production') throw error;
    console.warn('SMTP credentials not configured — email sending is disabled');
    return false;
  }

  try {
    await transporter.verify();
    console.log('SMTP connection verified — email service is ready');
    return true;
  } catch (error) {
    logSmtpFailure('SMTP connection verification failed:', error);
    if (env.NODE_ENV === 'production') {
      const verificationError = new Error(
        'SMTP connection verification failed; check SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS'
      );
      verificationError.code = 'SMTP_VERIFICATION_FAILED';
      throw verificationError;
    }
    return false;
  }
};

const sendTransactionalEmail = async ({ to, subject, html }) => {
  if (!env.SMTP_USER || !env.SMTP_PASS) {
    console.error('Transactional email SMTP submission unavailable:', {
      recipient: maskRecipient(to),
      recipientAccepted: false,
      reason: 'SMTP credentials are not configured',
    });
    const error = new Error(
      'Email verification requires SMTP_USER and SMTP_PASS to be configured'
    );
    error.code = 'EMAIL_NOT_CONFIGURED';
    throw error;
  }

  let info;
  try {
    info = await transporter.sendMail({
      from: `"${env.SMTP_FROM_NAME}" <${env.SMTP_USER}>`,
      to,
      subject,
      html,
    });
  } catch (error) {
    logTransactionalAttempt({ to, error, recipientAccepted: false });
    throw error;
  }

  const recipient = getAddress(to);
  const acceptedRecipients = new Set((info.accepted || []).map(getAddress));
  const rejectedRecipients = new Set((info.rejected || []).map(getAddress));
  const recipientAccepted =
    acceptedRecipients.has(recipient) && !rejectedRecipients.has(recipient);
  logTransactionalAttempt({ to, info, recipientAccepted });

  if (!recipientAccepted) {
    const error = new Error('SMTP did not accept the email recipient');
    error.code = 'EMAIL_RECIPIENT_REJECTED';
    error.responseCode = info.responseCode;
    error.command = info.command;
    throw error;
  }

  return {
    submitted: true,
    messageId: info.messageId,
  };
};

const sendVerificationEmail = (options) => sendTransactionalEmail(options);
const sendPasswordResetEmail = (options) => sendTransactionalEmail(options);

module.exports = {
  sendEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  verifyConnection,
};
