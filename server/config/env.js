const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;

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
      ? 'https://event-booking-system-72d4425dq-ff-team8.vercel.app,https://event-booking-system-xi-two.vercel.app,https://event-booking-system-3jw3p0uq2-ff-team8.vercel.app'
      : 'http://localhost:5175,http://localhost:5173'),
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  EMAIL_FROM: process.env.EMAIL_FROM,
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

  if (!env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY must be set in production');
  }

  if (!env.EMAIL_FROM) {
    throw new Error('EMAIL_FROM must be set in production');
  }
}

module.exports = env;
