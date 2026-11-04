/**
 * Development helper: starts the API against an in-memory MongoDB and seeds
 * an admin plus synthetic data so the whole stack can be shown
 * without Atlas.
 *
 *   npm run dev:memory
 *
 * Dev-only (never used in production or tests). Admin credentials come
 * from .env — nothing is hardcoded here.
 */
require('dotenv').config();
const { MongoMemoryServer } = require('mongodb-memory-server');

async function devMemory() {
  // 1. start the DB first
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri('doctor-tracker-demo');
  console.log('🧠 In-memory MongoDB started at', uri);

  // 2. point the app config at it BEFORE any module reads config/env.js
  process.env.MONGODB_URI = uri;

  // 3. seed admin + synthetic demo data (same paths as the real scripts)
  const seedAdmin = require('./seedAdmin');
  const seedDemoData = require('./seedDemoData');
  await seedAdmin({ argv: [] });
  await seedDemoData({ uri, requireEmptyDatabase: false });

  // (seeders close their own connections; the app re-opens its own below)

  // 4. boot the real Express app
  require('../src/server');
}

devMemory().catch((err) => {
  console.error('devMemory failed:', err);
  process.exit(1);
});
