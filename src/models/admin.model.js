const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const adminSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Admin name is required'],
      trim: true,
      maxlength: [120, 'Name cannot exceed 120 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Email is not valid'],
    },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, default: 'admin', enum: { values: ['admin'], message: 'Unsupported role' } },
  },
  { timestamps: true }
);

/** Instance helper — compares a plain password against the stored hash. */
adminSchema.methods.verifyPassword = async function verifyPassword(plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

// Unique email lives in the field definition (unique: true above) —
// no separate index declaration to avoid a duplicate index.

module.exports = mongoose.model('Admin', adminSchema);
