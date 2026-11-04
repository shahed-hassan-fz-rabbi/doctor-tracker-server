const { OAuth2Client } = require('google-auth-library');
const crypto = require('crypto');
const User = require('../models/user.model');
const env = require('../config/env');

/**
 * Thin wrapper around Google's OAuth2 / OpenID Connect flow.
 *
 * Security model:
 * - The state parameter is generated here and verified on callback —
 *   protects against CSRF.
 * - The ID token is verified against Google's public keys on the backend —
 *   the client never touches the token.
 * - Passwords are never stored or requested.
 * - Google client secrets are never stored in MongoDB.
 */

const verificationClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);

/**
 * Builds the Google OAuth authorization URL and a matching CSRF state token.
 * @returns {{ url: string, state: string }}
 */
function buildAuthorizationUrl() {
  const oauthClient = new OAuth2Client({
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    redirectUri: env.GOOGLE_CALLBACK_URL,
  });

  // Cryptographically random state — prevents CSRF on the callback
  const state = crypto.randomBytes(32).toString('hex');

  const url = oauthClient.generateAuthUrl({
    access_type: 'offline',
    scope: ['openid', 'email', 'profile'],
    state,
    prompt: 'select_account',
  });

  return { url, state };
}

/**
 * Exchanges an authorization code for tokens, then verifies the ID token.
 * Returns the verified Google payload (sub, email, name, picture, email_verified).
 *
 * @param {string} code   Authorization code from Google callback
 * @returns {Promise<import('google-auth-library').TokenPayload>}
 */
async function verifyGoogleCallback(code) {
  const oauthClient = new OAuth2Client({
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    redirectUri: env.GOOGLE_CALLBACK_URL,
  });

  // Exchange authorization code for access + ID tokens
  const { tokens } = await oauthClient.getToken(code);

  // Verify the ID token signature and claims against Google's public keys.
  // This is the security-critical step — we never trust client-supplied identity.
  const ticket = await verificationClient.verifyIdToken({
    idToken: tokens.id_token,
    audience: env.GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();
  if (!payload) {
    throw new Error('Google returned an empty token payload');
  }

  return payload;
}

/**
 * Finds an existing User by googleId, or creates a new one.
 *
 * Registration flow (first login):
 *   1. Look up by stable googleId (sub from Google's ID token)
 *   2. If not found, check if the email already exists (account linking)
 *   3. If truly new, create User document with safe defaults:
 *      - role: 'viewer'   — never auto-promoted to admin
 *      - status: 'active'
 *      - lastLoginAt: now (set at creation = first login)
 *
 * Subsequent login flow:
 *   1. Found by googleId → update mutable profile fields (name, picture)
 *   2. Update lastLoginAt = now
 *   3. Save — no duplicate user is created
 *
 * Race condition safety:
 *   MongoDB unique indexes on googleId and email prevent duplicate documents
 *   even if two requests race. The error is caught and re-thrown as an
 *   ApiError upstream.
 *
 * NOT stored: Google passwords, OAuth client secrets, application JWT secrets.
 *
 * @param {import('google-auth-library').TokenPayload} googlePayload
 * @returns {Promise<import('../models/user.model').default>}
 */
async function findOrCreateUser(googlePayload) {
  const { sub: googleId, email, name, picture, email_verified: emailVerified } = googlePayload;
  const normalizedEmail = email.toLowerCase();
  const now = new Date();

  // ── Existing user path ────────────────────────────────────────────────────
  let user = await User.findOne({ googleId });

  if (user) {
    // Subsequent login: update mutable Google-controlled fields + lastLoginAt
    user.name = name;
    user.picture = picture || user.picture;
    user.emailVerified = emailVerified || user.emailVerified;
    user.lastLoginAt = now;
    await user.save();
    return user;
  }

  // ── Email exists but no googleId linked ──────────────────────────────────
  // This handles a future case where a user registered via another provider
  // and is now signing in with Google. Link the Google identity instead of
  // creating a duplicate account.
  const existingByEmail = await User.findOne({ email: normalizedEmail });
  if (existingByEmail) {
    existingByEmail.googleId = googleId;
    existingByEmail.picture = picture || existingByEmail.picture;
    existingByEmail.emailVerified = emailVerified || existingByEmail.emailVerified;
    existingByEmail.lastLoginAt = now;
    await existingByEmail.save();
    return existingByEmail;
  }

  // ── First registration ───────────────────────────────────────────────────
  // Brand new user — create with safe defaults.
  // lastLoginAt is set to 'now' because the first login IS the registration event.
  user = await User.create({
    googleId,
    email: normalizedEmail,
    name,
    picture: picture || null,
    emailVerified: Boolean(emailVerified),
    provider: 'google',
    role: 'viewer',      // never auto-promoted — operator must elevate explicitly
    status: 'active',
    lastLoginAt: now,
  });

  return user;
}

module.exports = { buildAuthorizationUrl, verifyGoogleCallback, findOrCreateUser };
