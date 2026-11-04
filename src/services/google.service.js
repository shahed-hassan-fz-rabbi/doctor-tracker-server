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
 */

const client = new OAuth2Client(env.GOOGLE_CLIENT_ID);

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

  // Exchange code → tokens
  const { tokens } = await oauthClient.getToken(code);

  // Verify the ID token using Google's public keys
  const ticket = await client.verifyIdToken({
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
 * New users receive role:'viewer' and status:'active' automatically.
 *
 * @param {import('google-auth-library').TokenPayload} googlePayload
 * @returns {Promise<import('../models/user.model').default>}
 */
async function findOrCreateUser(googlePayload) {
  const { sub: googleId, email, name, picture, email_verified: emailVerified } = googlePayload;

  // Try to find by stable googleId first
  let user = await User.findOne({ googleId });

  if (!user) {
    // Check if someone already registered this email via another provider
    // (future-proofing — currently only Google is supported)
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      // Link Google identity to existing account
      existing.googleId = googleId;
      existing.picture = picture || existing.picture;
      existing.emailVerified = emailVerified || existing.emailVerified;
      await existing.save();
      return existing;
    }

    // Brand new user — create with minimal safe defaults
    user = await User.create({
      googleId,
      email: email.toLowerCase(),
      name,
      picture: picture || null,
      emailVerified: Boolean(emailVerified),
      role: 'viewer',
      status: 'active',
      provider: 'google',
    });
  } else {
    // Update mutable fields that Google controls (name, picture, email_verified)
    user.name = name;
    user.picture = picture || user.picture;
    user.emailVerified = emailVerified || user.emailVerified;
    await user.save();
  }

  return user;
}

module.exports = { buildAuthorizationUrl, verifyGoogleCallback, findOrCreateUser };
