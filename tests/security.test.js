const helpers = require('./helpers');

const { describe, it, expect, beforeAll, beforeEach } = globalThis;

describe('security - viewer access restrictions', () => {
  const User = require('../src/models/user.model');

  beforeAll(async () => {
    await helpers.connect();
  });

  beforeEach(async () => {
    await helpers.clearCollections();
  });

  it('blocks viewers from reading all patients (403)', async () => {
    await helpers.seedAdmin();
    await helpers.seedGoogleUser('viewer@test.com', 'viewer');

    const { cookieHeader: viewerCookie } = await helpers.loginGoogleUser('viewer@test.com');

    const res = await require('supertest')(helpers.app)
      .get('/api/v1/patients')
      .set('Cookie', viewerCookie);

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('message');
  });

  it('blocks viewers from reading a specific patient (403)', async () => {
    await helpers.seedAdmin();
    await helpers.seedGoogleUser('viewer@test.com', 'viewer');

    const { cookieHeader: adminCookie } = await helpers.login();
    const { cookieHeader: viewerCookie } = await helpers.loginGoogleUser('viewer@test.com');

    // Create a patient as admin
    const patientRes = await require('supertest')(helpers.app)
      .post('/api/v1/patients')
      .set('Cookie', adminCookie)
      .send({
        fullName: 'Test Patient',
        age: 30,
        gender: 'Male',
        phone: '+1 202 555 0100',
        condition: 'Diabetes',
      });

    expect(patientRes.status).toBe(201);
    const patientId = patientRes.body.data._id;

    // Try to read as viewer
    const res = await require('supertest')(helpers.app)
      .get(`/api/v1/patients/${patientId}`)
      .set('Cookie', viewerCookie);

    expect(res.status).toBe(403);
  });

  it('blocks viewers from reading all doctors (403)', async () => {
    await helpers.seedAdmin();
    await helpers.seedGoogleUser('viewer@test.com', 'viewer');

    const { cookieHeader: viewerCookie } = await helpers.loginGoogleUser('viewer@test.com');

    const res = await require('supertest')(helpers.app)
      .get('/api/v1/doctors')
      .set('Cookie', viewerCookie);

    expect(res.status).toBe(403);
  });

  it('blocks viewers from reading a specific doctor (403)', async () => {
    await helpers.seedAdmin();
    await helpers.seedGoogleUser('viewer@test.com', 'viewer');

    const { cookieHeader: adminCookie } = await helpers.login();
    const { cookieHeader: viewerCookie } = await helpers.loginGoogleUser('viewer@test.com');

    // Create a doctor as admin
    const doctorRes = await require('supertest')(helpers.app)
      .post('/api/v1/doctors')
      .set('Cookie', adminCookie)
      .send({
        name: 'Dr. Test',
        specialization: 'Cardiology',
        hospital: 'Test Hospital',
        phone: '+1 202 5550123',
        email: 'dr.test@example.com',
      });

    const doctorId = doctorRes.body.data._id;

    // Try to read as viewer
    const res = await require('supertest')(helpers.app)
      .get(`/api/v1/doctors/${doctorId}`)
      .set('Cookie', viewerCookie);

    expect(res.status).toBe(403);
  });

  it('blocks viewers from reading doctor patients (403)', async () => {
    await helpers.seedAdmin();
    await helpers.seedGoogleUser('viewer@test.com', 'viewer');

    const { cookieHeader: adminCookie } = await helpers.login();
    const { cookieHeader: viewerCookie } = await helpers.loginGoogleUser('viewer@test.com');

    // Create a doctor and patient as admin
    const doctorRes = await require('supertest')(helpers.app)
      .post('/api/v1/doctors')
      .set('Cookie', adminCookie)
      .send({
        name: 'Dr. Test',
        specialization: 'Cardiology',
        hospital: 'Test Hospital',
        phone: '+1 202 5550123',
        email: 'dr.test@example.com',
      });

    const doctorId = doctorRes.body.data._id;

    // Try to read doctor patients as viewer
    const res = await require('supertest')(helpers.app)
      .get(`/api/v1/doctors/${doctorId}/patients`)
      .set('Cookie', viewerCookie);

    expect(res.status).toBe(403);
  });

  it('blocks viewers from analytics overview (403)', async () => {
    await helpers.seedAdmin();
    await helpers.seedGoogleUser('viewer@test.com', 'viewer');

    const { cookieHeader: viewerCookie } = await helpers.loginGoogleUser('viewer@test.com');

    const res = await require('supertest')(helpers.app)
      .get('/api/v1/analytics/overview')
      .set('Cookie', viewerCookie);

    expect(res.status).toBe(403);
  });

  it('blocks viewers from all analytics endpoints (403)', async () => {
    await helpers.seedAdmin();
    await helpers.seedGoogleUser('viewer@test.com', 'viewer');

    const { cookieHeader: viewerCookie } = await helpers.loginGoogleUser('viewer@test.com');

    const endpoints = [
      '/api/v1/analytics/patient-growth',
      '/api/v1/analytics/patients-by-condition',
      '/api/v1/analytics/patients-per-doctor',
      '/api/v1/analytics/doctor-specializations',
    ];

    for (const endpoint of endpoints) {
      const res = await require('supertest')(helpers.app)
        .get(endpoint)
        .set('Cookie', viewerCookie);

      expect(res.status).toBe(403);
    }
  });

  it('allows admin to read all patients (200)', async () => {
    await helpers.seedAdmin();

    const { cookieHeader: adminCookie } = await helpers.login();

    const res = await require('supertest')(helpers.app)
      .get('/api/v1/patients')
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
  });

  it('allows admin to read all doctors (200)', async () => {
    await helpers.seedAdmin();

    const { cookieHeader: adminCookie } = await helpers.login();

    const res = await require('supertest')(helpers.app)
      .get('/api/v1/doctors')
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
  });

  it('allows admin to read analytics (200)', async () => {
    await helpers.seedAdmin();

    const { cookieHeader: adminCookie } = await helpers.login();

    const res = await require('supertest')(helpers.app)
      .get('/api/v1/analytics/overview')
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
  });

  it('blocks unauthenticated users from patient endpoints (401)', async () => {
    const res = await require('supertest')(helpers.app).get('/api/v1/patients');
    expect(res.status).toBe(401);
  });

  it('blocks unauthenticated users from doctor endpoints (401)', async () => {
    const res = await require('supertest')(helpers.app).get('/api/v1/doctors');
    expect(res.status).toBe(401);
  });

  it('blocks unauthenticated users from analytics endpoints (401)', async () => {
    const res = await require('supertest')(helpers.app).get('/api/v1/analytics/overview');
    expect(res.status).toBe(401);
  });
});
