/** One-time, interactive creation of the permanent Admin account. */
const readline = require('node:readline');
const bcrypt = require('bcryptjs');
const env = require('../src/config/env');
const Admin = require('../src/models/admin.model');
const { connectDatabase, disconnectDatabase } = require('../src/config/database');
const { isCompleteMongoUri, isDemoMongoUri } = require('../src/config/mongoUri');
const logger = require('../src/utils/logger');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function promptEmail(input, output) {
  if (!input.isTTY || !output.isTTY) {
    throw new Error('Admin setup requires a private interactive terminal. Credentials are not accepted through environment variables or command-line arguments.');
  }
  return new Promise((resolve) => {
    const terminal = readline.createInterface({ input, output });
    terminal.question('Admin email: ', (answer) => {
      terminal.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

function promptSecret(label, input, output) {
  if (!input.isTTY || typeof input.setRawMode !== 'function' || !output.isTTY) {
    throw new Error('Admin password must be entered in an interactive terminal. Environment variables and command-line passwords are not accepted.');
  }

  output.write(`${label} (hidden): `);
  input.setRawMode(true);
  input.resume();

  return new Promise((resolve, reject) => {
    let value = '';
    const cleanup = () => {
      input.removeListener('data', onData);
      input.setRawMode(false);
      output.write('\n');
    };
    const onData = (chunk) => {
      for (const character of chunk.toString('utf8')) {
        if (character === '\u0003') {
          cleanup();
          reject(new Error('Admin setup cancelled.'));
          return;
        }
        if (character === '\r' || character === '\n') {
          cleanup();
          resolve(value);
          return;
        }
        if (character === '\u007f' || character === '\b') {
          value = value.slice(0, -1);
        } else if (character >= ' ') {
          value += character;
        }
      }
    };
    input.on('data', onData);
  });
}

async function promptPassword(input, output) {
  const password = await promptSecret('Admin password', input, output);
  const confirmation = await promptSecret('Confirm Admin password', input, output);
  if (password !== confirmation) throw new Error('Passwords did not match. No account was created.');
  return password;
}

async function seedAdmin({
  uri = env.MONGODB_URI,
  email,
  password,
  name = 'Doctor Tracker Admin',
  input = process.stdin,
  output = process.stdout,
  AdminModel = Admin,
  connect = connectDatabase,
  disconnect = disconnectDatabase,
} = {}) {
  if (env.DEMO_MODE || isDemoMongoUri(uri)) {
    throw new Error('Admin setup refused: this script cannot create Admin accounts in the demo database.');
  }
  if (!isCompleteMongoUri(uri)) throw new Error('MONGODB_URI must be configured for the one-time Admin setup.');

  let connected = false;
  try {
    await connect(uri);
    connected = true;

    const normalizedEmail = (email || await promptEmail(input, output)).trim().toLowerCase();
    if (!EMAIL_PATTERN.test(normalizedEmail)) throw new Error('Enter a valid Admin email address.');

    const existing = await AdminModel.findOne({ email: normalizedEmail }).select('_id').lean();
    if (existing) {
      logger.info('Admin account already exists. No account or password changes were made.');
      return { created: false, existing: true };
    }

    if (await AdminModel.countDocuments({}) > 0) {
      throw new Error('An Admin account already exists with a different email. Refusing to create a duplicate or change its credentials.');
    }

    const adminPassword = password ?? await promptPassword(input, output);
    if (typeof adminPassword !== 'string' || adminPassword.length < 12) {
      throw new Error('Admin password must be at least 12 characters. No account was created.');
    }

    await AdminModel.create({
      name,
      email: normalizedEmail,
      passwordHash: await bcrypt.hash(adminPassword, 12),
      role: 'admin',
    });
    logger.info('Permanent Admin account created. Store its credentials in your password manager.');
    return { created: true, role: 'admin' };
  } finally {
    if (connected) await disconnect();
  }
}

if (require.main === module) {
  seedAdmin().catch((err) => {
    logger.error('Admin setup failed:', err?.message || 'No account was changed.');
    process.exit(1);
  });
}

module.exports = seedAdmin;
module.exports.promptEmail = promptEmail;
module.exports.promptSecret = promptSecret;
module.exports.promptPassword = promptPassword;
