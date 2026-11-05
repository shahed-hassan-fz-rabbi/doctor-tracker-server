require('dotenv').config();

const { z } = require('zod');
const { isCompleteMongoUri, isDemoMongoUri } = require('./mongoUri');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DEMO_MODE: z.string().default('false').transform((v) => v === 'true'),
  MONGODB_URI: z.string().optional(),
  DEMO_MONGODB_URI: z.string().optional(),
  DEMO_SEED_MONGODB_URI: z.string().optional(),
  JWT_SECRET: z.string().optional(),
  DEMO_JWT_SECRET: z.string().optional(),
  ADMIN_NAME: z.string().optional(),
  ADMIN_EMAIL: z.string().optional(),
  ADMIN_PASSWORD: z.string().optional(),
  JWT_EXPIRES_IN: z.string().default('7d'),
  COOKIE_NAME: z.string().default('dt_token'),
  COOKIE_SECURE: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3000')
    .transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean)),
  RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().default(15),
  RATE_LIMIT_MAX: z.coerce.number().default(300),
  LOGIN_RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().default(15),
  LOGIN_RATE_LIMIT_MAX: z.coerce.number().default(10),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // --- Google OAuth 2.0 ---
  // Required in production. In development/test, empty strings are accepted
  // so the server can start without Google credentials configured.
  GOOGLE_CLIENT_ID: z.string().default(''),
  GOOGLE_CLIENT_SECRET: z.string().default(''),
  GOOGLE_CALLBACK_URL: z
    .string()
    .default('http://localhost:4000/api/v1/auth/google/callback'),
  /** Frontend origin to redirect back to after OAuth. Must match CORS_ORIGINS.
   *  Example: https://doctor-tracker-client-sepia.vercel.app */
  FRONTEND_ORIGIN: z.string().default('http://localhost:3000'),
}).superRefine((value, ctx) => {
  const problem = (path, message) => ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });

  if (value.DEMO_MODE) {
    if (value.MONGODB_URI) problem('MONGODB_URI', 'MONGODB_URI must not be set in demo mode; use DEMO_MONGODB_URI with a demo-only database user');
    if (!value.DEMO_MONGODB_URI || !isCompleteMongoUri(value.DEMO_MONGODB_URI)) {
      problem('DEMO_MONGODB_URI', 'DEMO_MONGODB_URI must be a complete MongoDB URI');
    } else if (!isDemoMongoUri(value.DEMO_MONGODB_URI)) {
      problem('DEMO_MONGODB_URI', 'DEMO_MONGODB_URI must target the doctor-tracker-demo database');
    }
    if (!value.DEMO_JWT_SECRET || value.DEMO_JWT_SECRET.length < 32) {
      problem('DEMO_JWT_SECRET', 'DEMO_JWT_SECRET must be a unique random value of at least 32 characters');
    }
    if (value.JWT_SECRET) problem('JWT_SECRET', 'JWT_SECRET must not be set in demo mode; use a separate DEMO_JWT_SECRET');
    if (value.DEMO_SEED_MONGODB_URI) problem('DEMO_SEED_MONGODB_URI', 'Temporary seed credentials must not be configured on the demo runtime service');
    if (value.COOKIE_NAME === 'dt_token') problem('COOKIE_NAME', 'Set a demo-specific COOKIE_NAME such as dt_demo_token');
    if (value.NODE_ENV === 'production' && !value.COOKIE_SECURE) {
      problem('COOKIE_SECURE', 'COOKIE_SECURE must be true in production demo mode');
    }
    if (value.ADMIN_NAME || value.ADMIN_EMAIL || value.ADMIN_PASSWORD) problem('ADMIN_PASSWORD', 'Admin seed credentials must not be configured on the demo runtime service');
    if (value.GOOGLE_CLIENT_ID || value.GOOGLE_CLIENT_SECRET) problem('GOOGLE_CLIENT_SECRET', 'Google OAuth credentials must not be configured on the demo runtime service');
  } else {
    if (!value.MONGODB_URI || !isCompleteMongoUri(value.MONGODB_URI)) {
      problem('MONGODB_URI', 'MONGODB_URI must use mongodb:// or mongodb+srv:// and include a database name');
    }
    if (!value.JWT_SECRET || value.JWT_SECRET.length < 16) problem('JWT_SECRET', 'JWT_SECRET must be at least 16 characters');
    if (value.DEMO_MONGODB_URI || value.DEMO_JWT_SECRET || value.DEMO_SEED_MONGODB_URI) {
      problem('DEMO_MODE', 'Demo database and JWT settings may only be configured when DEMO_MODE=true');
    }
  }
});

/**
 * Under tests, modules are imported before the in-memory MongoDB exists.
 * Supply harmless defaults instead of exiting — tests/helpers.js replaces
 * MONGODB_URI with the real in-memory server URI before mongoose connects.
 *
 * Also strip demo-only vars so a local .env that happens to have
 * DEMO_SEED_MONGODB_URI / DEMO_MONGODB_URI / DEMO_JWT_SECRET doesn't
 * violate the "must not set demo vars when DEMO_MODE=false" guard.
 */
if (process.env.NODE_ENV === 'test') {
  process.env.MONGODB_URI ||= 'mongodb://127.0.0.1:27017/doctor-tracker-test';
  process.env.JWT_SECRET ||= 'test-super-secret-key-for-vitest-0123456789';
  // Tests always run as production mode; demo vars must not be present.
  delete process.env.DEMO_MODE;
  delete process.env.DEMO_MONGODB_URI;
  delete process.env.DEMO_JWT_SECRET;
  delete process.env.DEMO_SEED_MONGODB_URI;
}

function validateEnv(source = process.env) {
  return envSchema.safeParse(source);
}

function loadEnv() {
  const parsed = validateEnv();
  if (!parsed.success) {
    console.error('❌ Invalid environment configuration:');
    for (const issue of parsed.error.issues) {
      console.error(`   - ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(1);
  }
  return {
    ...parsed.data,
    MONGODB_URI: parsed.data.DEMO_MODE ? parsed.data.DEMO_MONGODB_URI : parsed.data.MONGODB_URI,
    JWT_SECRET: parsed.data.DEMO_MODE ? parsed.data.DEMO_JWT_SECRET : parsed.data.JWT_SECRET,
  };
}

const env = loadEnv();

module.exports = env;
module.exports.validateEnv = validateEnv;
