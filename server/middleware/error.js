const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const config = require('../config/env');

const notFound = (req, _res, next) => next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} not found`));

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, _next) => {
  let status = err.status || 500, code = err.code || 'INTERNAL_ERROR', message = err.message, details = err.details;

  if (err.name === 'ValidationError' && err.errors) {
    status = 422; code = 'VALIDATION_ERROR';
    details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
    message = details[0].message;
  } else if (err.name === 'CastError') { status = 400; code = 'BAD_REQUEST'; message = `Invalid ${err.path}`; }
  else if (err.code === 11000) {
    status = 409; code = 'DUPLICATE';
    const key = Object.keys(err.keyPattern || {})[0] || 'value';
    message = key === 'teamNameKey' ? 'That team name is already taken' : key === 'email' ? 'An account with this email already exists' : `Duplicate ${key}`;
  } else if (err.name === 'MulterError') { status = 400; code = 'UPLOAD_ERROR'; }

  if (status >= 500) { logger.error({ err, path: req.originalUrl }, 'Unhandled error'); if (config.isProd) message = 'Something went wrong on our side. Try again shortly.'; }
  res.status(status).json({ success: false, error: { code, message, ...(details ? { details } : {}) } });
};
module.exports = { notFound, errorHandler };
