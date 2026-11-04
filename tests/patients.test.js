const helpers = require('./helpers');

const { describe, it, expect, beforeAll, beforeEach } = globalThis;

describe('patients', () => {
  const Doctor = require('../src/models/doctor.model');
  const Patient = require('../src/models/patient.model');

  let adminCookie = null;

  const doctorPayload = (i = 1, overrides = {}) => ({
    name: `Dr. Test ${i}`,
    specialization: 'Cardiology',
    hospital: 'Greenview General Hospital',
    phone: '+1 202 5550123',
    email: `dr.p-test${i}@dt-test.example.com`,
    ...overrides,
  });

  const patientPayload = (i = 1, overrides = {}) => ({
    fullName: `Test Patient ${i}`,
    age: 30 + i,
    gender: 'Male',
    phone: '+1 202 5550500',
    condition: 'Hypertension',
    email: null,
    notes: 'Seed entry from test suite.',
    ...overrides,
  });

  beforeAll(async () => {
    await helpers.connect();
  });

  beforeEach(async () => {
    await helpers.clearCollections();
    await helpers.seedAdmin();
    const login = await helpers.login();
    adminCookie = login.adminCookie;
  });

  it('blocks the patients API for unauthenticated clients (401)', async () => {
    const res = await require('supertest')(helpers.app).get('/api/v1/patients');
    expect(res.status).toBe(401);
  });

  it('creates a patient without a doctor', async () => {
    const res = await require('supertest')(helpers.app)
      .post('/api/v1/patients')
      .set('Cookie', adminCookie)
      .send(patientPayload(1));

    expect(res.status).toBe(201);
    expect(res.body.data.fullName).toBe('Test Patient 1');
    expect(res.body.data.doctorId).toBeNull();
  });

  it('creates a patient linked to an existing doctor', async () => {

    const doctor = await Doctor.create(doctorPayload(1));

    const res = await require('supertest')(helpers.app)
      .post('/api/v1/patients')
      .set('Cookie', adminCookie)
      .send(patientPayload(1, { doctorId: String(doctor._id) }));

    expect(res.status).toBe(201);
    expect(String(res.body.data.doctorId) === String(doctor._id)).toBe(true);
  });

  it('rejects a patient linked to a nonexistent doctor (FK check)', async () => {


    const res = await require('supertest')(helpers.app)
      .post('/api/v1/patients')
      .set('Cookie', adminCookie)
      .send(patientPayload(1, { doctorId: '64cd5f1b9d34830000111111' }));

    expect(res.status).toBe(400);
  });

  it('rejects an out-of-range age with 422', async () => {


    const res = await require('supertest')(helpers.app)
      .post('/api/v1/patients')
      .set('Cookie', adminCookie)
      .send(patientPayload(1, { age: 500 }));

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  it('rejects an unsupported condition with 422', async () => {


    const res = await require('supertest')(helpers.app)
      .post('/api/v1/patients')
      .set('Cookie', adminCookie)
      .send(patientPayload(1, { condition: 'Witchcraft' }));

    expect(res.status).toBe(422);
  });

  it('paginates the patients list correctly', async () => {


    for (let i = 1; i <= 22; i += 1) {
      await require('supertest')(helpers.app)
        .post('/api/v1/patients')
        .set('Cookie', adminCookie)
        .send(patientPayload(i));
    }

    const res = await require('supertest')(helpers.app)
      .get('/api/v1/patients?page=1&limit=10')
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(10);
    expect(res.body.meta.total).toBe(22);
    expect(res.body.meta.totalPages).toBe(3);
    expect(res.body.meta.page).toBe(1);
  });

  it('searches patients by name and phone', async () => {


    await require('supertest')(helpers.app)
      .post('/api/v1/patients')
      .set('Cookie', adminCookie)
      .send(patientPayload(1, { fullName: 'Special Searchcase', phone: '+1 202 7777000' }));
    await require('supertest')(helpers.app)
      .post('/api/v1/patients')
      .set('Cookie', adminCookie)
      .send(patientPayload(2));

    const res = await require('supertest')(helpers.app)
      .get('/api/v1/patients?search=Special')
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);

    const res2 = await require('supertest')(helpers.app)
      .get('/api/v1/patients?search=7777')
      .set('Cookie', adminCookie);
    expect(res2.body.data.length).toBe(1);
  });

  it('filters by condition, gender and doctor', async () => {


    const doctor = await Doctor.create(doctorPayload(1));

    await require('supertest')(helpers.app)
      .post('/api/v1/patients')
      .set('Cookie', adminCookie)
      .send(patientPayload(1, { condition: 'Diabetes', gender: 'Female', doctorId: String(doctor._id) }));
    await require('supertest')(helpers.app)
      .post('/api/v1/patients')
      .set('Cookie', adminCookie)
      .send(patientPayload(2, { condition: 'Hypertension', gender: 'Male' }));

    const byCondition = await require('supertest')(helpers.app)
      .get('/api/v1/patients?condition=Diabetes')
      .set('Cookie', adminCookie);
    expect(byCondition.body.meta.total).toBe(1);

    const byGender = await require('supertest')(helpers.app)
      .get('/api/v1/patients?gender=Female')
      .set('Cookie', adminCookie);
    expect(byGender.body.meta.total).toBe(1);

    const byDoctor = await require('supertest')(helpers.app)
      .get(`/api/v1/patients?doctorId=${doctor._id}`)
      .set('Cookie', adminCookie);
    expect(byDoctor.body.meta.total).toBe(1);

    const unassigned = await require('supertest')(helpers.app)
      .get('/api/v1/patients?doctorId=unassigned')
      .set('Cookie', adminCookie);
    expect(unassigned.body.meta.total).toBe(1);
  });

  it('filters by createdAt date range', async () => {


    await Patient.create({ ...patientPayload(1), createdAt: new Date('2025-02-10T10:00:00Z') });
    await Patient.create({
      ...patientPayload(2),
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    });

    const res = await require('supertest')(helpers.app)
      .get(`/api/v1/patients?dateFrom=${new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)}&dateTo=${new Date().toISOString().slice(0, 10)}`)
      .set('Cookie', adminCookie);

    expect(res.body.meta.total).toBe(1);
    expect(res.body.data[0].fullName).toBe('Test Patient 2');
  });

  it('sorts patients by name asc', async () => {


    await require('supertest')(helpers.app).post('/api/v1/patients').set('Cookie', adminCookie).send(patientPayload(3));
    await require('supertest')(helpers.app).post('/api/v1/patients').set('Cookie', adminCookie).send(patientPayload(1));
    await require('supertest')(helpers.app).post('/api/v1/patients').set('Cookie', adminCookie).send(patientPayload(2));

    const res = await require('supertest')(helpers.app)
      .get('/api/v1/patients?sortBy=fullName&sortOrder=asc')
      .set('Cookie', adminCookie);

    expect(res.body.data[0].fullName).toBe('Test Patient 1');
    expect(res.body.data[2].fullName).toBe('Test Patient 3');
  });

  it('updates a patient including reassigning the doctor', async () => {


    const patient = await Patient.create(patientPayload(1));
    const doctor = await Doctor.create(doctorPayload(1));

    const res = await require('supertest')(helpers.app)
      .patch(`/api/v1/patients/${patient._id}`)
      .set('Cookie', adminCookie)
      .send({ condition: 'Sleep Disorder', doctorId: String(doctor._id) });

    expect(res.status).toBe(200);
    expect(res.body.data.condition).toBe('Sleep Disorder');
    expect(String(res.body.data.doctorId) === String(doctor._id)).toBe(true);
  });

  it('updates a patient from PATCH with unassigned doctor', async () => {


    const patient = await Patient.create(patientPayload(1));
    const res = await require('supertest')(helpers.app)
      .patch(`/api/v1/patients/${patient._id}`)
      .set('Cookie', adminCookie)
      .send({ doctorId: 'unassigned' });

    expect(res.status).toBe(200);
    expect(res.body.data.doctorId).toBeNull();
  });

  it('rejects assigning this patient to a doctor that does not exist (PATCH)', async () => {


    const patient = await Patient.create(patientPayload(1));
    const res = await require('supertest')(helpers.app)
      .patch(`/api/v1/patients/${patient._id}`)
      .set('Cookie', adminCookie)
      .send({ doctorId: '64cd5f1b9d34830000111111' });

    expect(res.status).toBe(400);
  });

  it('deletes a patient', async () => {


    const patient = await Patient.create(patientPayload(1));
    const res = await require('supertest')(helpers.app)
      .delete(`/api/v1/patients/${patient._id}`)
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    expect(await Patient.countDocuments()).toBe(0);
  });

  it('404s a patient that does not exist (valid ObjectId)', async () => {


    const res = await require('supertest')(helpers.app)
      .get('/api/v1/patients/64cd5f1b9d34830000111111')
      .set('Cookie', adminCookie);
    expect(res.status).toBe(404);
  });
});
