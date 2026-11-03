const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Admin = require('../models/admin.model');
const env = require('../config/env');
const { login, logout } = require('../services/auth.service');
const { sendSuccess, buildMeta } = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');

const COOKIE_OPTS = () => ({
  httpOnly: true,
  // Vercel and Render are cross-site deployments; production cookies need
  // SameSite=None plus Secure so browsers send the session to the API.
  sameSite: env.COOKIE_SECURE ? 'none' : 'lax',
  secure: env.COOKIE_SECURE,
  path: '/api',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
});

/** POST /auth/login */
async function postLogin(req, res, next) {
  try {
    const { token, admin } = await login(req.body);
    res.cookie(env.COOKIE_NAME, token, COOKIE_OPTS());
    return sendSuccess(res, { message: 'Login successful', data: { user: admin } });
  } catch (err) {
    return next(err);
  }
}

/** POST /auth/logout */
async function postLogout(req, res, next) {
  try {
    await logout();
    res.clearCookie(env.COOKIE_NAME, { ...COOKIE_OPTS(), maxAge: 0 });
    return sendSuccess(res, { message: 'Logout successful' });
  } catch (err) {
    return next(err);
  }
}

/** GET /auth/me */
async function getMe(req, res, next) {
  try {
    // req.user is attached by requireAuth and already re-checked against DB
    return sendSuccess(res, { message: 'Current user', data: { user: req.user } });
  } catch (err) {
    return next(err);
  }
}

module.exports = { postLogin, postLogout, getMe };
