
/**
 * Type-to-Run
 * PostgreSQL connection pool
 */

const path = require('path');

require('dotenv').config({
  path: path.join(__dirname, '../.env'),
});

console.log('PostgreSQL config:', {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL,
  passwordLoaded: Boolean(process.env.DB_PASSWORD),
});

const { Pool, types } = require('pg');

// Convert PostgreSQL DECIMAL / NUMERIC values into JavaScript numbers.
types.setTypeParser(1700, (value) => Number(value));

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || 'type_and_run_user',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'type_and_run',

  ssl:
    process.env.DB_SSL === 'true'
      ? { rejectUnauthorized: false }
      : undefined,

  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

/**
 * Runs a function inside a PostgreSQL transaction.
 *
 * Usage:
 * await withTransaction(async (client) => {
 *   await client.query('...');
 * });
 */
async function withTransaction(fn) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const result = await fn(client);

    await client.query('COMMIT');

    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      // Preserve the original transaction error.
    }

    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  withTransaction,
};
