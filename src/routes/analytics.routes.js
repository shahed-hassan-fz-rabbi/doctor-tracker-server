const { Router } = require('express');
const analyticsController = require('../controllers/analytics.controller');
const { requireAuth, requireDemoViewer, requireAdminOrDemoViewer } = require('../middlewares/auth.middleware');

const router = Router();

// Analytics is admin-only as well.
router.use(requireAuth, requireDemoViewer);

// All analytics endpoints require admin role (security fix: restrict analytics access)
router.get('/overview', requireAdminOrDemoViewer, analyticsController.getOverview);
router.get('/patient-growth', requireAdminOrDemoViewer, analyticsController.getPatientGrowth);
router.get('/patients-by-condition', requireAdminOrDemoViewer, analyticsController.getPatientsByCondition);
router.get('/patients-per-doctor', requireAdminOrDemoViewer, analyticsController.getPatientsPerDoctor);
router.get('/doctor-specializations', requireAdminOrDemoViewer, analyticsController.getDoctorSpecializations);

module.exports = router;
