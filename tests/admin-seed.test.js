const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { beforeAll, beforeEach, describe, expect, it } = globalThis;
const helpers = require('./helpers');
const Admin = require('../src/models/admin.model');
const seedAdmin = require('../scripts/seedAdmin');

describe('one-time Admin setup', () => {
  beforeAll(async () => helpers.connect());
  beforeEach(async () => helpers.clearCollections());

  const seed = (options = {}) => seedAdmin({
    uri: 'mongodb://127.0.0.1:27017/doctor-tracker-test',
    AdminModel: Admin,
    connect: async () => mongoose.connection,
    disconnect: async () => {},
    ...options,
  });

  it('creates a permanent admin hash without storing the password', async () => {
    const result = await seed({ email: 'owner@example.test', password: 'A-long-admin-password-2026!' });
    const account = await Admin.findOne({ email: 'owner@example.test' }).select('+passwordHash');

    expect(result).toEqual({ created: true, role: 'admin' });
    expect(account.role).toBe('admin');
    expect(account.passwordHash).not.toBe('A-long-admin-password-2026!');
    expect(await bcrypt.compare('A-long-admin-password-2026!', account.passwordHash)).toBe(true);
  });

  it('leaves an existing account and password unchanged on repeat setup', async () => {
    await seed({ email: 'owner@example.test', password: 'A-long-admin-password-2026!' });
    const original = await Admin.findOne({ email: 'owner@example.test' }).select('+passwordHash').lean();

    const result = await seed({ email: 'owner@example.test', password: 'A-different-password-2026!' });
    const after = await Admin.findOne({ email: 'owner@example.test' }).select('+passwordHash').lean();

    expect(result).toEqual({ created: false, existing: true });
    expect(after._id.toString()).toBe(original._id.toString());
    expect(after.passwordHash).toBe(original.passwordHash);
  });

  it('refuses to create a second Admin with another email', async () => {
    await seed({ email: 'owner@example.test', password: 'A-long-admin-password-2026!' });

    await expect(seed({ email: 'second@example.test', password: 'A-different-password-2026!' }))
      .rejects.toThrow(/refusing to create a duplicate/i);
    expect(await Admin.countDocuments()).toBe(1);
  });

  it('refuses to seed an Admin in the isolated demo database', async () => {
    await expect(seed({
      uri: 'mongodb://127.0.0.1:27017/doctor-tracker-demo',
      email: 'owner@example.test',
      password: 'A-long-admin-password-2026!',
    })).rejects.toThrow(/cannot create Admin accounts in the demo database/);
    expect(await Admin.countDocuments()).toBe(0);
  });
});
