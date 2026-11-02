const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
const nodeEnv = process.env.NODE_ENV || 'development';

const env = {
  PORT: process.env.PORT || 5002,
  NODE_ENV: nodeEnv,
  MONGODB_URI: mongoUri || 'mongodb://localhost:27017/event-booking',
  MONGO_URI: mongoUri || 'mongodb://localhost:27017/event-booking',
  JWT_SECRET: process.env.JWT_SECRET,
  EMAIL_OTP_SECRET:
    process.env.EMAIL_OTP_SECRET ||
    (nodeEnv === 'development' ? process.env.JWT_SECRET : undefined),
  JWT_EXPIRE: process.env.JWT_EXPIRE || '7d',
  CLIENT_URL:
    process.env.CLIENT_URL ||
    (nodeEnv === 'development'
      ? 'http://localhost:5175,http://localhost:5173'
      : ''),
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  EMAIL_FROM: process.env.EMAIL_FROM || '',
  EMAIL_FROM_NAME: process.env.EMAIL_FROM_NAME || 'EventBooking',
  UPLOAD_MAX_SIZE: parseInt(process.env.UPLOAD_MAX_SIZE, 10) || 5242880,
  UPI_ID: process.env.UPI_ID || 'merchant@upi',
  PAYMENT_QR_URL: process.env.PAYMENT_QR_URL || '',
  MAX_PAYMENT_SCREENSHOT_SIZE_MB:
    parseInt(process.env.MAX_PAYMENT_SCREENSHOT_SIZE_MB, 10) || 5,
};

const validateProductionOrigins = (clientUrl) => {
  const origins = clientUrl
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  if (!origins.length) {
    throw new Error('CLIENT_URL must contain at least one production frontend origin');
  }

  for (const origin of origins) {
    let parsedOrigin;
    try {
      parsedOrigin = new URL(origin);
    } catch {
      throw new Error('CLIENT_URL must contain valid exact origins');
    }

    if (
      parsedOrigin.protocol !== 'https:' ||
      parsedOrigin.origin !== origin ||
      parsedOrigin.username ||
      parsedOrigin.password
    ) {
      throw new Error('CLIENT_URL must contain HTTPS origins without paths or credentials');
    }
  }
};

if (nodeEnv === 'production') {
  const missingVariables = [
    ['MONGODB_URI', mongoUri],
    ['JWT_SECRET', env.JWT_SECRET],
    ['RESEND_API_KEY', env.RESEND_API_KEY],
    ['EMAIL_FROM', env.EMAIL_FROM],
    ['CLIENT_URL', env.CLIENT_URL],
    ['EMAIL_OTP_SECRET', process.env.EMAIL_OTP_SECRET],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missingVariables.length) {
    throw new Error(
      `Missing required production environment variables: ${missingVariables.join(', ')}`
    );
  }

  if (env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters in production');
  }

  if (process.env.EMAIL_OTP_SECRET.length < 32) {
    throw new Error('EMAIL_OTP_SECRET must be at least 32 characters in production');
  }

  validateProductionOrigins(env.CLIENT_URL);
}

module.exports = env;
