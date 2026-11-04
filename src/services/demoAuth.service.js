const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const DemoAccount = require('../models/demoAccount.model');
const env = require('../config/env');
const ApiError = require('../utils/apiError');

async function loginDemo({ email, password }) {
  if (!env.DEMO_MODE) throw ApiError.notFound('Not found');

  const account = await DemoAccount.findOne({ email: String(email).trim().toLowerCase() })
    .select('+passwordHash name email active')
    .lean();

  if (!account || !account.active || !(await bcrypt.compare(password, account.passwordHash))) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  const token = jwt.sign(
    { sub: account._id.toString(), provider: 'demo', role: 'viewer' },
    env.JWT_SECRET,
    {
      expiresIn: env.JWT_EXPIRES_IN,
      issuer: 'doctor-tracker-demo',
      audience: 'doctor-tracker-demo',
    }
  );

  return {
    token,
    user: {
      id: account._id.toString(),
      name: account.name,
      email: account.email,
      role: 'viewer',
      provider: 'demo',
      isDemo: true,
    },
  };
}

module.exports = { loginDemo };
