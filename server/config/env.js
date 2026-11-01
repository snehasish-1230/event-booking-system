const env = {
  PORT: process.env.PORT || 5002,
  NODE_ENV: process.env.NODE_ENV || 'development',
  MONGO_URI:
    process.env.MONGO_URI || 'mongodb://localhost:27017/event-booking',
  JWT_SECRET: process.env.JWT_SECRET,
  EMAIL_OTP_SECRET: process.env.EMAIL_OTP_SECRET || process.env.JWT_SECRET,
  JWT_EXPIRE: process.env.JWT_EXPIRE || '7d',
  CLIENT_URL:
    process.env.CLIENT_URL ||
    (process.env.NODE_ENV === 'production'
      ? 'https://event-booking-system-3jw3p0uq2-ff-team8.vercel.app,https://event-booking-system-xi-two.vercel.app'
      : 'http://localhost:5175,http://localhost:5173'),
  SMTP_HOST: process.env.SMTP_HOST || 'smtp.gmail.com',
  SMTP_PORT:
    process.env.SMTP_PORT === undefined ? 465 : Number(process.env.SMTP_PORT),
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  SMTP_FROM_NAME: process.env.SMTP_FROM_NAME || 'EventBooking',
  UPLOAD_MAX_SIZE: parseInt(process.env.UPLOAD_MAX_SIZE, 10) || 5242880,
  UPI_ID: process.env.UPI_ID || 'merchant@upi',
  PAYMENT_QR_URL: process.env.PAYMENT_QR_URL || '',
  MAX_PAYMENT_SCREENSHOT_SIZE_MB: parseInt(process.env.MAX_PAYMENT_SCREENSHOT_SIZE_MB, 10) || 5,
};

const isProduction = env.NODE_ENV === 'production';

if (isProduction) {
  if (![465, 587].includes(env.SMTP_PORT)) {
    throw new Error('SMTP_PORT must be 465 or 587 for Gmail SMTP');
  }

  if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) {
    throw new Error(
      'JWT_SECRET must be set and at least 32 characters in production'
    );
  }

  if (!env.SMTP_USER) {
    throw new Error('SMTP_USER must be set in production');
  }

  if (!env.SMTP_PASS) {
    throw new Error('SMTP_PASS must be set in production');
  }
}

module.exports = env;
