const { Router } = require('express');
const { requireAuth, requireAdmin } = require('../middlewares/auth.middleware');
const patientController = require('../controllers/patient.controller');
const validate = require('../middlewares/validate.middleware');
const {
  patientBodySchema,
  patientListQuerySchema,
  patientIdParamSchema,
  composedPatientUpdateSchema,
} = require('../validators');

const router = Router();

// All routes require a valid session.
router.use(requireAuth);

// Read routes — available to any authenticated user (viewer or admin)
router.get('/', validate(patientListQuerySchema), patientController.listPatients);
router.get('/:id', validate(patientIdParamSchema), patientController.getPatient);

// Write routes — admin role required
router.post('/', requireAdmin, validate(patientBodySchema), patientController.createPatient);
router.patch('/:id', requireAdmin, validate(composedPatientUpdateSchema), patientController.updatePatient);
router.delete('/:id', requireAdmin, validate(patientIdParamSchema), patientController.deletePatient);

module.exports = router;
