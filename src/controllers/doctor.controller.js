const Doctor = require('../models/doctor.model');
const doctorService = require('../services/doctor.service');
const { sendSuccess, buildMeta } = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');

/** GET /doctors */
async function listDoctors(req, res, next) {
  try {
    const { data, meta } = await doctorService.listDoctors(req.query);
    return sendSuccess(res, { message: 'Doctors fetched', data, meta });
  } catch (err) {
    return next(err);
  }
}

/** GET /doctors/:id */
async function getDoctor(req, res, next) {
  try {
    const data = await doctorService.getDoctorById(req.params.id);
    return sendSuccess(res, { message: 'Doctor fetched', data });
  } catch (err) {
    return next(err);
  }
}

/** GET /doctors/:id/patients */
async function getDoctorPatients(req, res, next) {
  try {
    const { data, meta } = await doctorService.getDoctorPatients(req.params.id, req.query);
    return sendSuccess(res, { message: 'Doctor patients fetched', data, meta });
  } catch (err) {
    return next(err);
  }
}

/** POST /doctors */
async function createDoctor(req, res, next) {
  try {
    const data = await doctorService.createDoctor(req.body);
    return sendSuccess(res, { status: 201, message: 'Doctor created', data });
  } catch (err) {
    return next(err);
  }
}

/** PATCH /doctors/:id */
async function updateDoctor(req, res, next) {
  try {
    const data = await doctorService.updateDoctor(req.params.id, req.body);
    return sendSuccess(res, { message: 'Doctor updated', data });
  } catch (err) {
    return next(err);
  }
}

/** DELETE /doctors/:id */
async function deleteDoctor(req, res, next) {
  try {
    await doctorService.deleteDoctor(req.params.id);
    return sendSuccess(res, { message: 'Doctor deleted' });
  } catch (err) {
    return next(err);
  }
}

module.exports = { listDoctors, getDoctor, getDoctorPatients, createDoctor, updateDoctor, deleteDoctor };
