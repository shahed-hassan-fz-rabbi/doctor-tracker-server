/**
 * Consistent JSON envelope for every successful response:
 * { success, message, data, meta? }
 */
function sendSuccess(res, { status = 200, message = 'OK', data = null, meta = null }) {
  const body = { success: true, message };
  if (data !== null) body.data = data;
  if (meta) body.meta = meta;
  return res.status(status).json(body);
}

/** builds a ?page=&limit= meta block after parallel count + find queries */
function buildMeta({ page, limit, total }) {
  return {
    page,
    limit,
    total,
    totalPages: Math.max(Math.ceil(total / limit), 1),
    hasNextPage: page * limit < total,
    hasPrevPage: page > 1,
  };
}

module.exports = { sendSuccess, buildMeta };
