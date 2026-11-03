const helpers = require('./helpers');

const { describe, it, expect, beforeAll, beforeEach, afterAll } = globalThis;

describe('doctors', () => {
  const Doctor = require('../src/models/doctor.model');
  const Patient = require('../src/models/patient.model');

  const doctorPayload = (i = 1, overrides = {}) => ({
    name: `Dr. Test ${i}`,
    specialization: 'Cardiology',
    hospital: 'Greenview General Hospital',
    phone: '+1 202 5550123',
    email: `dr.test${i}@dt-test.example.com`,
    ...overrides,
  });

  beforeAll(async () => {
    await helpers.connect();
  });

  beforeEach(async () => {
    await helpers.clearCollections();
  });

  it('blocks all doctor routes for unauthenticated clients (401)', async () => {
    const res = await require('supertest')(helpers.app).get('/api/v1/doctors');
    expect(res.status).toBe(401);
  });

  it('creates a doctor with valid data', async () => {
    await helpers.seedAdmin();
    const { cookieHeader } = await helpers.login();
    const res = await require('supertest')(helpers.app)
      .post('/api/v1/doctors')
      .set('Cookie', cookieHeader)
      .send(doctorPayload(1));

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Dr. Test 1');
    expect(res.body.data.email).toBe('dr.test1@dt-test.example.com');
  });

  it('rejects duplicate doctor email with 409', async () => {
    await helpers.seedAdmin();
    const { cookieHeader } = await helpers.login();

    await require('supertest')(helpers.app).post('/api/v1/doctors').set('Cookie', cookieHeader).send(doctorPayload(1));
    const duplicate = await require('supertest')(helpers.app)
      .post('/api/v1/doctors')
      .set('Cookie', cookieHeader)
      .send(doctorPayload(1));

    expect(duplicate.status).toBe(409);
  });

  it('rejects an unsupported specialization with 422', async () => {
    await helpers.seedAdmin();
    const { cookieHeader } = await helpers.login();

    const res = await require('supertest')(helpers.app)
      .post('/api/v1/doctors')
      .set('Cookie', cookieHeader)
      .send(doctorPayload(1, { specialization: 'Astrology' }));

    expect(res.status).toBe(422);
  });

  it('lists doctors with pagination meta', async () => {
    await helpers.seedAdmin();
    const { cookieHeader } = await helpers.login();

    for (let i = 1; i <= 15; i += 1) {
      await require('supertest')(helpers.app)
        .post('/api/v1/doctors')
        .set('Cookie', cookieHeader)
        .send(doctorPayload(i));
    }

    const res = await require('supertest')(helpers.app)
      .get('/api/v1/doctors?page=2&limit=5')
      .set('Cookie', cookieHeader);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(5);
    expect(res.body.meta.total).toBe(15);
    expect(res.body.meta.page).toBe(2);
    expect(res.body.meta.totalPages).toBe(3);
    expect(res.body.meta.hasNextPage).toBe(true);
  });

  it('searches doctors by name / hospital / email', async () => {
    await helpers.seedAdmin();
    const { cookieHeader } = await helpers.login();

    await require('supertest')(helpers.app).post('/api/v1/doctors').set('Cookie', cookieHeader).send(doctorPayload(1, { specialization: 'Neurology' }));
    await require('supertest')(helpers.app).post('/api/v1/doctors').set('Cookie', cookieHeader).send(doctorPayload(2, { hospital: 'Cardiology Path Hospital' }));
    await require('supertest')(helpers.app).post('/api/v1/doctors').set('Cookie', cookieHeader).send(doctorPayload(3, { name: 'Dr. Unique Neuro' }));

    const res = await require('supertest')(helpers.app)
      .get('/api/v1/doctors?search=unique')
      .set('Cookie', cookieHeader);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].name).toBe('Dr. Unique Neuro');

    const res2 = await require('supertest')(helpers.app)
      .get('/api/v1/doctors?search=cardiology')
      .set('Cookie', cookieHeader);
    expect(res2.body.meta.total).toBe(2);
  });

  it('filters by specialization and sorts by name asc', async () => {
    await helpers.seedAdmin();
    const { cookieHeader } = await helpers.login();

    await require('supertest')(helpers.app).post('/api/v1/doctors').set('Cookie', cookieHeader).send(doctorPayload(1, { specialization: 'Neurology' }));
    await require('supertest')(helpers.app).post('/api/v1/doctors').set('Cookie', cookieHeader).send(doctorPayload(2));
    await require('supertest')(helpers.app).post('/api/v1/doctors').set('Cookie', cookieHeader).send(doctorPayload(3, { specialization: 'Neurology' }));

    const res = await require('supertest')(helpers.app)
      .get('/api/v1/doctors?specialization=Neurology&sortBy=name&sortOrder=asc')
      .set('Cookie', cookieHeader);

    expect(res.body.meta.total).toBe(2);
    expect(res.body.data[0].name < res.body.data[1].name).toBe(true);
  });

  it('filters by createdAt date range', async () => {
    await helpers.seedAdmin();
    const { cookieHeader } = await helpers.login();

    await Doctor.create({
      ...doctorPayload(1),
      createdAt: new Date('2025-01-15T10:00:00Z'),
    });
    await Doctor.create({
      ...doctorPayload(2),
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    });

    const res = await require('supertest')(helpers.app)
      .get(`/api/v1/doctors?dateFrom=${new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)}&dateTo=${new Date().toISOString().slice(0, 10)}`)
      .set('Cookie', cookieHeader);

    expect(res.body.meta.total).toBe(1);
    expect(res.body.data[0].name).toBe('Dr. Test 2');
  });

  it('returns pagination meta and rows for doctors/:id/patients', async () => {
    await helpers.seedAdmin();
    const { cookieHeader } = await helpers.login();

    const doctor = await Doctor.create(doctorPayload(1));
    for (let i = 0; i < 12; i += 1) {
      await Patient.create({
        fullName: `Patient ${i}`,
        age: 30 + i,
        gender: 'Male',
        phone: '+1 202 5550001',
        condition: 'Diabetes',
        doctorId: doctor._id,
      });
    }

    const res = await require('supertest')(helpers.app)
      .get(`/api/v1/doctors/${doctor._id}/patients?page=2&limit=5`)
      .set('Cookie', cookieHeader);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(5);
    expect(res.body.meta.total).toBe(12);
    expect(res.body.meta.page).toBe(2);
  });

  it('adds a patient under a doctor and reports accurate counts', async () => {
    await helpers.seedAdmin();
    const { cookieHeader } = await helpers.login();

    const doctor = await Doctor.create(doctorPayload(1));

    const res = await require('supertest')(helpers.app)
      .post(`/api/v1/doctors/${doctor._id}/patients`)
      .set('Cookie', cookieHeader)
      .send({
        fullName: 'Roster Patient',
        age: 42,
        gender: 'Female',
        phone: '+1 202 5551111',
        condition: 'Asthma',
        email: null,
      });

    expect(res.status).toBe(201);
    expect(String(res.body.data.doctorId) === String(doctor._id)).toBe(true);

    const meRes = await require('supertest')(helpers.app)
      .get(`/api/v1/doctors/${doctor._id}`)
      .set('Cookie', cookieHeader);
    expect(meRes.body.data.patientCount).toBe(1);
  });

  it('removes a patient from the doctor roster without deleting the record', async () => {
    await helpers.seedAdmin();
    const { cookieHeader } = await helpers.login();

    const doctor = await Doctor.create(doctorPayload(1));
    const patient = await Patient.create({
      fullName: 'Roster Patient',
      age: 30,
      gender: 'Female',
      phone: '+1 202 5552222',
      condition: 'Diabetes',
      doctorId: doctor._id,
    });

    const res = await require('supertest')(helpers.app)
      .delete(`/api/v1/doctors/${doctor._id}/patients/${patient._id}`)
      .set('Cookie', cookieHeader);

    expect(res.status).toBe(200);
    expect(await Patient.countDocuments()).toBe(1);
  });

  it('updates a doctor with PATCH (partial)', async () => {
    await helpers.seedAdmin();
    const { cookieHeader } = await helpers.login();

    const doctor = await Doctor.create(doctorPayload(1));
    const res = await require('supertest')(helpers.app)
      .patch(`/api/v1/doctors/${doctor._id}`)
      .set('Cookie', cookieHeader)
      .send({ phone: '+1 202 9990000' });

    expect(res.status).toBe(200);
    expect(res.body.data.phone).toBe('+1 202 9990000');
    expect(res.body.data.specialization).toBe('Cardiology');
  });

  it('deletes a doctor and unassigns linked patients (no cascade loss)', async () => {
    await helpers.seedAdmin();
    const { cookieHeader } = await helpers.login();

    const doctor = await Doctor.create(doctorPayload(1));
    await Patient.create({
      fullName: 'Orphan Risk',
      age: 55,
      gender: 'Other',
      phone: '+1 202 5553333',
      condition: 'Cardiac',
      doctorId: doctor._id,
    });

    const delRes = await require('supertest')(helpers.app)
      .delete(`/api/v1/doctors/${doctor._id}`)
      .set('Cookie', cookieHeader);
    expect(delRes.status).toBe(200);

    expect(await Patient.countDocuments({ doctorId: doctor._id })).toBe(0);
    const patientCounts = await Patient.countDocuments();
    expect(patientCounts).toBe(1);
  });

  it('404s a doctor that does not exist (valid ObjectId)', async () => {
    await helpers.seedAdmin();
    const { cookieHeader } = await helpers.login();

    const res = await require('supertest')(helpers.app)
      .get('/api/v1/doctors/64cd5f1b9d34830000111111')
      .set('Cookie', cookieHeader);

    expect(res.status).toBe(404);
  });

  it('400/422s a malformed doctor ObjectId', async () => {
    await helpers.seedAdmin();
    const { cookieHeader } = await helpers.login();

    const res = await require('supertest')(helpers.app)
      .get('/api/v1/doctors/bad-object-id')
      .set('Cookie', cookieHeader);

    expect([400, 422]).toContain(res.status);
  });
});
