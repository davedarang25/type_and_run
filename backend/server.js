
/**
 * Type-to-Run Express API
 *
 * node server.js       -> starts the server
 * require('./server')  -> exports the Express app for tests
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');

const { pool } = require('./config/database');

const {
  notFound,
  errorHandler,
} = require('./middleware/errors');

const app = express();

// Allowed deployed frontend origins.
const origins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

// Allow localhost and private network addresses during development.
const allowLocal =
  process.env.CORS_ALLOW_LOCAL !== 'false';

const LOCAL_ORIGIN =
  /^https?:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/;

// CORS configuration.
app.use(
  cors({
    origin(origin, done) {
      if (
        !origin ||
        origins.includes(origin) ||
        (allowLocal && LOCAL_ORIGIN.test(origin))
      ) {
        return done(null, true);
      }

      return done(null, false);
    },
  })
);

// Parse JSON request bodies.
app.use(express.json({ limit: '20kb' }));

// Health check.
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
  });
});

// API routes.
app.use(
  '/api/users',
  require('./routes/userRoutes')
);

app.use(
  '/api/ghosts',
  require('./routes/ghostRoutes')
);

app.use(
  '/api/game',
  require('./routes/gameRoutes')
);

// Error handling.
app.use(notFound);
app.use(errorHandler);

// Start server only when executed directly.
if (require.main === module) {
  const port = Number(process.env.PORT || 3000);

  pool
    .query('SELECT 1')
    .then(() => {
      app.listen(port, '0.0.0.0', () => {
        console.log(
          `Type-to-Run API running on port ${port}`
        );
      });
    })
    .catch((err) => {
      console.error(
        `Cannot reach PostgreSQL: ${err.code || err.message}`
      );

      console.error(
        'Check DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, and DB_NAME in backend/.env'
      );

      process.exit(1);
    });
}

module.exports = app;
