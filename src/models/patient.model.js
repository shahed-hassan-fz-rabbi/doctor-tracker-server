const mongoose = require('mongoose');

const CONDITIONS = [
  'Allergies',
  'Asthma',
  'Cardiac',
  'Chronic Pain',
  'Diabetes',
  'Hypertension',
  'Obesity',
  'Sleep Disorder',
  'Other',
];

const GENDERS = ['Male', 'Female', 'Other'];

const patientSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, 'Patient full name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [120, 'Name cannot exceed 120 characters'],
    },
    age: {
      type: Number,
      required: [true, 'Age is required'],
      min: [1, 'Age must be at least 1'],
      max: [130, 'Age cannot exceed 130'],
    },
    gender: {
      type: String,
      required: [true, 'Gender is required'],
      enum: { values: GENDERS, message: 'Unsupported gender' },
    },
    phone: {
      type: String,
      required: [true, 'Phone is required'],
      trim: true,
      maxlength: [24, 'Phone cannot exceed 24 characters'],
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Email is not valid'],
      default: null,
    },
    condition: {
      type: String,
      required: [true, 'Condition is required'],
      enum: { values: CONDITIONS, message: 'Unsupported condition' },
    },
    /* Reference to the treating doctor. Patients with no doctor assignment
       (walk-in records) are still supported via "unassigned". */
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      default: null,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [2000, 'Notes cannot exceed 2000 characters'],
      default: '',
    },
  },
  {
    timestamps: true,
    toJSON: {
      /* serialize references as plain strings — ObjectId values are never
         left in the response payload (avoids BSON serialization edge cases) */
      transform: (_doc, ret) => {
        ret.id = String(ret._id);
        ret.doctorId = ret.doctorId ? String(ret.doctorId) : null;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

/* ---------- Indexes (why each exists) ---------- */

// 1. The patients list is usually filtered / paginated per doctor and sorted
//    by newest first — this single compound index covers both.
patientSchema.index({ doctorId: 1, createdAt: -1 });

// 2. Dashboard "patients by condition" and list filter share this compound.
patientSchema.index({ condition: 1, createdAt: -1 });

// 3. Date-range filter (dateFrom / dateTo) hits this index directly.
patientSchema.index({ createdAt: -1 });

// 4. Gender filter support.
patientSchema.index({ gender: 1 });

// 5. doctors/:id/patients reverse lookup and per-doctor analytics groupings.
patientSchema.index({ doctorId: 1, condition: 1 });

// 6. Optional email — sparse so null values are never indexed and stay unique.
// 6. Optional email — partial unique so multiple nulls never conflict
//    (sparse alone still indexes explicit null values).
patientSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { email: { $type: 'string' } } }
);

// 7. Search support on the diseased patient name (see note in the service
//    about unanchored regex search at scale vs Atlas Search).
patientSchema.index({ fullName: 1 });

module.exports = mongoose.model('Patient', patientSchema);
module.exports.CONDITIONS = CONDITIONS;
module.exports.GENDERS = GENDERS;
