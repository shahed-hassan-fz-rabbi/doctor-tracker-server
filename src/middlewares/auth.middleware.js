const jwt = require('jsonwebtoken');
const Admin = require('../models/admin.model');
const User = require('../models/user.model');
const DemoAccount = require('../models/demoAccount.model');
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
      decoded = jwt.verify(
        cookieToken || headerToken,
        env.JWT_SECRET,
        env.DEMO_MODE
          ? { issuer: 'doctor-tracker-demo', audience: 'doctor-tracker-demo' }
          : undefined
      );
    } catch {
      throw ApiError.unauthorized('Session expired or invalid');
    }

    // Demo credentials can only validate in the isolated demo service.
    if (decoded.provider === 'demo') {
      if (!env.DEMO_MODE) throw ApiError.unauthorized('Session expired or invalid');
      const account = await DemoAccount.findById(decoded.sub).select('_id name email active').lean();
      if (!account || !account.active) throw ApiError.unauthorized('Account no longer exists');
      req.user = {
        id: account._id.toString(),
        name: account.name,
        email: account.email,
        role: 'viewer',
        provider: 'demo',
        isDemo: true,
      };
    } else if (env.DEMO_MODE) {
      // The demo service accepts only demo viewer tokens, never Admin/Google tokens.
      throw ApiError.unauthorized('Session expired or invalid');
    } else if (decoded.provider === 'google') {
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

/**
 * Every doctor, patient, and analytics route uses this after requireAuth.
 * It is a no-op in production and requires the dedicated viewer identity in
 * demo mode, so Admin/Google sessions can never access the demo service.
 */
function requireDemoViewer(req, _res, next) {
  if (!env.DEMO_MODE) return next();
  if (req.user?.provider !== 'demo' || req.user?.role !== 'viewer') {
    return next(ApiError.forbidden());
  }
  return next();
}

/** Preserve production analytics admin policy while granting isolated demo viewers read-only analytics. */
function requireAdminOrDemoViewer(req, _res, next) {
  if (env.DEMO_MODE && req.user?.provider === 'demo' && req.user?.role === 'viewer') return next();
  return requireAdmin(req, _res, next);
}

function requireProductionAuth(req, _res, next) {
  if (env.DEMO_MODE) return next(ApiError.notFound('Not found'));
  return next();
}

function requireDemoMode(req, _res, next) {
  if (!env.DEMO_MODE) return next(ApiError.notFound('Not found'));
  return next();
}

module.exports = { requireAuth, requireAdmin, requireDemoViewer, requireAdminOrDemoViewer, requireProductionAuth, requireDemoMode };
