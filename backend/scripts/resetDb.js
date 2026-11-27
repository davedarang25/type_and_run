// Drops and recreates all 10 tables, then loads the game content.
// Usage: npm run db:reset   (creates DB_NAME first if it doesn't exist)
require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const mysql = require('mysql2/promise');

async function resetDb(dbName = process.env.DB_NAME || 'type_and_run') {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
  });
  try {
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await conn.query(`USE \`${dbName}\``);
    for (const file of ['schema.sql', 'seed.sql']) {
      await conn.query(fs.readFileSync(path.join(__dirname, '..', 'database', file), 'utf8'));
    }
  } finally {
    await conn.end();
  }
}

if (require.main === module) {
  resetDb()
    .then(() => console.log(`Database ${process.env.DB_NAME || 'type_and_run'} reset: schema + seed loaded.`))
    .catch((err) => {
      console.error(err.message);
      process.exit(1);
    });
}

module.exports = { resetDb };
