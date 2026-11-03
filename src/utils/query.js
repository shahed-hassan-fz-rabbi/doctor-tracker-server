/**
 * Shared helpers for list queries (services):
 * pagination cap, date-range parsing, sort sanitizing, string search.
 */
const ApiError = require('./apiError');

const MAX_PAGE_SIZE = 100;

function buildPagination(page, limit, maxSize = MAX_PAGE_SIZE) {
  const safePage = Math.max(parseInt(page, 10) || 1, 1);
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), maxSize);
  return { page: safePage, limit: safeLimit, skip: (safePage - 1) * safeLimit };
}

/**
 * Parses ?dateFrom=&dateTo= into { $gte, $lte } for createdAt filtering.
 * Returns null when no range is supplied. Rejects invalid dates.
 */
function parseDateRange(dateFrom, dateTo) {
  if (!dateFrom && !dateTo) return null;

  const range = {};
  if (dateFrom) {
    const from = new Date(dateFrom);
    if (Number.isNaN(from.getTime())) throw ApiError.badRequest('dateFrom is not a valid date');
    range.$gte = from;
  }
  if (dateTo) {
    const to = new Date(dateTo);
    if (Number.isNaN(to.getTime())) throw ApiError.badRequest('dateTo is not a valid date');
    // make the range inclusive of the whole day
    to.setDate(to.getDate() + 1);
    range.$lt = to;
  }
  return range;
}

/**
 * Escapes user input used inside a RegExp (search) so special
 * characters can't break or exploit the pattern.
 */
function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { buildPagination, parseDateRange, escapeRegex, MAX_PAGE_SIZE };
