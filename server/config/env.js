const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
const emailPort = Number(process.env.EMAIL_PORT || process.env.SMTP_PORT || 587);
const emailSecureValue = process.env.EMAIL_SECURE ?? process.env.SMTP_SECURE;

const env = {
  PORT: process.env.PORT || 5002,
  NODE_ENV: process.env.NODE_ENV || 'development',
  MONGODB_URI: mongoUri || 'mongodb://localhost:27017/event-booking',
  MONGO_URI: mongoUri || 'mongodb://localhost:27017/event-booking',
  JWT_SECRET: process.env.JWT_SECRET,
  EMAIL_OTP_SECRET: process.env.EMAIL_OTP_SECRET || process.env.JWT_SECRET,
  JWT_EXPIRE: process.env.JWT_EXPIRE || '7d',
  CLIENT_URL:
    process.env.CLIENT_URL ||
    (process.env.NODE_ENV === 'production'
      ? 'https://event-booking-system-bc862y17v-ff-team8.vercel.app'
      : 'http://localhost:5175,http://localhost:5173'),
  EMAIL_HOST: process.env.EMAIL_HOST || process.env.SMTP_HOST || 'smtp.gmail.com',
  EMAIL_PORT: emailPort,
  EMAIL_SECURE:
    emailSecureValue === undefined
      ? emailPort === 465
      : emailSecureValue.toLowerCase() === 'true',
  EMAIL_USER: process.env.EMAIL_USER || process.env.SMTP_USER,
  EMAIL_PASS: process.env.EMAIL_PASS || process.env.SMTP_PASS,
  EMAIL_FROM:
    process.env.EMAIL_FROM || process.env.EMAIL_USER || process.env.SMTP_USER,
  EMAIL_FROM_NAME:
    process.env.EMAIL_FROM_NAME || process.env.SMTP_FROM_NAME || 'EventBooking',
  UPLOAD_MAX_SIZE: parseInt(process.env.UPLOAD_MAX_SIZE, 10) || 5242880,
  UPI_ID: process.env.UPI_ID || 'merchant@upi',
  PAYMENT_QR_URL: process.env.PAYMENT_QR_URL || '',
  MAX_PAYMENT_SCREENSHOT_SIZE_MB: parseInt(process.env.MAX_PAYMENT_SCREENSHOT_SIZE_MB, 10) || 5,
};

const isProduction = env.NODE_ENV === 'production';

if (isProduction) {
  if (!mongoUri) {
    throw new Error('MONGODB_URI must be set in production');
  }

  if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) {
    throw new Error(
      'JWT_SECRET must be set and at least 32 characters in production'
    );
  }

  if (!env.EMAIL_USER || !env.EMAIL_PASS) {
    throw new Error('EMAIL_USER and EMAIL_PASS must be set in production');
  }

  if (!env.EMAIL_FROM) {
    throw new Error('EMAIL_FROM must be set in production');
  }

  if (![465, 587].includes(env.EMAIL_PORT)) {
    throw new Error('EMAIL_PORT must be 465 or 587 for Gmail SMTP');
  }

  if (env.EMAIL_SECURE !== (env.EMAIL_PORT === 465)) {
    throw new Error('EMAIL_SECURE must be true for port 465 and false for port 587');
  }
}

module.exports = env;
