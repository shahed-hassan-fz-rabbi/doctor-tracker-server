const { Router } = require('express');
const authController = require('../controllers/auth.controller');
const demoAuthController = require('../controllers/demoAuth.controller');
const oauthController = require('../controllers/oauth.controller');
const validate = require('../middlewares/validate.middleware');
const { requireAuth, requireProductionAuth, requireDemoMode } = require('../middlewares/auth.middleware');
const { loginLimiter } = require('../middlewares/rateLimit.middleware');
const { loginSchema } = require('../validators');

const router = Router();

// --- Email / Password (Admin) ---
router.post('/login', requireProductionAuth, loginLimiter, validate(loginSchema), authController.postLogin);
router.post('/demo-login', requireDemoMode, loginLimiter, validate(loginSchema), demoAuthController.postDemoLogin);
router.post('/logout', requireAuth, authController.postLogout);
router.get('/me', requireAuth, authController.getMe);

// --- Google OAuth 2.0 ---
// GET /auth/google          → redirect to Google consent screen
// GET /auth/google/callback → Google redirects here after consent
router.get('/google', requireProductionAuth, oauthController.initiateGoogleAuth);
router.get('/google/callback', requireProductionAuth, oauthController.handleGoogleCallback);

module.exports = router;
