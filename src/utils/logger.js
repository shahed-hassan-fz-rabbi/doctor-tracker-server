/**
 * Centralized logger kept dependency-free so the project stays lightweight.
 */
const env = require('../config/env');

function log(level, args) {
  const order = { debug: 10, info: 20, warn: 30, error: 40 };
  if (order[level] < order[env.LOG_LEVEL]) return;
  const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : 'ℹ️';
  console.log(`[${level.toUpperCase()}] ${prefix}`, ...args);
}

module.exports = {
  debug: (...args) => log('debug', args),
  info: (...args) => log('info', args),
  warn: (...args) => log('warn', args),
  error: (...args) => log('error', args),
};
