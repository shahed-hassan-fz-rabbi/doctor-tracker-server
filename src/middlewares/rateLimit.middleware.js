const rateLimit = require('express-rate-limit');
const env = require('../config/env');

/** General limiter for the whole API. */
const apiLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later' },
});

/**
 * Strict limiter on the login route only — defends against
 * credential brute force without hurting normal traffic.
 */
const loginLimiter = rateLimit({
  windowMs: env.LOGIN_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
  max: env.LOGIN_RATE_LIMIT_MAX,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts, please try again later' },
});

module.exports = { apiLimiter, loginLimiter };
