const AdminModel = require('../src/models/admin.model');
const helpers = require('./helpers');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const DemoAccount = require('../src/models/demoAccount.model');
const Doctor = require('../src/models/doctor.model');
const Patient = require('../src/models/patient.model');

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
    expect(res.headers['cache-control']).toContain('no-store');
  });

  it.each([
    ['expired', () => jwt.sign({ sub: '64cd5f1b9d34830000111111' }, helpers.env.JWT_SECRET, { expiresIn: -1 })],
    ['invalid', () => 'not-a-valid-token'],
  ])('rejects an %s session without exposing its token', async (_case, makeToken) => {
    const token = makeToken();
    const res = await require('supertest')(helpers.app)
      .get('/api/v1/auth/me')
      .set('Cookie', `${helpers.env.COOKIE_NAME}=${token}`);

    expect(res.status).toBe(401);
    expect(JSON.stringify(res.body)).not.toContain(token);
  });

  it('allows credentialed CORS requests from the configured frontend origin', async () => {
    const origin = helpers.env.CORS_ORIGINS[0];
    const res = await require('supertest')(helpers.app)
      .options('/api/v1/auth/me')
      .set('Origin', origin)
      .set('Access-Control-Request-Method', 'GET');

    expect(res.headers['access-control-allow-origin']).toBe(origin);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
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

  it('demo viewer can log in, verify a read-only session, and read isolated domain routes', async () => {
    helpers.env.DEMO_MODE = true;
    helpers.env.COOKIE_NAME = 'dt_demo_token_test';
    try {
      const account = await DemoAccount.create({
        email: 'demo@doctortracker.test', name: 'Demo Viewer',
        passwordHash: await bcrypt.hash('demo-test-password-123456', 4),
      });
      const agent = require('supertest')(helpers.app);
      const login = await agent.post('/api/v1/auth/demo-login').send({
        email: 'DEMO@DOCTORTRACKER.TEST', password: 'demo-test-password-123456',
      });
      expect(login.status).toBe(200);
      expect(login.body.data.user.role).toBe('viewer');
      expect(login.body.data.user.isDemo).toBe(true);
      expect(login.body.data.user.passwordHash).toBeUndefined();
      expect(login.headers['set-cookie'][0]).toContain('HttpOnly');
      const cookie = login.headers['set-cookie'][0].split(';')[0];
      const updatedAt = (await DemoAccount.findById(account._id)).updatedAt.getTime();

      const me = await agent.get('/api/v1/auth/me').set('Cookie', cookie);
      expect(me.status).toBe(200);
      expect(me.body.data.user.role).toBe('viewer');
      expect((await DemoAccount.findById(account._id)).updatedAt.getTime()).toBe(updatedAt);

      expect((await agent.get('/api/v1/doctors').set('Cookie', cookie)).status).toBe(200);
      expect((await agent.get('/api/v1/patients').set('Cookie', cookie)).status).toBe(200);
      expect((await agent.get('/api/v1/analytics/overview').set('Cookie', cookie)).status).toBe(200);
      expect((await agent.post('/api/v1/auth/login').send({ email: 'x@y.test', password: 'pass' })).status).toBe(404);
      expect((await agent.get('/api/v1/auth/google')).status).toBe(404);
      expect((await agent.post('/api/v1/doctors').set('Cookie', cookie).send({})).status).toBe(403);
      expect((await agent.patch(`/api/v1/doctors/${new (require('mongoose').Types.ObjectId)()}`).set('Cookie', cookie).send({})).status).toBe(403);
      expect((await agent.delete(`/api/v1/doctors/${new (require('mongoose').Types.ObjectId)()}`).set('Cookie', cookie)).status).toBe(403);
      expect((await agent.post('/api/v1/patients').set('Cookie', cookie).send({})).status).toBe(403);
      expect((await agent.patch(`/api/v1/patients/${new (require('mongoose').Types.ObjectId)()}`).set('Cookie', cookie).send({})).status).toBe(403);
      expect((await agent.delete(`/api/v1/patients/${new (require('mongoose').Types.ObjectId)()}`).set('Cookie', cookie)).status).toBe(403);
      expect(await Doctor.countDocuments()).toBe(0);
      expect(await Patient.countDocuments()).toBe(0);
    } finally {
      helpers.env.DEMO_MODE = false;
      helpers.env.COOKIE_NAME = 'dt_token_test';
    }
  });

  it('does not accept a demo session when the demo account has been deactivated', async () => {
    helpers.env.DEMO_MODE = true;
    helpers.env.COOKIE_NAME = 'dt_demo_token_test';
    try {
      const account = await DemoAccount.create({
        email: 'inactive@doctortracker.test', passwordHash: await bcrypt.hash('demo-test-password-123456', 4),
      });
      const token = jwt.sign({ sub: account.id, provider: 'demo', role: 'viewer' }, helpers.env.JWT_SECRET, {
        issuer: 'doctor-tracker-demo', audience: 'doctor-tracker-demo', expiresIn: '1h',
      });
      await DemoAccount.updateOne({ _id: account._id }, { active: false });
      const res = await require('supertest')(helpers.app).get('/api/v1/auth/me')
        .set('Cookie', `${helpers.env.COOKIE_NAME}=${token}`);
      expect(res.status).toBe(401);
    } finally {
      helpers.env.DEMO_MODE = false;
      helpers.env.COOKIE_NAME = 'dt_token_test';
    }
  });

  it('404 for unknown routes', async () => {
    const res = await require('supertest')(helpers.app).get('/api/v1/nope');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
