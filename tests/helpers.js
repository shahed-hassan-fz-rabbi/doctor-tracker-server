const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Admin = require('../src/models/admin.model');
const app = require('../src/app');
const env = require('../src/config/env');
const bcrypt = require('bcryptjs');

let mongod = null;

module.exports = {
  /**
   * Connects mongoose to ONE in-memory MongoDB for the test run
   * (vitest runs with singleFork, so one instance is shared).
   */
  async connect() {
    if (mongoose.connection.readyState === 1) return mongoose.connection;

    // Always spin up an in-memory Mongo for tests unless a test URI was
    // explicitly provided (the env.js test fallback points to a dead port
    // on purpose, it must not be used for connecting).
    const uriIsPlaceholder =
      !process.env.MONGODB_URI ||
      process.env.MONGODB_URI.startsWith('mongodb://127.0.0.1:27017/doctor-tracker-test');

    if (uriIsPlaceholder) {
      mongod = await MongoMemoryServer.create();
      process.env.MONGODB_URI = mongod.getUri('doctor-tracker-test');
      process.env.MEM_SERVER_ACTIVE = '1';
    }
    await mongoose.connect(process.env.MONGODB_URI);
    // explicit index creation: unique index builds happen lazily on first
    // write — wait for them so duplicate-key semantics are deterministic
    await Promise.all([
      require('../src/models/admin.model').init(),
      require('../src/models/doctor.model').init(),
      require('../src/models/patient.model').init(),
    ]);
    return mongoose.connection;
  },
  async clearCollections() {
    const collections = await mongoose.connection.collections;
    for (const collection of Object.values(collections)) {
      await collection.deleteMany({});
    }
  },
  app,
  env,
  async seedAdmin() {
    return Admin.create({
      name: 'Test Admin',
      email: 'admin@doctracker.test',
      passwordHash: bcrypt.hashSync('AdminPass123!', 12),
    });
  },
  /** Returns { user, cookie } after logging in through the real route. */
  async login() {
    const agent = require('supertest')(this.app);
    const res = await agent
      .post('/api/v1/auth/login')
      .send({ email: 'admin@doctracker.test', password: 'AdminPass123!' });
    const setCookie = res.headers['set-cookie'];
    return {
      user: res.body.data.user,
      setCookie,
      cookieHeader: setCookie ? setCookie.map((c) => c.split(';')[0]).join('; ') : null,
    };
  },
};
