const ApiError = require('../utils/apiError');

/**
 * Zod validation middleware factory.
 * Runs the schema against { body, params, query }; parsed results
 * are written back onto the request.
 */
const validate = (schema) => (req, _res, next) => {
  const result = schema.safeParse({
    body: req.body,
    params: req.params,
    query: req.query,
  });

  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      field: [...issue.path].filter((p) => p !== 'body' && p !== 'query' && p !== 'params').join('.'),
      message: issue.message,
    }));
    return next(ApiError.validation('Request validation failed', details));
  }

  ['body', 'params', 'query'].forEach((part) => {
    if (result.data[part] !== undefined) {
      // query is parsed into a new plain object so default keys are stable
      if (part === 'query') {
        Object.defineProperty(req, part, { value: { ...result.data[part] }, writable: true });
      } else {
        req[part] = result.data[part];
      }
    }
  });
  return next();
};

module.exports = validate;
