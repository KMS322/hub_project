/**
 * Error Framework - single entry for 3-tier observability:
 * PM2 Log | Database | Realtime Admin Stream
 */
const { createError, ERROR_REASON, REASON } = require('./errorFactory');
const { logError, logStructured } = require('./errorLogger');
const { setSocketInstance, broadcastError } = require('./errorStream');
const { CHANNEL_CODE } = require('./errorCodes');

module.exports = {
  createError,
  logError,
  logStructured,
  setSocketInstance,
  broadcastError,
  ERROR_REASON,
  REASON,
  CHANNEL_CODE,
};
