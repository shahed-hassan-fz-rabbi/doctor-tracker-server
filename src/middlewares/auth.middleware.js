const jwt = require('jsonwebtoken');
const Admin = require('../models/admin.model');
const User = require('../models/user.model');
const env = require('../config/env');
const ApiError = require('../utils/apiError');

/**
 * requireAuth — verifies the JWT and attaches req.user.
 *
 * Token source (in order of preference):
 *   1. HttpOnly cookie (set at login — primary path)
 *   2. Authorization: Bearer header (API clients / test suite)
 *
 * User lookup strategy:
 *   - JWT payload includes { sub, role, provider? }
 *   - If provider === 'google'  → look up User model
 *   - Otherwise (admin login)  → look up Admin model (backward compatible)
 *
 * req.user shape (consistent for all callers):
 *   { id, name, email, role, provider }
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

    // Route to the correct model based on the provider claim in the JWT
    if (decoded.provider === 'google') {
      // Google OAuth user
      const user = await User.findById(decoded.sub).select('_id name email role status provider').lean();
      if (!user) {
        throw ApiError.unauthorized('Account no longer exists');
      }
      if (user.status !== 'active') {
        throw ApiError.unauthorized('Account is suspended');
      }
      req.user = {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        provider: user.provider,
      };
    } else {
      // Email/password Admin (original behaviour — no breaking change)
      const admin = await Admin.findById(decoded.sub).select('_id name email role').lean();
      if (!admin) {
        throw ApiError.unauthorized('Account no longer exists');
      }
      req.user = {
        id: admin._id.toString(),
        name: admin.name,
        email: admin.email,
        role: admin.role,
        provider: 'local',
      };
    }

    return next();
  } catch (err) {
    next(err);
  }
}

/**
 * requireAdmin — must be used AFTER requireAuth.
 * Rejects any authenticated user whose role is not 'admin'.
 * Protects create / edit / delete operations from viewer-role Google users.
 */
function requireAdmin(req, _res, next) {
  if (req.user?.role !== 'admin') {
    return next(ApiError.forbidden());
  }
  return next();
}

module.exports = { requireAuth, requireAdmin };
