const analyticsService = require('../services/analytics.service');
const { sendSuccess } = require('../utils/apiResponse');

/** GET /analytics/overview */
async function getOverview(_req, res, next) {
  try {
    const data = await analyticsService.getOverview();
    return sendSuccess(res, { message: 'Analytics overview', data });
  } catch (err) {
    return next(err);
  }
}

/** GET /analytics/patient-growth?months=6 */
async function getPatientGrowth(req, res, next) {
  try {
    const months = Math.min(Math.max(parseInt(req.query.months, 10) || 6, 1), 24);
    const data = await analyticsService.getPatientGrowth(months);
    return sendSuccess(res, { message: 'Patient growth', data });
  } catch (err) {
    return next(err);
  }
}

/** GET /analytics/patients-by-condition */
async function getPatientsByCondition(_req, res, next) {
  try {
    const data = await analyticsService.getPatientsByCondition();
    return sendSuccess(res, { message: 'Patients by condition', data });
  } catch (err) {
    return next(err);
  }
}

/** GET /analytics/patients-per-doctor */
async function getPatientsPerDoctor(_req, res, next) {
  try {
    const data = await analyticsService.getPatientsPerDoctor();
    return sendSuccess(res, { message: 'Patients per doctor', data });
  } catch (err) {
    return next(err);
  }
}

/** GET /analytics/doctor-specializations */
async function getDoctorSpecializations(_req, res, next) {
  try {
    const data = await analyticsService.getDoctorSpecializations();
    return sendSuccess(res, { message: 'Doctor specializations', data });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getOverview,
  getPatientGrowth,
  getPatientsByCondition,
  getPatientsPerDoctor,
  getDoctorSpecializations,
};
