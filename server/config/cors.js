const cors = require('cors');

const localDevelopmentOrigins = [
  'http://localhost:5173',
  'http://localhost:5175',
];

const configureCors = (app, { nodeEnv, clientUrl }) => {
  const configuredOrigins = (clientUrl || '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  const allowedOrigins = new Set([
    ...(nodeEnv === 'development' ? localDevelopmentOrigins : []),
    ...configuredOrigins,
  ]);

  app.use(
    cors({
      origin: (origin, callback) =>
        callback(null, !origin || allowedOrigins.has(origin)),
      credentials: false,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      exposedHeaders: ['Retry-After'],
    })
  );

  app.use((req, res, next) => {
    const origin = req.get('Origin');
    if (origin && !allowedOrigins.has(origin)) {
      console.warn('CORS origin rejected', {
        origin,
        method: req.method,
        path: req.originalUrl,
      });
      return res.status(403).json({
        success: false,
        message: 'Origin not allowed',
      });
    }

    next();
  });
};

module.exports = configureCors;
