const app = require('./app');
const mongoose = require('mongoose');
const { connectDatabase } = require('./config/database');
const env = require('./config/env');
const logger = require('./utils/logger');

async function start() {
  try {
    await connectDatabase();

    const server = app.listen(env.PORT, () => {
      logger.info(`Doctor Tracker API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
    });

    // graceful shutdown so in-flight requests finish and Mongo closes cleanly
    const shutdown = async (signal) => {
      logger.info(`${signal} received — shutting down`);
      server.close(async () => {
        await mongoose.connection.close();
        process.exit(0);
      });
    };
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (err) {
    logger.error('Failed to start server:', err?.mongoDiagnostic || 'MongoDB connection failed. Check URI, credentials, DNS, and network access.');
    process.exit(1);
  }
}

start();
