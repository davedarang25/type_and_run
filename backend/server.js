// Express app for the Type-to-Run API.
//   node server.js       → starts listening on PORT
//   require('./server')  → just the app (used by the tests)
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { pool } = require('./config/database');
const { notFound, errorHandler } = require('./middleware/errors');

const app = express();
const origins = (process.env.CORS_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);
app.use(cors({ origin: origins.length ? origins : true }));
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
    .then(() => app.listen(port, () => console.log(`Type-to-Run API on http://localhost:${port}/api`)))
    .catch((err) => {
      console.error(`Cannot reach MySQL (${err.code || err.message}). Check DB_* in backend/.env.`);
      process.exit(1);
    });
}

module.exports = app;
