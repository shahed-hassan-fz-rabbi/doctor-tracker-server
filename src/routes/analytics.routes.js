const { Router } = require('express');
const analyticsController = require('../controllers/analytics.controller');
const { requireAuth } = require('../middlewares/auth.middleware');

const router = Router();

// Analytics is admin-only as well.
router.use(requireAuth);

router.get('/overview', analyticsController.getOverview);
router.get('/patient-growth', analyticsController.getPatientGrowth);
router.get('/patients-by-condition', analyticsController.getPatientsByCondition);
router.get('/patients-per-doctor', analyticsController.getPatientsPerDoctor);
router.get('/doctor-specializations', analyticsController.getDoctorSpecializations);

module.exports = router;
