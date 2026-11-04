const mongoose = require('mongoose');
const env = require('./env');

let connecting = null;

function mongoFailureHint(error) {
  const nodes = [];
  const seen = new Set();
  const visit = (value, depth = 0) => {
    if (!value || typeof value !== 'object' || seen.has(value) || depth > 4) return;
    seen.add(value);
    nodes.push(value);
    for (const key of ['cause', 'reason', 'error', 'originalError']) visit(value[key], depth + 1);
    if (value.servers instanceof Map) {
      for (const server of value.servers.values()) visit(server.error, depth + 1);
    }
  };
  visit(error);

  const names = nodes.map((item) => item.name || '').join(' ');
  const codes = nodes.map((item) => String(item.code || '')).join(' ');
  const codeNames = nodes.map((item) => item.codeName || '').join(' ');
  const messages = nodes.map((item) => item.message || '').join(' ');

  if (/MongoParseError|MongoInvalidArgumentError/.test(names)) {
    return 'MongoDB rejected the connection string. Check that it starts with mongodb:// or mongodb+srv://, includes a database name, and URI-encodes reserved characters in credentials.';
  }
  if (/ENOTFOUND|EAI_AGAIN|ESERVFAIL|querySrv/i.test(`${codes} ${messages}`)) {
    return 'MongoDB hostname could not be resolved. Check the Atlas hostname and DNS/SRV access from this machine.';
  }
  if (codes.includes('18') || /AuthenticationFailed/.test(codeNames) || /authentication failed|bad auth/i.test(messages)) {
    return 'MongoDB rejected authentication. Check the Atlas database username/password and ensure reserved credential characters are URI-encoded.';
  }
  if (/ECONNREFUSED|ETIMEDOUT|ECONNRESET|MongoNetworkError|MongooseServerSelectionError|MongoServerSelectionError|buffering timed out/i.test(`${names} ${codes} ${messages}`)) {
    return 'MongoDB could not be reached. Check Atlas Network Access, firewall/VPN rules, and the cluster’s availability.';
  }
  return 'MongoDB connection failed. Check the URI format, Atlas credentials, DNS, and network access settings.';
}

function isMongoFailure(error) {
  return /^(Mongo|Mongoose)/i.test(error?.name || '') || Boolean(error?.mongoDiagnostic);
}

function connectDatabase(uri = env.MONGODB_URI) {
  if (!connecting) {
    connecting = mongoose
      .connect(uri, {
        serverSelectionTimeoutMS: 10000,
        connectTimeoutMS: 10000,
        // Atlas runtime credentials are read-only; indexes are created by the temporary seed user.
        autoIndex: !env.DEMO_MODE,
        autoCreate: !env.DEMO_MODE,
      })
      .then(() => {
        console.log(`✅ MongoDB connected (${mongoose.connection.name})`);
        return mongoose.connection;
      })
      .catch((error) => {
        connecting = null;
        error.mongoDiagnostic = mongoFailureHint(error);
        throw error;
      });
  }
  return connecting;
}

async function disconnectDatabase() {
  connecting = null;
  await mongoose.disconnect();
}

module.exports = { connectDatabase, disconnectDatabase, mongoFailureHint, isMongoFailure };
