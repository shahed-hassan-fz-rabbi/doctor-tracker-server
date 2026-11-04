const { describe, it, expect, beforeAll, afterAll } = globalThis;
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const helpers = require('./helpers');
const seedDemoData = require('../scripts/seedDemoData');
const seedDemoAccount = require('../scripts/seedDemoAccount');

describe('isolated demo provisioning scripts', () => {
  let demoUri;

  beforeAll(async () => {
    await helpers.connect();
    demoUri = process.env.TEST_MONGODB_URI.replace('/doctor-tracker-test', '/doctor-tracker-demo');
  });

  afterAll(async () => {
    const connection = await mongoose.createConnection(demoUri).asPromise();
    await connection.dropDatabase();
    await connection.close();
  });

  it('refuses a URI for any database other than doctor-tracker-demo before connecting', async () => {
    await expect(seedDemoData({ uri: process.env.TEST_MONGODB_URI })).rejects.toThrow(/must target doctor-tracker-demo/);
  });

  it('seeds synthetic demo records and provisions a hashed, roleless viewer account only in the demo database', async () => {
    const result = await seedDemoData({ uri: demoUri });
    expect(result).toEqual({ doctors: 40, patients: 260 });
    const accountResult = await seedDemoAccount({
      uri: demoUri, email: 'demo@doctortracker.test', password: 'safe-demo-password-for-tests-123',
    });
    expect(accountResult).toEqual({ provisioned: true, role: 'viewer', database: 'doctor-tracker-demo' });

    const connection = await mongoose.createConnection(demoUri).asPromise();
    try {
      const DemoAccount = connection.model('DemoAccount', require('../src/models/demoAccount.model').schema);
      const Doctor = connection.model('Doctor', require('../src/models/doctor.model').schema);
      const Patient = connection.model('Patient', require('../src/models/patient.model').schema);
      const account = await DemoAccount.findOne({ email: 'demo@doctortracker.test' }).select('+passwordHash').lean();
      expect(account.role).toBeUndefined();
      expect(await bcrypt.compare('safe-demo-password-for-tests-123', account.passwordHash)).toBe(true);
      expect(await Doctor.countDocuments()).toBe(40);
      expect(await Patient.countDocuments()).toBe(260);
    } finally {
      await connection.close();
    }
    expect(await mongoose.connection.collection('doctors').countDocuments()).toBe(0);
    expect(await mongoose.connection.collection('patients').countDocuments()).toBe(0);
  });
});
