const { Sequelize } = require('sequelize');
const cls = require('cls-hooked');
require('dotenv').config();

// Every query inside a request joins that request's transaction (see middleware/auth.js),
// which is what carries the row-level-security context.
const namespace = cls.createNamespace('fulmile-request');
Sequelize.useCLS(namespace);

let sequelize;

if (process.env.DATABASE_URL) {
  // Production: Neon / Render / Railway — uses the full connection string
  sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false // Required for Neon's self-signed cert
      }
    },
    logging: false,
    pool: { max: 10, min: 0, acquire: 30000, idle: 10000 }
  });
} else {
  // Local development: individual env vars from .env
  sequelize = new Sequelize({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME     || 'fulmile',
    username: process.env.DB_USER     || 'postgres',
    password: process.env.DB_PASSWORD || '',
    dialect:  'postgres',
    logging:  process.env.NODE_ENV === 'development' ? console.log : false,
    pool: { max: 10, min: 2, acquire: 30000, idle: 10000 }
  });
}

// Transactions opened by controllers become savepoints of the request transaction,
// so they keep its RLS role instead of grabbing a fresh, unrestricted connection.
const openTransaction = sequelize.transaction.bind(sequelize);
sequelize.transaction = (options, autoCallback) => {
  if (typeof options === 'function') { autoCallback = options; options = {}; }
  const parent = namespace.get('transaction');
  return openTransaction({ transaction: parent && !parent.finished ? parent : undefined, ...options }, autoCallback);
};
sequelize.namespace = namespace;

module.exports = sequelize;
