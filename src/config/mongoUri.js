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

module.exports = { isCompleteMongoUri };
