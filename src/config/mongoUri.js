function isCompleteMongoUri(value) {
  if (typeof value !== 'string') return false;
  const match = value.trim().match(/^mongodb(?:\+srv)?:\/\/(.+)$/i);
  if (!match) return false;

  const remainder = match[1];
  const slash = remainder.indexOf('/');
  if (slash < 0) return false;

  const database = remainder.slice(slash + 1).split(/[?#]/, 1)[0];
  return database.trim().length > 0;
}

function getMongoDatabaseName(value) {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^mongodb(?:\+srv)?:\/\/[^/]+\/([^/?#]*)/i);
  if (!match || !match[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

function isDemoMongoUri(value) {
  return getMongoDatabaseName(value) === 'doctor-tracker-demo';
}

module.exports = { isCompleteMongoUri, getMongoDatabaseName, isDemoMongoUri };
