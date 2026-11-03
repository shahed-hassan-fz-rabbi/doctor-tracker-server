const { z } = require('zod');
const { SPECIALIZATIONS } = require('../models/doctor.model');
const { CONDITIONS, GENDERS } = require('../models/patient.model');
const mongoose = require('mongoose');
/* ---------- Auth ---------- */
const loginSchema = z.object({
  body: z.object({
    email: z.string().trim().email('A valid email is required'),
    password: z.string().min(1, 'Password is required').max(128),
  }),
});

/* ---------- Doctors ---------- */
const doctorBodySchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(120),
    specialization: z.enum(SPECIALIZATIONS),
    hospital: z.string().trim().min(2).max(160),
    phone: z.string().trim().min(6).max(24),
    email: z.string().trim().email().max(160),
    isActive: z.boolean().optional(),
  }),
});

const doctorUpdateSchema = z.object({
  body: z
    .object({
      name: z.string().trim().min(2).max(120).optional(),
      specialization: z.enum(SPECIALIZATIONS).optional(),
      hospital: z.string().trim().min(2).max(160).optional(),
      phone: z.string().trim().min(6).max(24).optional(),
      email: z.string().trim().email().max(160).optional(),
      isActive: z.boolean().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'Provide at least one field to update',
    }),
});

const doctorListQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    search: z.string().trim().max(120).optional(),
    specialization: z.enum(SPECIALIZATIONS).optional(),
    hospital: z.string().trim().max(160).optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    sortBy: z
      .enum(['name', 'specialization', 'hospital', 'createdAt', 'patientCount'])
      .optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
  }),
});

const doctorIdParamSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Doctor id is not a valid ObjectId'),
  }),
});

/** params for DELETE /doctors/:id/patients/:patientId */
const unassignPatientFromDoctorParamsSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Doctor id is not a valid ObjectId'),
    patientId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Patient id is not a valid ObjectId'),
  }),
});

/* ---------- Patients ---------- */
const patientBodySchema = z.object({
  body: z.object({
    fullName: z.string().trim().min(2).max(120),
    age: z.coerce.number().int().min(1).max(130),
    gender: z.enum(GENDERS),
    phone: z.string().trim().min(6).max(24),
    email: z.string().trim().email().max(160).nullish(),
    condition: z.enum(CONDITIONS),
    doctorId: z
      .string()
      .refine((v) => v === 'unassigned' || mongoose.isValidObjectId(v), {
        message: 'doctorId must be a valid ObjectId or "unassigned"',
      })
      .nullish(),
    notes: z.string().trim().max(2000).optional(),
  }),
});

const patientUpdateSchema = z.object({
  body: z
    .object({
      fullName: z.string().trim().min(2).max(120).optional(),
      age: z.coerce.number().int().min(1).max(130).optional(),
      gender: z.enum(GENDERS).optional(),
      phone: z.string().trim().min(6).max(24).optional(),
      email: z.string().trim().email().max(160).nullish(),
      condition: z.enum(CONDITIONS).optional(),
      doctorId: z
        .string()
        .refine((v) => v === 'unassigned' || mongoose.isValidObjectId(v), {
          message: 'doctorId must be a valid ObjectId or "unassigned"',
        })
        .nullish(),
      notes: z.string().trim().max(2000).optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'Provide at least one field to update',
    }),
});

const patientListQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    search: z.string().trim().max(120).optional(),
    condition: z.enum(CONDITIONS).optional(),
    gender: z.enum(GENDERS).optional(),
    doctorId: z
      .union([z.string().regex(/^[0-9a-fA-F]{24}$/), z.literal('unassigned')])
      .optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    sortBy: z.enum(['fullName', 'age', 'condition', 'gender', 'createdAt']).optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
  }),
});

const patientIdParamSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Patient id is not a valid ObjectId'),
  }),
});

module.exports = {
  loginSchema,
  doctorBodySchema,
  doctorUpdateSchema,
  doctorListQuerySchema,
  doctorIdParamSchema,
  unassignPatientFromDoctorParamsSchema,
  patientBodySchema,
  patientUpdateSchema,
  patientListQuerySchema,
  patientIdParamSchema,

  // Composed schemas (params + body together) for routes that validate both
  composedDoctorUpdateSchema: z.object({
    params: doctorIdParamSchema.shape.params,
    body: doctorUpdateSchema.shape.body,
  }),
  composedPatientUpdateSchema: z.object({
    params: patientIdParamSchema.shape.params,
    body: patientUpdateSchema.shape.body,
  }),
  composedAddPatientUnderDoctorSchema: z.object({
    params: doctorIdParamSchema.shape.params,
    body: patientBodySchema.shape.body,
  }),
};
