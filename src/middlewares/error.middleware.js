const mongoose = require('mongoose');
const env = require('../config/env');
const ApiError = require('../utils/apiError');
const logger = require('../utils/logger');

/** 404 for unknown API routes. */
function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
}

/**
 * Central error middleware: maps framework errors to a safe JSON payload.
 * Stack traces are only exposed outside production, and never leak
 * passwords or internal fields.
 */
function errorHandler(err, req, res, _next) {
  let error = err;

  // Mongoose cast errors (bad ObjectId from exotic paths)
  if (error instanceof mongoose.Error.CastError) {
    error = ApiError.badRequest(`Invalid ${error.path}: ${error.value}`);
  }

  // Mongoose schema validation
  if (error && error.name === 'ValidationError' && error.errors) {
    error = new ApiError(
      422,
      'Resource validation failed',
      Object.values(error.errors).map((e) => ({ field: e.path, message: e.message }))
    );
  }

  // Mongoose duplicate key
  if (error && error.code === 11000) {
    const field = Object.keys(error.keyValue || {})[0] || 'field';
    error = ApiError.conflict(`Duplicate value for ${field}`);
  }

  const isApiError = error instanceof ApiError;
  const statusCode = isApiError ? error.statusCode : 500;

  if (!isApiError) {
    logger.error(error?.stack || error);
  }

  res.status(statusCode).json({
    success: false,
    message: isApiError ? error.message : 'Internal server error',
    ...(isApiError && error.details ? { details: error.details } : {}),
    ...(env.NODE_ENV !== 'production' ? { stack: error?.stack } : {}),
  });
}

module.exports = { notFoundHandler, errorHandler };
