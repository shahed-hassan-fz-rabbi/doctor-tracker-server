const env = require('../config/env');
const demoAuthService = require('../services/demoAuth.service');
const { sendSuccess } = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');

const cookieOptions = () => ({
  httpOnly: true,
  sameSite: env.COOKIE_SECURE ? 'none' : 'lax',
  secure: env.COOKIE_SECURE,
  path: '/api',
  maxAge: 2 * 60 * 60 * 1000,
});

async function postDemoLogin(req, res, next) {
  try {
    if (!env.DEMO_MODE) throw ApiError.notFound('Not found');
    const { token, user } = await demoAuthService.loginDemo(req.body);
    res.cookie(env.COOKIE_NAME, token, cookieOptions());
    return sendSuccess(res, { message: 'Demo sign-in successful', data: { user } });
  } catch (error) {
    return next(error);
  }
}

module.exports = { postDemoLogin, cookieOptions };
