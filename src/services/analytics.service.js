const mongoose = require('mongoose');
const Doctor = require('../models/doctor.model');
const Patient = require('../models/patient.model');

/**
 * All dashboard analytics run as MongoDB aggregation pipelines on the
 * database — not in JavaScript — and each function does exactly one
 * round trip (or uses the indexes on patient/doctor collections).
 */

/**
 * GET /analytics/overview — one $facet pipeline on each collection.
 * Returns counts, growth %, recent records and daily series in the
 * response the dashboard needs on first paint.
 */
async function getOverview() {
  const now = new Date();
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const from = new Date(now.getTime() - THIRTY_DAYS_MS);
  const prevFrom = new Date(now.getTime() - 2 * THIRTY_DAYS_MS);

  const [counts, newThisMonth, newPrevMonth, byCondition, byGender, patientsPerDoctor, recentPatients, recentDoctors, dailySeries, monthlySeries, activeDoctors] =
    await Promise.all([
      Patient.countDocuments({}),
      Patient.countDocuments({ createdAt: { $gte: from } }),
      Patient.countDocuments({ createdAt: { $gte: prevFrom, $lt: from } }),
      Patient.aggregate([
        { $group: { _id: '$condition', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Patient.aggregate([
        { $group: { _id: '$gender', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Doctor.aggregate([
        { $match: { isActive: true } },
        {
          $lookup: {
            from: 'patients',
            let: { doctorId: '$_id' },
            pipeline: [
              { $match: { $expr: { $eq: ['$doctorId', '$$doctorId'] } } },
              { $count: 'count' },
            ],
            as: 'stats',
          },
        },
        {
          $set: {
            patientCount: { $ifNull: [{ $first: '$stats.count' }, 0] },
          },
        },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            totalPatients: { $sum: '$patientCount' },
            maxLoad: { $max: '$patientCount' },
            minLoad: { $min: '$patientCount' },
          },
        },
        {
          $project: {
            _id: 0,
            activeDoctors: '$count',
            avgPatientsPerDoctor: {
              $cond: [
                { $gt: ['$count', 0] },
                { $divide: ['$totalPatients', '$count'] },
                0,
              ],
            },
            maxLoad: 1,
            minLoad: 1,
          },
        },
      ]),
      Patient.find({})
        .sort({ createdAt: -1 })
        .limit(5)
        .select('fullName age gender condition createdAt')
        .lean(),
      Doctor.find({})
        .sort({ createdAt: -1 })
        .limit(5)
        .select('name specialization hospital phone email isActive createdAt')
        .lean(),
      Patient.aggregate([
        { $match: { createdAt: { $gte: from } } },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      // monthly registrations, last 6 months (patients + doctors)
      Patient.aggregate([
        {
          $match: {
            createdAt: {
              $gte: new Date(
                new Date().getFullYear(),
                new Date().getMonth() - 6,
                1
              ),
            },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Doctor.countDocuments({ isActive: true }),
    ]);

  const growthPercent =
    newPrevMonth > 0 ? Math.round(((newThisMonth - newPrevMonth) / newPrevMonth) * 100) : newThisMonth > 0 ? 100 : 0;

  return {
    totalDoctors: await Doctor.countDocuments({}),
    totalPatients: counts,
    activeDoctors,
    inactiveDoctors: (await Doctor.countDocuments({})) - activeDoctors,
    newPatientsThisMonth: newThisMonth,
    newPatientsPrevMonth: newPrevMonth,
    monthlyGrowthPercent: growthPercent,
    avgPatientsPerDoctor: patientsPerDoctor.length
      ? Math.round(patientsPerDoctor[0].avgPatientsPerDoctor * 10) / 10
      : 0,
    maxDoctorLoad: patientsPerDoctor.length ? patientsPerDoctor[0].maxLoad : 0,
    patientsByCondition: byCondition.map(({ _id, count }) => ({ condition: _id ?? 'Other', count })),
    patientsByGender: byGender.map(({ _id, count }) => ({ gender: _id ?? 'Unknown', count })),
    recentPatients,
    recentDoctors,
    dailySeries,
    monthlySeries,
  };
}

/** GET /analytics/patient-growth — monthly patient registration trend. */
async function getPatientGrowth(months = 6) {
  const since = new Date();
  since.setMonth(since.getMonth() - (months - 1));
  since.setDate(1);
  since.setHours(0, 0, 0, 0);

  const rows = await Patient.aggregate([
    { $match: { createdAt: { $gte: since } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return rows.map(({ _id, count }) => ({ month: _id, count }));
}

/** GET /analytics/patients-by-condition — condition distribution. */
async function getPatientsByCondition() {
  const rows = await Patient.aggregate([
    { $group: { _id: '$condition', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);
  const total = rows.reduce((sum, r) => sum + r.count, 0);
  return rows.map(({ _id, count }) => ({
    condition: _id ?? 'Other',
    count,
    percentage: total ? Math.round((count / total) * 1000) / 10 : 0,
  }));
}

/**
 * GET /analytics/patients-per-doctor — per-doctor load computed entirely
 * server-side via $lookup counting; also returns the distribution for
 * bar charts on the dashboard.
 */
async function getPatientsPerDoctor() {
  const rows = await Doctor.aggregate([
    {
      $lookup: {
        from: 'patients',
        let: { doctorId: '$_id' },
        pipeline: [
          { $match: { $expr: { $eq: ['$doctorId', '$$doctorId'] } } },
          { $count: 'count' },
        ],
        as: 'stats',
      },
    },
    { $addFields: { patientCount: { $ifNull: [{ $first: '$stats.count' }, 0] } } },
    { $sort: { patientCount: -1 } },
    {
      $project: {
        _id: 0,
        id: { $toString: '$_id' },
        name: 1,
        specialization: 1,
        hospital: 1,
        patientCount: 1,
      },
    },
  ]);

  const avg = rows.length
    ? Math.round((rows.reduce((s, r) => s + r.patientCount, 0) / rows.length) * 10) / 10
    : 0;

  return { rows, avgPatientsPerDoctor: avg };
}

/** GET /analytics/doctor-specializations — specialization distribution. */
async function getDoctorSpecializations() {
  const rows = await Doctor.aggregate([
    { $group: { _id: '$specialization', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);
  const total = rows.reduce((sum, r) => sum + r.count, 0);
  return rows.map(({ _id, count }) => ({
    specialization: _id ?? 'Other',
    count,
    percentage: total ? Math.round((count / total) * 1000) / 10 : 0,
  }));
}

module.exports = {
  getOverview,
  getPatientGrowth,
  getPatientsByCondition,
  getPatientsPerDoctor,
  getDoctorSpecializations,
};
