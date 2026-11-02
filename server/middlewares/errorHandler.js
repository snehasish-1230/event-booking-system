const env = require('../config/env');

const isProduction = env.NODE_ENV === 'production';
const isDevelopment = env.NODE_ENV === 'development';

/**
 * Global error handler middleware.
 * Handles Mongoose, JWT, Multer, and operational errors with clean responses.
 */
const errorHandler = (err, req, res, next) => {
  if (isDevelopment) {
    console.error('Error:', err);
  }

  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let errors;

  // Mongoose invalid ObjectId
  if (err.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid resource ID';
  }

  // Mongoose validation error — collect field-specific messages
  if (err.name === 'ValidationError') {
    statusCode = 400;
    errors = Object.values(err.errors).map((fieldError) => ({
      field: fieldError.path,
      message: fieldError.message,
    }));
    message = errors
      .map(({ field, message: detail }) => `${field}: ${detail}`)
      .join('; ');
  }

  // MongoDB duplicate key
  if (err.code === 11000) {
    statusCode = 409;
    message = 'Duplicate field value entered';
  }

  // JWT invalid token
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  }

  // JWT expired
  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  }

  // Multer file upload errors
  if (err.name === 'MulterError') {
    statusCode = 400;
    message = err.message;
  }

  if (Number.isFinite(err.retryAfterSeconds) && err.retryAfterSeconds > 0) {
    res.setHeader('Retry-After', String(Math.ceil(err.retryAfterSeconds)));
  }

  if (statusCode >= 500 && !isDevelopment) {
    console.error('Unhandled API error:', {
      name: err.name,
      code: err.code,
      method: req.method,
      path: req.path,
    });
  }

  res.status(statusCode).json({
    success: false,
    message:
      statusCode >= 500 && !err.isOperational
        ? 'Internal server error'
        : message,
    ...(errors && { errors }),
    ...(Number.isFinite(err.retryAfterSeconds) && err.retryAfterSeconds > 0 && {
      retryAfterSeconds: Math.ceil(err.retryAfterSeconds),
    }),
  });
};

module.exports = errorHandler;
