const mongoose = require('mongoose');

/**
 * Password-based account for the isolated public demo service only.
 * The schema deliberately has no role field: demo accounts are always viewers.
 */
const demoAccountSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
    passwordHash: { type: String, required: true, select: false },
    name: { type: String, required: true, default: 'Doctor Tracker Demo Viewer', maxlength: 120 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('DemoAccount', demoAccountSchema);
