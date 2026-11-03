/**
 * Seeds the database with realistic SYNTHETIC demo data (no real patients).
 * Useful for the dashboard, charts and screenshots during development.
 * Run: npm run seed:demo
 */
const mongoose = require('mongoose');
const { z } = require('zod');
require('dotenv').config();

const Doctor = require('../src/models/doctor.model');
const Patient = require('../src/models/patient.model');
const { connectDatabase, disconnectDatabase } = require('../src/config/database');
const { SPECIALIZATIONS } = require('../src/models/doctor.model');
const { CONDITIONS, GENDERS } = require('../src/models/patient.model');
const logger = require('../src/utils/logger');

const cfg = z.object({ MONGODB_URI: z.string().min(1) }).parse(process.env);

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

async function seedDemoData() {
  await connectDatabase(cfg.MONGODB_URI);

  const existingCounts = await Promise.all([Doctor.countDocuments(), Patient.countDocuments()]);
  if (existingCounts[0] > 0 || existingCounts[1] > 0) {
    logger.warn(`Doctors: ${existingCounts[0]}, Patients: ${existingCounts[1]} — skipping demo seed (collections are not empty).`);
    logger.warn('Drop doctor-tracker first if you want fresh demo data: db.getSiblingDB("doctor-tracker").dropDatabase()');
    await disconnectDatabase();
    return;
  }

  logger.info('Seeding synthetic demo data...');

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

  const insertedDoctors = await Doctor.insertMany(doctors, { ordered: false });

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

  await Patient.insertMany(patients, { ordered: false });

  logger.info(`✅ Seeded ${insertedDoctors.length} doctors and ${patients.length} patients.`);
  await disconnectDatabase();
}

if (require.main === module) {
  seedDemoData().catch((err) => {
    logger.error('Demo seed failed:', err?.message);
    process.exit(1);
  });
}

module.exports = seedDemoData;
