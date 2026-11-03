const helpers = require('./helpers');

const { describe, it, expect, beforeAll, beforeEach } = globalThis;

describe('analytics', () => {
  const Doctor = require('../src/models/doctor.model');
  const Patient = require('../src/models/patient.model');

  const doctorPayload = (i = 1, overrides = {}) => ({
    name: `Dr. Test ${i}`,
    specialization: 'Cardiology',
    hospital: 'Greenview General Hospital',
    phone: '+1 202 5550123',
    email: `dr.ana-test${i}@dt-test.example.com`,
    ...overrides,
  });

  beforeAll(async () => {
    await helpers.connect();
  });

  beforeEach(async () => {
    await helpers.clearCollections();
  });

  it('overview aggregates totals, activity and recent records', async () => {
    await helpers.seedAdmin();
    const { cookieHeader } = await helpers.login();

    const d1 = await Doctor.create(doctorPayload(1, { isActive: true }));
    const d2 = await Doctor.create(doctorPayload(2, { isActive: false }));

    const patients = [];
    for (let i = 0; i < 6; i += 1) {
      patients.push({
        fullName: `Patient ${i}`,
        age: 30,
        gender: 'Female',
        phone: '+1 202 3334444',
        condition: 'Diabetes',
        doctorId: i < 4 ? d1._id : null,
      });
    }
    await Patient.create(patients);
    await Patient.create({
      fullName: 'Cardiac Patient',
      age: 30,
      gender: 'Male',
      phone: '+1 202 3334555',
      condition: 'Cardiac',
      doctorId: d1._id,
    });

    const res = await require('supertest')(helpers.app)
      .get('/api/v1/analytics/overview')
      .set('Cookie', cookieHeader);

    expect(res.status).toBe(200);
    expect(res.body.data.totalDoctors).toBe(2);
    expect(res.body.data.activeDoctors).toBe(1);
    expect(res.body.data.inactiveDoctors).toBe(1);
    expect(res.body.data.totalPatients).toBe(7);
    expect(res.body.data.avgPatientsPerDoctor).toBeGreaterThanOrEqual(4);
    const diabetesEntry = res.body.data.patientsByCondition.find(
      (row) => row.condition === 'Diabetes'
    );
    expect(diabetesEntry.count).toBe(6);
  });

  it('patient-growth groups registrations by month', async () => {
    await helpers.seedAdmin();
    const { cookieHeader } = await helpers.login();

    await Patient.create([
      {
        fullName: 'Older Patient',
        age: 40,
        gender: 'Male',
        phone: '+1 202 3334444',
        condition: 'Diabetes',
        createdAt: new Date(Date.now() - 80 * 24 * 60 * 60 * 1000),
      },
      {
        fullName: 'Recent Patient',
        age: 40,
        gender: 'Male',
        phone: '+1 202 3334555',
        condition: 'Diabetes',
        createdAt: new Date(),
      },
    ]);

    const res = await require('supertest')(helpers.app)
      .get('/api/v1/analytics/patient-growth')
      .set('Cookie', cookieHeader);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
  });

  it('patients-by-condition returns counts AND percentages', async () => {
    await helpers.seedAdmin();
    const { cookieHeader } = await helpers.login();

    await Patient.create([
      { fullName: 'P1', age: 30, gender: 'Male', phone: '+1 202 3334444', condition: 'Diabetes' },
      { fullName: 'P2', age: 35, gender: 'Female', phone: '+1 202 3334666', condition: 'Diabetes' },
      { fullName: 'P3', age: 28, gender: 'Female', phone: '+1 202 3334777', condition: 'Asthma' },
    ]);

    const res = await require('supertest')(helpers.app)
      .get('/api/v1/analytics/patients-by-condition')
      .set('Cookie', cookieHeader);

    expect(res.body.data[0].condition).toBe('Diabetes');
    expect(res.body.data[0].count).toBe(2);
    expect(res.body.data[0].percentage).toBe(66.7);
  });

  it('patients-per-doctor returns per-doctor load, sorting and avg', async () => {
    await helpers.seedAdmin();
    const { cookieHeader } = await helpers.login();

    const d1 = await Doctor.create(doctorPayload(1));
    const d2 = await Doctor.create(doctorPayload(2));

    await Patient.create([
      { fullName: 'P1', age: 30, gender: 'Male', phone: '+1 202 3334444', condition: 'Diabetes', doctorId: d1._id },
      { fullName: 'P2', age: 35, gender: 'Female', phone: '+1 202 3334666', condition: 'Diabetes', doctorId: d1._id },
      { fullName: 'P3', age: 28, gender: 'Female', phone: '+1 202 3334777', condition: 'Asthma', doctorId: d2._id },
    ]);

    const res = await require('supertest')(helpers.app)
      .get('/api/v1/analytics/patients-per-doctor')
      .set('Cookie', cookieHeader);

    expect(res.body.data.avgPatientsPerDoctor).toBe(1.5);
    expect(res.body.data.rows[0].patientCount).toBe(2);
    expect(res.body.data.rows[0].name).toBe('Dr. Test 1');
  });

  it('doctor-specializations aggregates the distribution', async () => {
    await helpers.seedAdmin();
    const { cookieHeader } = await helpers.login();

    await Doctor.create([
      doctorPayload(1, { specialization: 'Cardiology' }),
      doctorPayload(2, { specialization: 'Cardiology' }),
      doctorPayload(3, { specialization: 'Neurology' }),
    ]);

    const res = await require('supertest')(helpers.app)
      .get('/api/v1/analytics/doctor-specializations')
      .set('Cookie', cookieHeader);

    expect(res.status).toBe(200);
    expect(res.body.data[0]).toEqual({
      specialization: 'Cardiology',
      count: 2,
      percentage: 66.7,
    });
  });

  it('blocks analytics for unauthenticated callers (401)', async () => {
    const res = await require('supertest')(helpers.app).get('/api/v1/analytics/overview');
    expect(res.status).toBe(401);
  });
});
