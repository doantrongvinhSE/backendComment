const mysql = require('mysql2/promise');

let pool;

function getPool() {
  if (!pool) {
    pool = process.env.DATABASE_URL
      ? mysql.createPool(process.env.DATABASE_URL)
      : mysql.createPool({
          host: process.env.DB_HOST || 'localhost',
          port: Number(process.env.DB_PORT || 3306),
          user: process.env.DB_USER,
          password: process.env.DB_PASSWORD,
          database: process.env.DB_NAME,
          charset: 'utf8mb4_unicode_ci',
          waitForConnections: true,
          connectionLimit: 10,
        });
  }
  return pool;
}

module.exports = { getPool };
