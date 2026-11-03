const { Router } = require('express');

const router = Router();

function healthResponse(mongooseState, uptimeSeconds = Math.floor(process.uptime())) {
  const connected = mongooseState === 1;
  return {
    statusCode: connected ? 200 : 503,
    body: {
      success: connected,
      message: connected ? 'Doctor Tracker API is healthy' : 'Database is unavailable',
      data: {
        status: connected ? 'ok' : 'unavailable',
        mongodb: connected ? 'connected' : 'disconnected',
        uptimeSeconds,
      },
    },
  };
}

/** Mounted at /api/v1/health — probe for Render / uptime checks. */
router.get('/', (_req, res) => {
  const mongooseState = require('mongoose').connection.readyState;
  const response = healthResponse(mongooseState);
  res.status(response.statusCode).json(response.body);
});

module.exports = router;
module.exports.healthResponse = healthResponse;
