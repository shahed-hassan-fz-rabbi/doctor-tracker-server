const mongoose = require('mongoose');

/**
 * User model — stores Google OAuth users.
 *
 * Intentionally separate from the Admin model so that existing admin
 * authentication is not affected. Admins keep their own collection and
 * password-based flow. Google users live here with role 'viewer' by default.
 *
 * A user promoted to admin by a human operator gets role:'admin' here and
 * is then permitted through the admin guards the same way a seeded admin is.
 *
 * Fields stored per the registration requirement:
 *   googleId       — stable Google subject ID (sub) — unique index
 *   email          — normalized lowercase — unique index
 *   name           — display name from Google profile
 *   picture        — Google profile photo URL
 *   provider       — always 'google' (reserved for future providers)
 *   emailVerified  — Google's verified flag for this address
 *   role           — 'viewer' (default) | 'admin' (operator-promoted only)
 *   status         — 'active' | 'suspended'
 *   lastLoginAt    — updated on every successful sign-in (not on creation)
 *   createdAt      — auto-set by Mongoose timestamps option
 *   updatedAt      — auto-set by Mongoose timestamps option
 *
 * NOT stored: Google passwords, OAuth client secrets, application JWT secrets.
 */
const userSchema = new mongoose.Schema(
  {
    /** Stable Google subject identifier — never changes for a Google account. */
    googleId: {
      type: String,
      required: [true, 'Google subject ID is required'],
      unique: true,
      trim: true,
    },

    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Email is not valid'],
    },

    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [120, 'Name cannot exceed 120 characters'],
    },

    /** Profile picture URL provided by Google. Not required. */
    picture: {
      type: String,
      default: null,
    },

    /**
     * Authentication provider.
     * Currently only 'google' is supported — reserved for future providers.
     */
    provider: {
      type: String,
      default: 'google',
      enum: { values: ['google'], message: 'Unsupported provider' },
    },

    /** Whether Google confirmed the user's email address. */
    emailVerified: {
      type: Boolean,
      default: false,
    },

    /**
     * Application role.
     * New Google users start as 'viewer'. An operator must explicitly
     * elevate a user to 'admin' — it never happens automatically.
     */
    role: {
      type: String,
      default: 'viewer',
      enum: { values: ['viewer', 'admin'], message: 'Unsupported role' },
    },

    status: {
      type: String,
      default: 'active',
      enum: { values: ['active', 'suspended'], message: 'Unsupported status' },
    },

    /**
     * Timestamp of the most recent successful sign-in.
     * Set to null initially; updated on every Google callback that succeeds.
     * This is separate from createdAt — createdAt is set once at registration.
     */
    lastLoginAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true } // adds createdAt and updatedAt automatically
);

module.exports = mongoose.model('User', userSchema);
