const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Admin = require('../models/admin.model');
const env = require('../config/env');
const ApiError = require('../utils/apiError');

/**
 * Verifies credentials and issues a signed JWT.
 * Returns the token + admin profile; the controller owns cookies.
 */
async function login({ email, password }) {
  // select:false on passwordHash means login explicitly opts in here
  const admin = await Admin.findOne({ email: String(email).toLowerCase() }).select(
    '+passwordHash name email role'
  );

  if (!admin) {
    // keep it generic to avoid account enumeration
    throw ApiError.unauthorized('Invalid email or password');
  }

  const ok = await admin.verifyPassword(password);
  if (!ok) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  const token = jwt.sign({ sub: admin._id.toString(), role: admin.role }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });

  return { token, admin: { id: admin._id.toString(), name: admin.name, email: admin.email, role: admin.role } };
}

/** Clears the auth cookie (does nothing else — JWTs are stateless). */
const logout = () => ({ ok: true });

module.exports = { login, logout };
