const { Router } = require('express');
const { requireAuth } = require('../middlewares/auth.middleware');
const patientController = require('../controllers/patient.controller');
const validate = require('../middlewares/validate.middleware');
const {
  patientBodySchema,
  patientListQuerySchema,
  patientIdParamSchema,
  composedPatientUpdateSchema,
} = require('../validators');

const router = Router();

// Patient management is admin-only — every route requires a session.
router.use(requireAuth);

router.get('/', validate(patientListQuerySchema), patientController.listPatients);
router.post('/', validate(patientBodySchema), patientController.createPatient);

router.get('/:id', validate(patientIdParamSchema), patientController.getPatient);
router.patch('/:id', validate(composedPatientUpdateSchema), patientController.updatePatient);
router.delete('/:id', validate(patientIdParamSchema), patientController.deletePatient);

module.exports = router;
