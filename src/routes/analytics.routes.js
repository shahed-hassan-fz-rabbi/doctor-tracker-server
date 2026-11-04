const { Router } = require('express');
const analyticsController = require('../controllers/analytics.controller');
const { requireAuth, requireAdmin, requireDemoViewer } = require('../middlewares/auth.middleware');

const router = Router();

// Analytics is admin-only as well.
router.use(requireAuth, requireDemoViewer);

// All analytics endpoints require admin role (security fix: restrict analytics access)
router.get('/overview', requireAdmin, analyticsController.getOverview);
router.get('/patient-growth', requireAdmin, analyticsController.getPatientGrowth);
router.get('/patients-by-condition', requireAdmin, analyticsController.getPatientsByCondition);
router.get('/patients-per-doctor', requireAdmin, analyticsController.getPatientsPerDoctor);
router.get('/doctor-specializations', requireAdmin, analyticsController.getDoctorSpecializations);

module.exports = router;
