const AdminModel = require('../src/models/admin.model');
const helpers = require('./helpers');

const { describe, it, expect, beforeAll, beforeEach, afterAll } = globalThis;

describe('auth', () => {
  beforeAll(async () => {
    await helpers.connect();
    await helpers.seedAdmin();
  });

  beforeEach(async () => {
    await helpers.clearCollections();
  });

  it('health check works without auth', async () => {
    const res = await require('supertest')(helpers.app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ok');
  });

  it('seeds and logs in with valid credentials', async () => {
    await helpers.seedAdmin();
    const res = await require('supertest')(helpers.app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@doctracker.test', password: 'AdminPass123!' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe('admin@doctracker.test');
    expect(res.headers['set-cookie']).toBeDefined();
    expect(res.headers['set-cookie'][0]).toContain('HttpOnly');
    expect(res.headers['set-cookie'][0]).toContain('SameSite=Lax');
  });

  it('sets cross-site session cookies securely in production', async () => {
    await helpers.seedAdmin();
    helpers.env.COOKIE_SECURE = true;
    try {
      const res = await require('supertest')(helpers.app)
        .post('/api/v1/auth/login')
        .send({ email: 'admin@doctracker.test', password: 'AdminPass123!' });

      expect(res.status).toBe(200);
      expect(res.headers['set-cookie'][0]).toContain('SameSite=None');
      expect(res.headers['set-cookie'][0]).toContain('Secure');
    } finally {
      helpers.env.COOKIE_SECURE = false;
    }
  });

  it('rejects wrong password with 401 and a generic message', async () => {
    await helpers.seedAdmin();
    const res = await require('supertest')(helpers.app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@doctracker.test', password: 'WrongPassword!' });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid email or password');
  });

  it('rejects unknown simply with 401 (no account enumeration)', async () => {
    const res = await require('supertest')(helpers.app)
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@doctracker.test', password: 'Whatever123' });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid email or password');
  });

  it('returns 422 on validation failure (bad email, no password)', async () => {
    const res = await require('supertest')(helpers.app)
      .post('/api/v1/auth/login')
      .send({ email: 'not-an-email' });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.details.length).toBeGreaterThan(0);
  });

  it('GET /auth/me is protected (401 without a session)', async () => {
    const res = await require('supertest')(helpers.app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  it('GET /auth/me works with the login cookie', async () => {
    await helpers.seedAdmin();
    const { cookieHeader } = await helpers.login();
    const res = await require('supertest')(helpers.app)
      .get('/api/v1/auth/me')
      .set('Cookie', cookieHeader);

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe('admin@doctracker.test');
  });

  it('never leaks password hashes from any response', async () => {
    await helpers.seedAdmin();
    // the hash exists in the database...
    const raw = JSON.stringify(await AdminModel.findOne({}).select('+passwordHash'));
    expect(raw).toContain('passwordHash');

    // ...but never in any auth/API response shape
    const res = await require('supertest')(helpers.app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@doctracker.test', password: 'AdminPass123!' });
    expect(res.body.data.user.passwordHash).toBeUndefined();
  });

  it('logout clears the auth cookie', async () => {
    await helpers.seedAdmin();
    const { cookieHeader } = await helpers.login();
    const res = await require('supertest')(helpers.app)
      .post('/api/v1/auth/logout')
      .set('Cookie', cookieHeader)

    expect(res.status).toBe(200);
    expect(res.headers['set-cookie'][0]).toContain('dt_token_test=;');
  });

  it('404 for unknown routes', async () => {
    const res = await require('supertest')(helpers.app).get('/api/v1/nope');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
