const { Client } = require('pg');
require('dotenv').config();

const createDb = async () => {
  const connectionString = `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/postgres`;
  const client = new Client({ connectionString });

  try {
    await client.connect();
    console.log('Connected to postgres database. Checking database fulmile...');
    
    const res = await client.query("SELECT 1 FROM pg_database WHERE datname = 'fulmile'");
    if (res.rowCount === 0) {
      console.log('Database fulmile does not exist. Creating...');
      await client.query('CREATE DATABASE fulmile');
      console.log('Database fulmile created successfully.');
    } else {
      console.log('Database fulmile already exists.');
    }
  } catch (err) {
    console.error('Error creating database:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
};

createDb();
