// Express app for the Type-to-Run API.
//   node server.js       → starts listening on PORT
//   require('./server')  → just the app (used by the tests)
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { pool } = require('./config/database');
const { notFound, errorHandler } = require('./middleware/errors');

const app = express();
// Browsers may call the API from: any origin listed in CORS_ORIGIN, plus (by default) any
// localhost / private-network address on any port — so the React dev server and Flutter web
// (which picks a random port) both work without extra setup. Native Flutter apps don't use CORS.
const origins = (process.env.CORS_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);
const allowLocal = process.env.CORS_ALLOW_LOCAL !== 'false';
const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/;
app.use(
  cors({
    origin(origin, done) {
      if (!origin || origins.includes(origin) || (allowLocal && LOCAL_ORIGIN.test(origin))) return done(null, true);
      done(null, false);
    },
  }),
);
app.use(express.json({ limit: '20kb' }));

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/ghosts', require('./routes/ghostRoutes'));
app.use('/api/game', require('./routes/gameRoutes'));

app.use(notFound);
app.use(errorHandler);

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  pool
    .query('SELECT 1')
    .then(() => app.listen(port, '0.0.0.0', () => console.log(`Type-to-Run API on http://localhost:${port}/api`)))
    .catch((err) => {
      console.error(`Cannot reach MySQL (${err.code || err.message}). Check DB_* in backend/.env.`);
      process.exit(1);
    });
}

module.exports = app;
