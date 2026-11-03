const jwt = require('jsonwebtoken');
const Admin = require('../models/admin.model');
const env = require('../config/env');
const ApiError = require('../utils/apiError');

/**
 * Reads the JWT either from the HttpOnly auth cookie (primary, set at login)
 * or the Authorization: Bearer header (handy for API clients and tests).
 * Verifies the token and re-checks the admin still exists — a deleted admin
 * must not keep access.
 */
async function requireAuth(req, _res, next) {
  try {
    const cookieToken = req.cookies ? req.cookies[env.COOKIE_NAME] : null;
    const headerToken =
      req.headers.authorization && req.headers.authorization.startsWith('Bearer ')
        ? req.headers.authorization.split(' ')[1]
        : null;

    if (!cookieToken && !headerToken) {
      throw ApiError.unauthorized();
    }

    let decoded;
    try {
      decoded = jwt.verify(cookieToken || headerToken, env.JWT_SECRET);
    } catch {
      throw ApiError.unauthorized('Session expired or invalid');
    }

    const admin = await Admin.findById(decoded.sub).select('_id name email role').lean();
    if (!admin) {
      throw ApiError.unauthorized('Account no longer exists');
    }

    req.user = { id: admin._id.toString(), name: admin.name, email: admin.email, role: admin.role };
    return next();
  } catch (err) {
    next(err);
  }
}

module.exports = { requireAuth };
