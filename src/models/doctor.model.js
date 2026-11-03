const mongoose = require('mongoose');

const SPECIALIZATIONS = [
  'Cardiology',
  'Dermatology',
  'Endocrinology',
  'Gastroenterology',
  'General Medicine',
  'Neurology',
  'Oncology',
  'Orthopedics',
  'Pediatrics',
  'Psychiatry',
  'Pulmonology',
  'Urology',
];

const doctorSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Doctor name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [120, 'Name cannot exceed 120 characters'],
    },
    specialization: {
      type: String,
      required: [true, 'Specialization is required'],
      enum: { values: SPECIALIZATIONS, message: 'Unsupported specialization' },
    },
    hospital: {
      type: String,
      required: [true, 'Hospital is required'],
      trim: true,
      maxlength: [160, 'Hospital cannot exceed 160 characters'],
    },
    phone: {
      type: String,
      required: [true, 'Phone is required'],
      trim: true,
      maxlength: [24, 'Phone cannot exceed 24 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Email is not valid'],
    },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

/* ---------- Indexes (why each exists) ---------- */

// 1. Unique email — prevents duplicate doctor records; also serves
//    exact email lookups from the admin UI.
doctorSchema.index({ email: 1 }, { unique: true });

// 2. Compound index for the main doctors list:
//    most pages sort by newest first, and the most-used filter is
//    specialization. This covers: specialization filter + createdAt sort.
//    Added isActive so "active doctors" stays an index-only filter path.
doctorSchema.index({ specialization: 1, isActive: 1, createdAt: -1 });

// 3. Single-field createdAt — used by the date range filter (dateFrom/dateTo)
//    and default newest-first sorting.
doctorSchema.index({ createdAt: -1 });

// 4. Case-insensitive-friendly search support on name and hospital.
doctorSchema.index({ name: 1 });
doctorSchema.index({ hospital: 1 });

module.exports = mongoose.model('Doctor', doctorSchema);
module.exports.SPECIALIZATIONS = SPECIALIZATIONS;
