/**
 * Setup file: sets safe test env defaults BEFORE app modules load.
 * The DB URI is delivered lazily by tests/helpers.js (in-memory Mongo),
 * so app and mongoose only connect when a test actually needs data.
 */
process.env.NODE_ENV = 'test';
// Keep developer Atlas/local settings out of test configuration. The helper
// starts an isolated MongoMemoryServer and supplies its URI for each suite.
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/doctor-tracker-test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-super-secret-key-for-vitest';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
process.env.COOKIE_NAME = 'dt_token_test';
process.env.COOKIE_SECURE = 'false';
process.env.RATE_LIMIT_MAX = '100000';
process.env.LOGIN_RATE_LIMIT_MAX = '100000';
process.env.ADMIN_EMAIL = 'admin@doctracker.test';
process.env.ADMIN_PASSWORD = 'AdminPass123!';
process.env.ADMIN_NAME = 'Test Admin';
process.env.LOG_LEVEL = 'error';
