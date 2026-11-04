const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { buildAuthorizationUrl, verifyGoogleCallback, findOrCreateUser } = require('../services/google.service');
const { sendSuccess } = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');
const logger = require('../utils/logger');

/**
 * Cookie options for the auth JWT.
 * Production: SameSite=None + Secure (required for cross-site Vercel ↔ Render).
 * Development: SameSite=Lax (no HTTPS requirement on localhost).
 */
const COOKIE_OPTS = () => ({
  httpOnly: true,
  sameSite: env.COOKIE_SECURE ? 'none' : 'lax',
  secure: env.COOKIE_SECURE,
  path: '/api',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
});

/**
 * In-memory CSRF state store.
 * State tokens are single-use with a 10-minute TTL.
 *
 * Production note: if you scale to multiple Render instances, replace
 * this Map with a Redis-backed store (or use signed cookies for state).
 */
const oauthStates = new Map(); // state → { expires: Date }
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/** Purge expired state entries (called on each initiation). */
function pruneExpiredStates() {
  const now = Date.now();
  for (const [key, val] of oauthStates) {
    if (val.expires < now) oauthStates.delete(key);
  }
}

/**
 * GET /api/v1/auth/google
 * Generates the Google OAuth authorization URL and redirects the user.
 * A CSRF state token is stored server-side and echoed back through Google.
 */
async function initiateGoogleAuth(req, res, next) {
  try {
    pruneExpiredStates();
    const { url, state } = buildAuthorizationUrl();
    oauthStates.set(state, { expires: Date.now() + STATE_TTL_MS });
    return res.redirect(url);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/auth/google/callback
 * Handles the redirect from Google.
 * Verifies the CSRF state, exchanges the authorization code, issues a JWT,
 * sets it as an HttpOnly cookie, and redirects to the frontend dashboard.
 *
 * On any error, redirects to the frontend /login page with an error query param.
 */
async function handleGoogleCallback(req, res, next) {
  const { code, state, error: oauthError } = req.query;
  const frontendBase = env.FRONTEND_URL || 'http://localhost:3000';

  // Google returned an error (e.g. user denied access)
  if (oauthError) {
    logger.warn(`Google OAuth denied: ${oauthError}`);
    return res.redirect(`${frontendBase}/login?error=google_denied`);
  }

  // Validate required query params
  if (!code || !state) {
    return res.redirect(`${frontendBase}/login?error=missing_params`);
  }

  // Verify CSRF state
  const stateEntry = oauthStates.get(state);
  if (!stateEntry || stateEntry.expires < Date.now()) {
    oauthStates.delete(state);
    return res.redirect(`${frontendBase}/login?error=invalid_state`);
  }
  oauthStates.delete(state); // single-use

  try {
    // Exchange code → verified Google payload
    const googlePayload = await verifyGoogleCallback(code);

    // Safety check: only allow users whose email Google has verified
    if (!googlePayload.email_verified) {
      return res.redirect(`${frontendBase}/login?error=email_not_verified`);
    }

    // Find or create the user in MongoDB
    const user = await findOrCreateUser(googlePayload);

    // Reject suspended accounts
    if (user.status !== 'active') {
      return res.redirect(`${frontendBase}/login?error=account_suspended`);
    }

    // Issue JWT (same structure as Admin tokens for middleware compatibility)
    const token = jwt.sign(
      { sub: user._id.toString(), role: user.role, provider: 'google' },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN }
    );

    res.cookie(env.COOKIE_NAME, token, COOKIE_OPTS());

    return res.redirect(`${frontendBase}/dashboard`);
  } catch (err) {
    logger.error('Google OAuth callback error:', err?.message || err);
    return res.redirect(`${frontendBase}/login?error=oauth_failed`);
  }
}

module.exports = { initiateGoogleAuth, handleGoogleCallback };
