/**
 * Error Framework single entry point.
 * One call → PM2 Log (JSON) + Database save + Realtime Admin Stream.
 *
 * Flow: Transport Layer → createError() → logError() → [ PM2 | DB | Realtime ]
 */

const { save } = require('../../database/errorRepository');
const { broadcastError, broadcastLog } = require('./errorStream');

const DEBUG = process.env.DEBUG === 'true';

/**
 * @param {Object} serverError - ServerError from errorFactory
 */
function logError(serverError) {
  const logObject = {
    level: 'error',
    code: serverError.code,
    channel: serverError.channel,
    message: serverError.message,
    detail: serverError.detail,
    payloadSize: serverError.payloadSize,
    deviceId: serverError.deviceId,
    ip: serverError.ip,
    topic: serverError.topic,
    endpoint: serverError.endpoint,
    timestamp: Math.floor(serverError.createdAt / 1000),
  };
  if (DEBUG && serverError.stack) logObject.stack = serverError.stack;

  // 1) PM2 log (stdout JSON)
  console.error(JSON.stringify(logObject));

  // 2) Database (non-blocking)
  save(serverError).catch((e) => {
    console.error(JSON.stringify({ level: 'error', message: 'Failed to persist server error', detail: e?.message }));
  });

  // 3) Realtime admin stream
  broadcastError(serverError);
}

/**
 * @param {string} level - 'info'|'warn'|'error'
 * @param {string} message
 * @param {Object} [meta]
 */
function logStructured(level, message, meta = {}) {
  const logLine = {
    level,
    message,
    timestamp: Math.floor(Date.now() / 1000),
    ...meta,
  };
  const out = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  out(JSON.stringify(logLine));

  // Realtime stream for admin: generic server logs (not persisted to DB)
  try {
    broadcastLog(logLine);
  } catch (e) {
    // avoid throwing from logger
  }
}

module.exports = {
  logError,
  logStructured,
};
