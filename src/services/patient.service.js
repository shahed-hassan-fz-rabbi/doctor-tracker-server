const mongoose = require('mongoose');
const Patient = require('../models/patient.model');
const Doctor = require('../models/doctor.model');
const ApiError = require('../utils/apiError');
const { buildMeta } = require('../utils/apiResponse');
const { buildPagination, parseDateRange, escapeRegex } = require('../utils/query');

const SORT_FIELDS = {
  fullName: 'fullName',
  age: 'age',
  condition: 'condition',
  gender: 'gender',
  createdAt: 'createdAt',
};

/**
 * Mongo filter for the patients list from validated params only.
 * "unassigned" is a valid doctor filter meaning patients with no doctor.
 */
function buildFilter({ search, condition, gender, doctorId, dateFrom, dateTo }) {
  const filter = {};
  const normalizedDoctorId = doctorId === '' ? undefined : doctorId;

  if (search) {
    const safe = escapeRegex(search);
    filter.$or = [
      { fullName: { $regex: safe, $options: 'i' } },
      { phone: { $regex: safe, $options: 'i' } },
      { email: { $regex: safe, $options: 'i' } },
    ];
  }
  if (condition) filter.condition = condition;
  if (gender) filter.gender = gender;

  if (normalizedDoctorId === 'unassigned') {
    filter.doctorId = null;
  } else if (normalizedDoctorId) {
    filter.doctorId = new mongoose.Types.ObjectId(normalizedDoctorId);
  }

  const dateRange = parseDateRange(dateFrom, dateTo);
  if (dateRange) filter.createdAt = dateRange;

  return filter;
}

/**
 * Paginated patients list. The doctor's name is attached through a
 * single $lookup aggregation (one DB round trip, no N+1) driven by $facet.
 */
async function listPatients(query) {
  const { page, limit, skip } = buildPagination(query.page, query.limit);
  const filter = buildFilter(query);

  const sortKey = SORT_FIELDS[query.sortBy] || 'createdAt';
  const sortDir = query.sortOrder === 'asc' ? 1 : -1;
  const sort = { [sortKey]: sortDir, _id: 1 };

  const pipeline = [
    { $match: filter },
    {
      $lookup: {
        from: 'doctors',
        localField: 'doctorId',
        foreignField: '_id',
        as: 'doctor',
        pipeline: [{ $project: { name: 1, specialization: 1, hospital: 1 } }],
      },
    },
    { $addFields: { doctor: { $first: '$doctor' } } },
    { $sort: sort },
    {
      $facet: {
        rows: [
          { $skip: skip },
          { $limit: limit },
          {
            $project: {
              fullName: 1,
              age: 1,
              gender: 1,
              phone: 1,
              email: 1,
              condition: 1,
              notes: 1,
              doctorId: 1,
              doctor: 1,
              createdAt: 1,
              updatedAt: 1,
            },
          },
        ],
        total: [{ $count: 'count' }],
      },
    },
  ];

  const [{ rows, total }] = await Patient.aggregate(pipeline);
  const totalDocs = total && total[0] ? total[0].count : 0;

  return { data: rows, meta: buildMeta({ page, limit, total: totalDocs }) };
}

/**
 * Single patient record with the treating doctor embedded — one query each:
 * the patient record (lean) and the referenced doctor document.
 */
async function getPatientById(id) {
  const patient = await Patient.findById(id).lean();
  if (!patient) throw ApiError.notFound('Patient not found');

  if (patient.doctorId) {
    const doctor = await Doctor.findById(patient.doctorId)
      .select('name specialization hospital')
      .lean();
    patient.doctor = doctor || null;
  }

  if (patient.doctorId) patient.doctorId = patient.doctorId.toString();
  return patient;
}

async function createPatient(data) {
  // Reject doctorId that does not exist — FK-style integrity check.
  if (data.doctorId && data.doctorId !== 'unassigned') {
    const exists = await Doctor.exists({ _id: data.doctorId });
    if (!exists) throw ApiError.badRequest('doctorId does not reference an existing doctor');
  }

  const payload = { ...data };
  if (payload.doctorId === 'unassigned') payload.doctorId = null;
  if (payload.email === '') payload.email = null;

  const patient = await Patient.create(payload);
  return patient.toJSON();
}

async function updatePatient(id, data) {
  const payload = { ...data };
  if (payload.doctorId) {
    if (payload.doctorId === 'unassigned') {
      payload.doctorId = null;
    } else {
      const exists = await Doctor.exists({ _id: payload.doctorId });
      if (!exists) throw ApiError.badRequest('doctorId does not reference an existing doctor');
    }
  }
  if (payload.email === '') payload.email = null;

  const patient = await Patient.findByIdAndUpdate(id, payload, {
    new: true,
    runValidators: true,
  });
  if (!patient) throw ApiError.notFound('Patient not found');
  return patient.toJSON();
}

async function deletePatient(id) {
  const patient = await Patient.findByIdAndDelete(id);
  if (!patient) throw ApiError.notFound('Patient not found');
  return patient.toJSON();
}

/**
 * Removes a patient from a doctor's roster without deleting the record —
 * used by the "delete from doctor's patient list" flow on the doctor page.
 */
async function unassignPatient(doctorId, patientId) {
  const doctor = await Doctor.exists({ _id: doctorId });
  if (!doctor) throw ApiError.notFound('Doctor not found');

  const patient = await Patient.findById(patientId);
  if (!patient) throw ApiError.notFound('Patient not found');
  if (!patient.doctorId || patient.doctorId.toString() !== doctorId.toString()) {
    throw ApiError.badRequest('This patient is not assigned to this doctor');
  }

  patient.doctorId = null;
  await patient.save();
  return patient.toJSON();
}

module.exports = { listPatients, getPatientById, createPatient, updatePatient, deletePatient, unassignPatient, buildFilter };
