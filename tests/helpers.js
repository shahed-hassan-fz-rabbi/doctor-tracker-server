const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Admin = require('../src/models/admin.model');
const User = require('../src/models/user.model');
const app = require('../src/app');
const env = require('../src/config/env');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

let mongod = null;

module.exports = {
  /**
   * Connects mongoose to ONE in-memory MongoDB for the test run
   * (vitest runs with singleFork, so one instance is shared).
   */
  async connect() {
    if (mongoose.connection.readyState === 1) return mongoose.connection;

    // Never let the developer's .env send tests to Atlas. Tests always use
    // their own disposable MongoDB process.
    if (!mongod) {
      mongod = await MongoMemoryServer.create();
      process.env.TEST_MONGODB_URI = mongod.getUri('doctor-tracker-test');
      process.env.MEM_SERVER_ACTIVE = '1';
    }
    await mongoose.connect(process.env.TEST_MONGODB_URI);
    // explicit index creation: unique index builds happen lazily on first
    // write — wait for them so duplicate-key semantics are deterministic
    await Promise.all([
      require('../src/models/admin.model').init(),
      require('../src/models/doctor.model').init(),
      require('../src/models/patient.model').init(),
      require('../src/models/user.model').init(),
      require('../src/models/demoAccount.model').init(),
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
    const existing = await Admin.findOne({ email: 'admin@doctracker.test' });
    if (existing) return existing;
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
      // Current doctor/patient suites refer to the session cookie by this alias.
      adminCookie: setCookie ? setCookie.map((c) => c.split(';')[0]).join('; ') : null,
    };
  },
  async seedGoogleUser(email, role = 'viewer') {
    return User.create({
      googleId: `google-${Date.now()}`,
      email,
      name: 'Test Google User',
      picture: null,
      emailVerified: true,
      provider: 'google',
      role,
      status: 'active',
    });
  },
  async loginGoogleUser(email) {
    const user = await User.findOne({ email });
    if (!user) throw new Error('User not found');

    const token = jwt.sign(
      { sub: user._id.toString(), role: user.role, provider: 'google' },
      env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    const cookieHeader = `${env.COOKIE_NAME}=${token}`;

    return {
      user,
      cookieHeader,
    };
  },
};
