/**
 * Seeds the database with realistic SYNTHETIC demo data (no real patients).
 * Useful for the dashboard, charts and screenshots during development.
 * Run: npm run seed:demo
 */
const mongoose = require('mongoose');

const Doctor = require('../src/models/doctor.model');
const Patient = require('../src/models/patient.model');
const DemoAccount = require('../src/models/demoAccount.model');
const { isDemoMongoUri } = require('../src/config/mongoUri');
const { SPECIALIZATIONS } = require('../src/models/doctor.model');
const { CONDITIONS, GENDERS } = require('../src/models/patient.model');
const logger = require('../src/utils/logger');

const FIRST_NAMES = [
  'Ayesha', 'Reza', 'Mita', 'Farhan', 'Nusrat', 'Imran', 'Sabrina', 'Tanjir', 'Lamia', 'Rafid',
  'Aardra', 'Pial', 'Sourav', 'Mehjabin', 'Omer', 'Jannat', 'Ridwan', 'Anika', 'Shaon', 'Priyanka',
];
const LAST_NAMES = [
  'Ahmed', 'Kabir', 'Haque', 'Rahman', 'Islam', 'Chowdhury', 'Sultana', 'Barua', 'Das', 'Bhuiyan',
  'Akash', 'Mozumder', 'Talukder', 'Nizam', 'Karim',
];
const HOSPITALS = [
  'Greenview General Hospital',
  'St. Marina Medical Center',
  'Lakeside Polyclinic',
  'Rivershore Heart Institute',
  'Crestline Trauma & Ortho Hospital',
  'Sunnyhills Family Hospital',
  'Harborview Specialty Clinic',
  'Evergreen Community Hospital',
];
const PHONE_PREFIXES = ['+1 202', '+1 312', '+1 415', '+44 20', '+66 2', '+880 17', '+65 6'];

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function randName(i) {
  return `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}${i > 299 ? ` ${i}` : ''}`;
}

/** Makes createdAt land on a plausible timeline inside the last N days. */
function recentDate(maxDaysAgo) {
  const ms = Math.floor(Math.random() * maxDaysAgo * 24 * 60 * 60 * 1000);
  return new Date(Date.now() - ms);
}

async function seedDemoData({
  uri = process.env.DEMO_SEED_MONGODB_URI,
  requireEmptyDatabase = true,
} = {}) {
  if (!isDemoMongoUri(uri)) {
    throw new Error('Demo seed refused: connection URI must target doctor-tracker-demo.');
  }

  const connection = await mongoose.createConnection(uri, {
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
  }).asPromise();
  try {
    if (requireEmptyDatabase) {
      const collections = await connection.db.listCollections().toArray();
      for (const { name } of collections) {
        const count = await connection.db.collection(name).countDocuments({});
        if (count > 0) {
          throw new Error('Demo seed refused: doctor-tracker-demo must be empty; no data was changed.');
        }
      }
    }

    const SeedDoctor = connection.model('Doctor', Doctor.schema);
    const SeedPatient = connection.model('Patient', Patient.schema);
    const SeedDemoAccount = connection.model('DemoAccount', DemoAccount.schema);
    const existingCounts = await Promise.all([
      SeedDoctor.countDocuments(),
      SeedPatient.countDocuments(),
      SeedDemoAccount.countDocuments(),
    ]);
    if (existingCounts.some((count) => count > 0)) {
      throw new Error('Demo seed refused: demo data collections must be empty; no data was changed.');
    }

    await Promise.all([SeedDoctor.init(), SeedPatient.init(), SeedDemoAccount.init()]);

    logger.info('Seeding synthetic demo data into doctor-tracker-demo...');

    const SPECIALITIES = SPECIALIZATIONS;
    const doctorCount = 40;
    const patientCount = 260;

    const doctors = [];
    for (let i = 0; i < doctorCount; i += 1) {
      const createdAt = recentDate(240);
      doctors.push({
        name: `Dr. ${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
        specialization: pick(SPECIALITIES),
        hospital: pick(HOSPITALS),
        phone: `${pick(PHONE_PREFIXES)} ${Math.floor(100000 + Math.random() * 899999)}`,
        email: `dr.${i + 1}.${Math.random().toString(36).slice(2, 7)}@dtp-clinic.example.com`,
        isActive: Math.random() > 0.15,
        createdAt,
        updatedAt: createdAt,
      });
    }

    const insertedDoctors = await SeedDoctor.insertMany(doctors, { ordered: false });

    const patients = [];
    for (let i = 0; i < patientCount; i += 1) {
      const createdAt = recentDate(150);
      const assigned = Math.random() < 0.72;
      patients.push({
        fullName: randName(i),
        age: 1 + Math.floor(Math.pow(Math.random(), 0.9) * 89),
        gender: pick(GENDERS),
        phone: `${pick(PHONE_PREFIXES)} ${Math.floor(100000 + Math.random() * 899999)}`,
        email: Math.random() < 0.5 ? null : `p${i + 1}${Math.random().toString(36).slice(2, 6)}@dt-demo.example.com`,
        condition: pick(CONDITIONS),
        doctorId: assigned ? pick(insertedDoctors)._id : null,
        notes: Math.random() < 0.4 ? 'Entry generated for demo telemetry and features.' : '',
        createdAt,
        updatedAt: createdAt,
      });
    }

    await SeedPatient.insertMany(patients, { ordered: false });

    logger.info(`✅ Seeded ${insertedDoctors.length} synthetic doctors and ${patients.length} synthetic patients.`);
    return { doctors: insertedDoctors.length, patients: patients.length };
  } finally {
    await connection.close();
  }
}

if (require.main === module) {
  seedDemoData().catch((err) => {
    logger.error('Demo seed failed:', err?.message);
    process.exit(1);
  });
}

module.exports = seedDemoData;
