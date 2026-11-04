/**
 * One-time provisioning against the isolated demo database.
 * Uses only DEMO_SEED_MONGODB_URI (never loads the app's .env), then closes
 * the connection and clears credential variables from this process.
 */
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const DemoAccount = require('../src/models/demoAccount.model');
const Doctor = require('../src/models/doctor.model');
const Patient = require('../src/models/patient.model');
const Admin = require('../src/models/admin.model');
const User = require('../src/models/user.model');
const { isDemoMongoUri } = require('../src/config/mongoUri');

async function seedDemoAccount({ uri = process.env.DEMO_SEED_MONGODB_URI, email = process.env.DEMO_ACCOUNT_EMAIL, password = process.env.DEMO_ACCOUNT_PASSWORD } = {}) {
  if (!isDemoMongoUri(uri)) throw new Error('Demo account seed refused: URI must target doctor-tracker-demo.');
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('DEMO_ACCOUNT_EMAIL must be a valid email.');
  if (!password || password.length < 8) throw new Error('DEMO_ACCOUNT_PASSWORD must be at least 8 characters.');

  const connection = await mongoose.createConnection(uri, {
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
  }).asPromise();
  try {
    const Account = connection.model('DemoAccount', DemoAccount.schema);
    const SeedDoctor = connection.model('Doctor', Doctor.schema);
    const SeedPatient = connection.model('Patient', Patient.schema);
    const SeedAdmin = connection.model('Admin', Admin.schema);
    const SeedUser = connection.model('User', User.schema);

    const [doctors, patients, admins, users, accounts] = await Promise.all([
      SeedDoctor.find({}).select('email').lean(), SeedPatient.find({}).select('email').lean(),
      SeedAdmin.countDocuments(), SeedUser.countDocuments(), Account.countDocuments(),
    ]);
    const allSynthetic = doctors.length === 40 && patients.length === 260
      && doctors.every((d) => d.email.endsWith('@dtp-clinic.example.com'))
      && patients.every((p) => !p.email || p.email.endsWith('@dt-demo.example.com'));
    if (!allSynthetic || admins !== 0 || users !== 0 || accounts !== 0) {
      throw new Error('Demo account seed refused: expected only the known synthetic demo dataset and no existing accounts. No data was changed.');
    }

    await Account.init();
    await Account.create({
      email: email.trim().toLowerCase(),
      passwordHash: await bcrypt.hash(password, 12),
      name: 'Doctor Tracker Demo Viewer',
      active: true,
    });
    return { provisioned: true, role: 'viewer', database: 'doctor-tracker-demo' };
  } finally {
    await connection.close();
    delete process.env.DEMO_SEED_MONGODB_URI;
    delete process.env.DEMO_ACCOUNT_PASSWORD;
  }
}

if (require.main === module) {
  seedDemoAccount()
    .then(() => console.info('Demo viewer account provisioned. Revoke the temporary Atlas seed user now.'))
    .catch((error) => {
      console.error('Demo account provisioning failed:', error.message);
      process.exitCode = 1;
    })
    .finally(() => {
      delete process.env.DEMO_SEED_MONGODB_URI;
      delete process.env.DEMO_ACCOUNT_PASSWORD;
    });
}

module.exports = seedDemoAccount;
