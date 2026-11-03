const { Router } = require('express');
const { requireAuth } = require('../middlewares/auth.middleware');
const doctorController = require('../controllers/doctor.controller');
const patientService = require('../services/patient.service');
const validate = require('../middlewares/validate.middleware');
const { sendSuccess } = require('../utils/apiResponse');
const {
  doctorBodySchema,
  doctorListQuerySchema,
  doctorIdParamSchema,
  unassignPatientFromDoctorParamsSchema,
  patientBodySchema,
  composedDoctorUpdateSchema,
  composedAddPatientUnderDoctorSchema,
} = require('../validators');

const router = Router();

// Doctor management is admin-only — every route requires a session.
router.use(requireAuth);

router.get('/', validate(doctorListQuerySchema), doctorController.listDoctors);
router.post('/', validate(doctorBodySchema), doctorController.createDoctor);

router.get('/:id', validate(doctorIdParamSchema), doctorController.getDoctor);
router.patch('/:id', validate(composedDoctorUpdateSchema), doctorController.updateDoctor);
router.delete('/:id', validate(doctorIdParamSchema), doctorController.deleteDoctor);

// List the patients that belong to one doctor (doctors/:id details page).
router.get('/:id/patients', validate(doctorIdParamSchema), doctorController.getDoctorPatients);

/**
 * Add a new patient directly under this doctor. The doctor comes from the
 * URL so the client never posts an inconsistent doctorId — the same service
 * create path used by POST /patients runs (validation + FK check included).
 */
router.post(
  '/:id/patients',
  validate(composedAddPatientUnderDoctorSchema),
  async (req, res, next) => {
    try {
      const data = await patientService.createPatient({
        ...req.body,
        doctorId: req.params.id,
      });
      return sendSuccess(res, { status: 201, message: 'Patient created under doctor', data });
    } catch (err) {
      return next(err);
    }
  }
);

// Unassign (remove) a patient from this doctor without deleting the record.
router.delete(
  '/:id/patients/:patientId',
  validate(unassignPatientFromDoctorParamsSchema),
  async (req, res, next) => {
    try {
      await patientService.unassignPatient(req.params.id, req.params.patientId);
      return sendSuccess(res, { message: 'Patient removed from doctor' });
    } catch (err) {
      return next(err);
    }
  }
);

module.exports = router;
