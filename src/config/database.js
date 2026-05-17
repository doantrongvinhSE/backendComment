const { Sequelize } = require('sequelize');

const isTest = process.env.NODE_ENV === 'test';

function createMysqlSequelize() {
  const commonOptions = {
    dialect: 'mysql',
    logging: false,
    timezone: '+07:00',
    define: {
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci',
    },
    dialectOptions: {
      charset: 'utf8mb4',
    },
  };

  if (process.env.DATABASE_URL) {
    return new Sequelize(process.env.DATABASE_URL, commonOptions);
  }

  return new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
    ...commonOptions,
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
  });
}

const sequelize = isTest
  ? new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
  : createMysqlSequelize();

module.exports = sequelize;
