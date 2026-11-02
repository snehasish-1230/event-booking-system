const assert = require('node:assert/strict');
const env = require('./config/env');
const errorHandler = require('./middlewares/errorHandler');
const AppError = require('./utils/AppError');

const originalError = console.error;
const logs = [];
console.error = (...args) => logs.push(args);

const invoke = (error) => {
  let statusCode;
  let responseBody;
  const headers = {};
  const res = {
    setHeader(name, value) {
      headers[name] = value;
    },
    status(status) {
      statusCode = status;
      return this;
    },
    json(body) {
      responseBody = body;
      return this;
    },
  };

  errorHandler(
    error,
    { method: 'GET', path: '/api/private' },
    res,
    () => assert.fail('Error handler must not call next')
  );
  return { statusCode, responseBody, headers };
};

try {
  env.NODE_ENV = 'development';
  const developmentError = new Error('sensitive database failure');
  const developmentResponse = invoke(developmentError);
  assert.equal(developmentResponse.statusCode, 500);
  assert.equal(developmentResponse.responseBody.message, 'Internal server error');
  assert.equal('stack' in developmentResponse.responseBody, false);
  assert.ok(logs.some(([, error]) => error === developmentError));

  env.NODE_ENV = 'production';
  const productionResponse = invoke(new Error('private production detail'));
  assert.equal(productionResponse.responseBody.message, 'Internal server error');
  assert.equal('stack' in productionResponse.responseBody, false);

  const operationalError = new AppError('Email temporarily unavailable', 503);
  operationalError.retryAfterSeconds = 30;
  const operationalResponse = invoke(operationalError);
  assert.equal(operationalResponse.statusCode, 503);
  assert.equal(
    operationalResponse.responseBody.message,
    'Email temporarily unavailable'
  );
  assert.equal(operationalResponse.headers['Retry-After'], '30');

  console.log('Error response sanitization checks passed.');
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  console.error = originalError;
}
