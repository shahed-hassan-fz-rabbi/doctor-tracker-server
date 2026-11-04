const { Router } = require('express');
const { requireAuth, requireAdmin, requireDemoViewer, requireAdminOrDemoViewer } = require('../middlewares/auth.middleware');
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
router.use(requireAuth, requireDemoViewer);

// Read routes — admin role required (security fix: restrict patient data access)
router.get('/', requireAdminOrDemoViewer, validate(patientListQuerySchema), patientController.listPatients);
router.get('/:id', requireAdminOrDemoViewer, validate(patientIdParamSchema), patientController.getPatient);

// Write routes — admin role required
router.post('/', requireAdmin, validate(patientBodySchema), patientController.createPatient);
router.patch('/:id', requireAdmin, validate(composedPatientUpdateSchema), patientController.updatePatient);
router.delete('/:id', requireAdmin, validate(patientIdParamSchema), patientController.deletePatient);

module.exports = router;
