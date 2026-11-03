const Patient = require('../models/patient.model');
const patientService = require('../services/patient.service');
const { sendSuccess, buildMeta } = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');

/** GET /patients */
async function listPatients(req, res, next) {
  try {
    const { data, meta } = await patientService.listPatients(req.query);
    return sendSuccess(res, { message: 'Patients fetched', data, meta });
  } catch (err) {
    return next(err);
  }
}

/** GET /patients/:id */
async function getPatient(req, res, next) {
  try {
    const data = await patientService.getPatientById(req.params.id);
    return sendSuccess(res, { message: 'Patient fetched', data });
  } catch (err) {
    return next(err);
  }
}

/** POST /patients */
async function createPatient(req, res, next) {
  try {
    const data = await patientService.createPatient(req.body);
    return sendSuccess(res, { status: 201, message: 'Patient created', data });
  } catch (err) {
    return next(err);
  }
}

/** PATCH /patients/:id */
async function updatePatient(req, res, next) {
  try {
    const data = await patientService.updatePatient(req.params.id, req.body);
    return sendSuccess(res, { message: 'Patient updated', data });
  } catch (err) {
    return next(err);
  }
}

/** DELETE /patients/:id */
async function deletePatient(req, res, next) {
  try {
    await patientService.deletePatient(req.params.id);
    return sendSuccess(res, { message: 'Patient deleted' });
  } catch (err) {
    return next(err);
  }
}

module.exports = { listPatients, getPatient, createPatient, updatePatient, deletePatient };
