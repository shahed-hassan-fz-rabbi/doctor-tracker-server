require('dotenv').config();

const { z } = require('zod');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  JWT_SECRET: z.string().min(16),
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
});

/**
 * Under tests, modules are imported before the in-memory MongoDB exists.
 * Supply harmless defaults instead of exiting — tests/helpers.js replaces
 * MONGODB_URI with the real in-memory server URI before mongoose connects.
 */
if (process.env.NODE_ENV === 'test') {
  process.env.MONGODB_URI ||= 'mongodb://127.0.0.1:27017/doctor-tracker-test';
  process.env.JWT_SECRET ||= 'test-super-secret-key-for-vitest-0123456789';
}

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('❌ Invalid environment configuration:');
    for (const issue of parsed.error.issues) {
      console.error(`   - ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(1);
  }
  return parsed.data;
}

const env = loadEnv();

module.exports = env;
