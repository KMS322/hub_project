/**
 * Structured JSON logging for PM2 and optional DB persistence.
 * All logs are JSON format for PM2 log aggregation.
 */

const DEBUG = process.env.DEBUG === 'true';

/**
 * @param {Object} serverError - ServerError from errorFactory
 * @param {Object} [io] - Socket.IO instance; if provided and errorStream is set, emits to admin room
 * @param {Function} [persist] - Optional async (err) => Promise; e.g. errorRepository.save
 */
function logError(serverError, io = null, persist = null) {
  const level = 'error';
  const logLine = {
    level,
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
  if (DEBUG && serverError.stack) {
    logLine.stack = serverError.stack;
  }
  // PM2 / stdout: single line JSON
  console.error(JSON.stringify(logLine));

  // Non-blocking persist
  if (typeof persist === 'function') {
    persist(serverError).catch((e) => {
      console.error(JSON.stringify({ level: 'error', message: 'Failed to persist server error', detail: e?.message }));
    });
  }

  // Real-time admin stream
  if (io && typeof io.to === 'function') {
    const payload = { ...serverError };
    if (!DEBUG) delete payload.stack;
    io.to('admin/errors').emit('server-error', payload);
  }
}

/**
 * @param {string} level - 'info' | 'warn' | 'error'
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
}

module.exports = {
  logError,
  logStructured,
};
