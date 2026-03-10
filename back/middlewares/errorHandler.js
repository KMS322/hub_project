/**
 * Centralized HTTP error middleware. Returns standardized error JSON.
 * Error Framework: one logError() → PM2 Log | DB | Realtime.
 */

const { createError, REASON } = require('../core/error/errorFactory');
const { logError } = require('../core/error/errorLogger');

const DEBUG = process.env.DEBUG === 'true';

function errorMiddleware() {
  return (err, req, res, next) => {
    if (res.headersSent) return next(err);

    let serverError;
    const ip = req.ip || req.connection?.remoteAddress;

    if (err.code && err.code.startsWith('error-')) {
      serverError = { ...err, createdAt: err.createdAt || Date.now(), ip: err.ip || ip };
    } else {
      const reason = mapToReason(err);
      serverError = createError(
        'http',
        reason,
        err.message || 'Internal server error',
        err.detail || (DEBUG ? err.stack : undefined),
        {
          ip,
          endpoint: req.originalUrl || req.url,
          deviceId: err.deviceId,
          stack: DEBUG ? err.stack : undefined,
        }
      );
    }

    logError(serverError);

    const status = err.status || err.statusCode || (serverError.code === 'error-1-04' ? 401 : 500);
    const body = {
      success: false,
      code: serverError.code,
      message: serverError.message,
      ...(DEBUG && serverError.detail ? { detail: serverError.detail } : {}),
    };
    res.status(status).json(body);
  };
}

function mapToReason(err) {
  if (err.status === 401 || err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') return REASON.AUTH_FAILED;
  if (err.name === 'SequelizeValidationError' || err.name === 'ValidationError') return REASON.INVALID_FORMAT;
  if (err.message && err.message.includes('required')) return REASON.MISSING_FIELD;
  if (err.name && err.name.includes('Sequelize')) return REASON.DB_ERROR;
  return REASON.INTERNAL_ERROR;
}

module.exports = { errorMiddleware };
