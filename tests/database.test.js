const { describe, it, expect } = globalThis;
const { mongoFailureHint } = require('../src/config/database');
const { healthResponse } = require('../src/routes/health.routes');
const { isCompleteMongoUri, isDemoMongoUri, getMongoDatabaseName } = require('../src/config/mongoUri');
const { validateEnv } = require('../src/config/env');
const { errorHandler } = require('../src/middlewares/error.middleware');

describe('database diagnostics', () => {
  it('accepts supported MongoDB schemes only when a database name is present', () => {
    expect(isCompleteMongoUri('mongodb://localhost:27017/doctor-tracker')).toBe(true);
    expect(isCompleteMongoUri('mongodb+srv://cluster.example/doctor-tracker?retryWrites=true')).toBe(true);
    expect(isCompleteMongoUri('mongodb://cluster.example/?retryWrites=true')).toBe(false);
    expect(isCompleteMongoUri('https://cluster.example/doctor-tracker')).toBe(false);
  });

  it('requires the isolated database name for demo connections', () => {
    expect(getMongoDatabaseName('mongodb://localhost:27017/doctor-tracker-demo')).toBe('doctor-tracker-demo');
    expect(isDemoMongoUri('mongodb+srv://cluster.example/doctor-tracker-demo?retryWrites=true')).toBe(true);
    expect(isDemoMongoUri('mongodb://cluster.example/test')).toBe(false);
  });

  it('accepts a demo runtime config only with an isolated URI and separate secure settings', () => {
    const valid = validateEnv({
      NODE_ENV: 'production', DEMO_MODE: 'true',
      DEMO_MONGODB_URI: 'mongodb://runtime:encoded@localhost:27017/doctor-tracker-demo',
      DEMO_JWT_SECRET: 'd'.repeat(40), COOKIE_NAME: 'dt_demo_token', COOKIE_SECURE: 'true',
    });
    expect(valid.success).toBe(true);
    expect(validateEnv({
      NODE_ENV: 'production', DEMO_MODE: 'true',
      DEMO_MONGODB_URI: 'mongodb://runtime:encoded@localhost:27017/doctor-tracker',
      DEMO_JWT_SECRET: 'd'.repeat(40), COOKIE_NAME: 'dt_demo_token', COOKIE_SECURE: 'true',
    }).success).toBe(false);
    expect(validateEnv({
      NODE_ENV: 'production', DEMO_MODE: 'true',
      DEMO_MONGODB_URI: 'mongodb://runtime:encoded@localhost:27017/doctor-tracker-demo',
      DEMO_JWT_SECRET: 'd'.repeat(40), JWT_SECRET: 'production-secret-value',
      COOKIE_NAME: 'dt_demo_token', COOKIE_SECURE: 'true',
    }).success).toBe(false);
  });

  it('identifies malformed MongoDB connection strings without echoing them', () => {
    const error = Object.assign(new Error('malformed connection string'), { name: 'MongoParseError' });
    const message = mongoFailureHint(error);
    expect(message).toMatch(/connection string/i);
    expect(message).not.toContain('malformed connection string');
  });

  it('distinguishes DNS, authentication, and network failures', () => {
    expect(mongoFailureHint(Object.assign(new Error('lookup failed'), { code: 'ENOTFOUND' }))).toMatch(/DNS/i);
    expect(mongoFailureHint(Object.assign(new Error('authentication failed'), { code: 18 }))).toMatch(/username\/password/i);
    expect(mongoFailureHint(Object.assign(new Error('timed out'), { name: 'MongooseServerSelectionError' }))).toMatch(/Network Access/i);
  });

  it('reports the API as unavailable when MongoDB is disconnected', () => {
    const response = healthResponse(0, 12);
    expect(response.statusCode).toBe(503);
    expect(response.body.data.mongodb).toBe('disconnected');
  });

  it('does not return raw MongoDB error messages or stacks to API clients', () => {
    const rawCredentialedUri = 'mongodb://private-user:private-password@private-host/doctor-tracker';
    const error = Object.assign(new Error(`Could not connect to ${rawCredentialedUri}`), {
      name: 'MongooseServerSelectionError',
    });
    let body;
    const response = {
      status() { return this; },
      json(value) { body = value; return this; },
    };

    errorHandler(error, { method: 'GET', originalUrl: '/api/v1/health' }, response, () => {});

    expect(body.message).toMatch(/could not be reached/i);
    expect(JSON.stringify(body)).not.toContain(rawCredentialedUri);
    expect(body.stack).toBeUndefined();
  });
});
