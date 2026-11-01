const { validationResult } = require('express-validator');

/**
 * Centralized validation middleware.
 * Checks express-validator results and returns structured error response.
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map((err) => ({
      field: err.path,
      message: err.msg,
    }));

    return res.status(400).json({
      success: false,
      message: `Validation failed: ${formattedErrors
        .map(({ field, message }) => `${field}: ${message}`)
        .join('; ')}`,
      errors: formattedErrors,
    });
  }

  next();
};

module.exports = validate;
