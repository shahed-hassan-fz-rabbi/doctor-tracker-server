/**
 * Development helper: starts the API against an in-memory MongoDB and seeds
 * an admin plus synthetic data so the whole stack can be shown
 * without Atlas.
 *
 *   npm run dev:memory
 *
 * Dev-only (never used in production or tests). It runs the same isolated,
 * read-only demo authentication flow against temporary synthetic data.
 */
const { MongoMemoryServer } = require('mongodb-memory-server');
const crypto = require('node:crypto');

async function devMemory() {
  // 1. start the DB first
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri('doctor-tracker-demo');

  // 2. Configure a local demo runtime before any app module reads env.js.
  process.env.NODE_ENV = 'development';
  process.env.DEMO_MODE = 'true';
  process.env.DEMO_MONGODB_URI = uri;
  process.env.DEMO_JWT_SECRET = crypto.randomBytes(32).toString('hex');
  process.env.COOKIE_NAME = 'dt_demo_token_dev';
  process.env.COOKIE_SECURE = 'false';
  process.env.PORT ||= '4000';
  for (const key of ['MONGODB_URI', 'JWT_SECRET', 'ADMIN_NAME', 'ADMIN_EMAIL', 'ADMIN_PASSWORD',
    'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'DEMO_SEED_MONGODB_URI']) {
    // Empty values keep dotenv from repopulating this process with local
    // production credentials when the app environment is loaded.
    process.env[key] = '';
  }

  // 3. Seed only generated demo records and a roleless viewer credential.
  const seedDemoData = require('./seedDemoData');
  const seedDemoAccount = require('./seedDemoAccount');
  await seedDemoData({ uri });
  await seedDemoAccount({ uri, email: 'demo@doctortracker.com', password: 'Demo@123' });

  // 4. Boot the real Express app against the in-memory demo database.
  require('../src/server');
}

devMemory().catch((err) => {
  console.error('devMemory failed:', err);
  process.exit(1);
});
