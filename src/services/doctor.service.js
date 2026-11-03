const mongoose = require('mongoose');
const Doctor = require('../models/doctor.model');
const Patient = require('../models/patient.model');
const ApiError = require('../utils/apiError');
const { buildMeta } = require('../utils/apiResponse');
const { buildPagination, parseDateRange, escapeRegex } = require('../utils/query');

const SORT_FIELDS = {
  name: 'name',
  specialization: 'specialization',
  hospital: 'hospital',
  createdAt: 'createdAt',
};

/**
 * Builds the Mongo filter object for the doctors list from validated
 * query params. Only whitelisted keys are read.
 */
function buildFilter({ search, specialization, hospital, dateFrom, dateTo }) {
  const filter = {};

  if (search) {
    const safe = escapeRegex(search);
    filter.$or = [
      { name: { $regex: safe, $options: 'i' } },
      { specialization: { $regex: safe, $options: 'i' } },
      { hospital: { $regex: safe, $options: 'i' } },
      { email: { $regex: safe, $options: 'i' } },
    ];
  }
  if (specialization) filter.specialization = specialization;
  if (hospital) filter.hospital = { $regex: escapeRegex(hospital), $options: 'i' };

  const dateRange = parseDateRange(dateFrom, dateTo);
  if (dateRange) filter.createdAt = dateRange;

  return filter;
}

/**
 * Paginated doctors list with a live patientCount per doctor.
 *
 * Uses ONE aggregation round trip ($facet for total + page rows) and a
 * counting $lookup pipeline (only { $count } runs per doctor) so we never
 * pull every patient record into memory — no N+1 queries.
 */
async function listDoctors(query) {
  const { page, limit, skip } = buildPagination(query.page, query.limit);
  const filter = buildFilter(query);

  const sortKey = SORT_FIELDS[query.sortBy] || 'createdAt';
  const sortDir = query.sortOrder === 'asc' ? 1 : -1;
  const sort = { [sortKey]: sortDir, _id: 1 };

  const pipeline = [
    { $match: filter },
    {
      $lookup: {
        from: 'patients',
        let: { doctorId: '$_id' },
        pipeline: [
          { $match: { $expr: { $eq: ['$doctorId', '$$doctorId'] } } },
          { $count: 'count' },
        ],
        as: 'patientStats',
      },
    },
    { $addFields: { patientCount: { $ifNull: [{ $first: '$patientStats.count' }, 0] } } },
    { $sort: sort },
    {
      $facet: {
        rows: [
          { $skip: skip },
          { $limit: limit },
          {
            $project: {
              name: 1,
              specialization: 1,
              hospital: 1,
              phone: 1,
              email: 1,
              isActive: 1,
              patientCount: 1,
              createdAt: 1,
            },
          },
        ],
        total: [{ $count: 'count' }],
      },
    },
  ];

  const [{ rows, total }] = await Doctor.aggregate(pipeline);
  const totalDocs = total && total[0] ? total[0].count : 0;

  return { data: rows, meta: buildMeta({ page, limit, total: totalDocs }) };
}

/** Single doctor, lean read with a small projection + patient count. */
async function getDoctorById(id) {
  const doctor = await Doctor.findById(id)
    .select('name specialization hospital phone email isActive createdAt updatedAt')
    .lean();
  if (!doctor) throw ApiError.notFound('Doctor not found');

  const patientCount = await Patient.countDocuments({ doctorId: doctor._id });
  return { ...doctor, patientCount };
}

/**
 * Patients that belong to one doctor — paginated; reads are lean()
 * and projected, count runs in parallel with the page fetch.
 */
async function getDoctorPatients(id, query) {
  const doctor = await Doctor.findById(id).select('_id').lean();
  if (!doctor) throw ApiError.notFound('Doctor not found');

  const { page, limit, skip } = buildPagination(query.page, query.limit);

  const [rows, total] = await Promise.all([
    Patient.find({ doctorId: doctor._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('fullName age gender phone email condition doctorId createdAt')
      .lean(),
    Patient.countDocuments({ doctorId: doctor._id }),
  ]);

  return { data: rows, meta: buildMeta({ page, limit, total }) };
}

async function createDoctor(data) {
  const doctor = await Doctor.create(data);
  return doctor.toJSON();
}

async function updateDoctor(id, data) {
  const doctor = await Doctor.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true,
  });
  if (!doctor) throw ApiError.notFound('Doctor not found');
  return doctor.toJSON();
}

async function deleteDoctor(id) {
  const doctor = await Doctor.findByIdAndDelete(id);
  if (!doctor) throw ApiError.notFound('Doctor not found');

  // Unlink instead of deleting patients — records are preserved and can be
  // reassigned from the patients page.
  await Patient.updateMany({ doctorId: doctor._id }, { $set: { doctorId: null } });
  return doctor.toJSON();
}

module.exports = {
  listDoctors,
  getDoctorById,
  getDoctorPatients,
  createDoctor,
  updateDoctor,
  deleteDoctor,
  buildFilter,
};
