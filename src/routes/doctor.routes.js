const { Router } = require('express');
const { requireAuth, requireAdmin } = require('../middlewares/auth.middleware');
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

// All routes require a valid session (viewer or admin).
router.use(requireAuth);

// Read routes — available to any authenticated user (viewer or admin)
router.get('/', validate(doctorListQuerySchema), doctorController.listDoctors);
router.get('/:id', validate(doctorIdParamSchema), doctorController.getDoctor);
router.get('/:id/patients', validate(doctorIdParamSchema), doctorController.getDoctorPatients);

// Write routes — admin role required
router.post('/', requireAdmin, validate(doctorBodySchema), doctorController.createDoctor);
router.patch('/:id', requireAdmin, validate(composedDoctorUpdateSchema), doctorController.updateDoctor);
router.delete('/:id', requireAdmin, validate(doctorIdParamSchema), doctorController.deleteDoctor);

/**
 * Add a new patient directly under this doctor (admin only).
 * The doctor comes from the URL so the client never posts an inconsistent
 * doctorId — the same service create path used by POST /patients runs.
 */
router.post(
  '/:id/patients',
  requireAdmin,
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

// Unassign (remove) a patient from this doctor without deleting the record (admin only).
router.delete(
  '/:id/patients/:patientId',
  requireAdmin,
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
