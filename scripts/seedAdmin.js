/**
 * Creates (or updates the password of) the admin account defined in .env.
 * Admin credentials NEVER live in the code — they come from the environment.
 * Run: npm run seed:admin
 */
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const { z } = require('zod');
const Admin = require('../src/models/admin.model');
const { connectDatabase, disconnectDatabase } = require('../src/config/database');
const logger = require('../src/utils/logger');

const seedSchema = z.object({
  MONGODB_URI: z.string().min(1),
  ADMIN_NAME: z.string().default('System Admin'),
  ADMIN_EMAIL: z.string().email(),
  ADMIN_PASSWORD: z.string().min(8, 'ADMIN_PASSWORD must be at least 8 characters'),
});

async function seedAdmin({ argv = process.argv } = {}) {
  const parsed = seedSchema.safeParse(process.env);
  if (!parsed.success) {
    logger.error('Missing or invalid admin seed configuration. Check MONGODB_URI, ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD.');
    for (const issue of parsed.error.issues) {
      logger.error(`  - ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(1);
  }
  const cfg = parsed.data;

  await connectDatabase(cfg.MONGODB_URI);

  const existing = await Admin.findOne({ email: cfg.ADMIN_EMAIL.toLowerCase() });

  const passwordHash = await bcrypt.hash(cfg.ADMIN_PASSWORD, 12);

  if (existing) {
    // --reset flag forces a password refresh; otherwise we keep the password
    const keepPassword = !argv.includes('--reset');
    existing.name = cfg.ADMIN_NAME;
    if (!keepPassword) existing.passwordHash = passwordHash;
    await existing.save();
    logger.info(`Admin "${existing.email}" ${keepPassword ? 'already exists (password unchanged, use --reset to update)' : 'password was reset'}`);
  } else {
    await Admin.create({
      name: cfg.ADMIN_NAME,
      email: cfg.ADMIN_EMAIL.toLowerCase(),
      passwordHash,
    });
    logger.info(`Admin "${cfg.ADMIN_EMAIL}" created`);
  }

  await disconnectDatabase();
}

if (require.main === module) {
  seedAdmin().catch((err) => {
    logger.error('Seed failed:', err?.message);
    process.exit(1);
  });
}

module.exports = seedAdmin;
