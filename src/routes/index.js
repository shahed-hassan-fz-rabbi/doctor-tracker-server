const { Router } = require('express');
const { apiLimiter } = require('../middlewares/rateLimit.middleware');

const router = Router();

router.use(apiLimiter);

router.get('/', (_req, res) => {
  res.json({
    success: true,
    message: 'Doctor Tracker API v1',
    data: {
      version: '1.0.0',
      endpoints: ['/auth', '/doctors', '/patients', '/analytics', '/health'],
    },
  });
});

router.use('/auth', require('./auth.routes'));
router.use('/doctors', require('./doctor.routes'));
router.use('/patients', require('./patient.routes'));
router.use('/analytics', require('./analytics.routes'));
router.use('/health', require('./health.routes'));

module.exports = router;
