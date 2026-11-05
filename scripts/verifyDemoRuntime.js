/**
 * verifyDemoRuntime — one-time safety checks for the isolated demo runtime user.
 *
 * Reads ATLAS_RUN_USER / ATLAS_RUN_PASSWORD from .env.demo-runtime (gitignored,
 * never printed or committed), then verifies against Atlas:
 *   1. READ on doctor-tracker-demo succeeds and finds the seeded synthetic data.
 *   2. WRITE on doctor-tracker-demo is rejected (read-only enforcement at DB level).
 *   3. READ/WRITE on the production database doctor-tracker is rejected (isolation).
 *
 * On success, writes the final DEMO_MONGODB_URI into .env.demo-runtime so the
 * value can be pasted into the Render demo service environment.
 *
 * Usage:  node scripts/verifyDemoRuntime.js
 */
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

const ROOT = path.join(__dirname, '..');
const ENV_FILE = path.join(ROOT, '.env.demo-runtime');

function maskHostError(message) {
  return String(message).replace(/\/\/[^@]*@/, '//<redacted>@').slice(0, 160);
}

function readDemoRuntimeEnv() {
  if (!fs.existsSync(ENV_FILE)) {
    throw new Error('.env.demo-runtime is missing. Create it from the gitignored checklist file first.');
  }
  const lines = fs.readFileSync(ENV_FILE, 'utf8').split(/\r?\n/);
  const get = (key) => {
    const m = lines.find((l) => l.startsWith(`${key}=`));
    return m ? m.slice(key.length + 1).trim() : '';
  };
  return { get, lines };
}

/** MongoDB role list + direct db-level read/write probes. Never prints secrets. */
async function main() {
  const { get, lines } = readDemoRuntimeEnv();
  const user = get('ATLAS_RUN_USER');
  const password = get('ATLAS_RUN_PASSWORD');
  if (!user || !password) {
    throw new Error('ATLAS_RUN_USER / ATLAS_RUN_PASSWORD are empty in .env.demo-runtime.');
  }

  // Production URI supplies the cluster host/params. Credentials of the
  // PRODUCTION user are never printed or reused — only hosts + replica params.
  require('dotenv').config({ path: path.join(ROOT, '.env'), quiet: true });
  const prodUri = process.env.MONGODB_URI || '';
  const m = prodUri.match(/^mongodb(?:\+srv)?:\/\/[^@]+@(.+?)\/([^?]+)\?(.+)$/);
  if (!m) throw new Error('MONGODB_URI in .env could not be parsed (structure unexpected).');
  const [, hosts, , params] = m;

  const demoUri = `mongodb://${user}:${encodeURIComponent(password)}@${hosts}/doctor-tracker-demo?${params}`;

  console.log(`Connecting as user "${user}" (target: doctor-tracker-demo)...`);
  const client = new MongoClient(demoUri, { serverSelectionTimeoutMS: 12000 });
  try {
    await client.connect();

    // 1. Read demo data
    const demoDb = client.db('doctor-tracker-demo');
    const [doctors, patients] = await Promise.all([
      demoDb.collection('doctors').countDocuments({}),
      demoDb.collection('patients').countDocuments({}),
    ]);
    console.log(`READ demo db: OK (doctors=${doctors}, patients=${patients})`);
    if (doctors === 0 || patients === 0) {
      throw new Error('Demo database is empty — run the synthetic seed first before finalizing the runtime user.');
    }

    // 2. Write demo must FAIL (read-only)
    let demoWriteDenied = false;
    try {
      await demoDb.collection('_runtime_selftest').insertOne({ probe: new Date() });
    } catch (e) {
      demoWriteDenied = /not authorized|unauthorized|Forbidden|unallowed/i.test(String(e.message));
    }
    console.log(`WRITE demo db: ${demoWriteDenied ? 'denied ✓ (read-only enforced)' : 'ALLOWED ✗ (user is NOT read-only!)'}`);
    if (!demoWriteDenied) throw new Error('Runtime user can WRITE — do not use it. Fix Atlas role to read-only first.');

    // 3. Production isolation — must FAIL
    let prodAccessDenied = false;
    try {
      await client.db('doctor-tracker').command({ dbStats: 1 });
    } catch (e) {
      prodAccessDenied = /not authorized|unauthorized|Forbidden|unallowed/i.test(String(e.message));
    }
    console.log(`PROD doctor-tracker access: ${prodAccessDenied ? 'denied ✓ (isolated)' : 'ALLOWED ✗ (user can see production!)'}`);
    if (!prodAccessDenied) throw new Error('Runtime user can access production database — fix the Atlas role scope.');

    // 4. Persist the final URI for the Render demo service env var
    let content = lines.join('\n')
      .replace(/^# DEMO_MONGODB_URI=.*$/m, '')
      .replace(/^# Filled by scripts\/verifyDemoRuntime\.js.*$/m, '')
      .replace(/^DEMO_MONGODB_URI=.*$/m, '');
    content = content.trimEnd() + `\nDEMO_MONGODB_URI=${demoUri}\n`;
    fs.writeFileSync(ENV_FILE, content, 'utf8');
    console.log('SUCCESS: .env.demo-runtime now contains DEMO_MONGODB_URI (value kept private).');
    console.log('Paste that value into the Render demo service DEMO_MONGODB_URI variable.');
  } finally {
    await client.close().catch(() => {});
  }
}

main().catch((err) => {
  console.error('verifyDemoRuntime FAILED:', err.message.replace(/\/\/[^@]*@/, '//<redacted>@'));
  process.exitCode = 1;
});
