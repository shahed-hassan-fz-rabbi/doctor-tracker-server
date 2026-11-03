const { Router } = require('express');

const router = Router();

/** Mounted at /api/v1/health — probe for Render / uptime checks. */
router.get('/', (_req, res) => {
  const mongooseState = require('mongoose').connection.readyState;
  res.status(200).json({
    success: true,
    message: 'Doctor Tracker API is healthy',
    data: {
      status: 'ok',
      mongodb: mongooseState === 1 ? 'connected' : 'disconnected',
      uptimeSeconds: Math.floor(process.uptime()),
    },
  });
});

module.exports = router;
