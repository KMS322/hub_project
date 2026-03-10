/**
 * Realtime streams for admin dashboard.
 * - broadcastError: ServerError objects
 * - broadcastLog: structured log lines (info/warn/error)
 */

let io = null;

/**
 * @param {Object} socketServer - Socket.IO server instance
 */
function setSocketInstance(socketServer) {
  io = socketServer;
}

/**
 * Emit server-error to room "admin/errors". Admin clients join via join-admin-errors.
 * @param {Object} serverError - ServerError from errorFactory
 */
function broadcastError(serverError) {
  if (!io || typeof io.to !== 'function') return;
  const payload = { ...serverError };
  if (process.env.DEBUG !== 'true' && payload.stack) delete payload.stack;
  io.to('admin/errors').emit('server-error', payload);
}

/**
 * Emit structured log line to room "admin/logs".
 * Used for PM2/stdout logs so admin can see server logs in real time.
 * @param {Object} logLine - { level, message, timestamp, ...meta }
 */
function broadcastLog(logLine) {
  if (!io || typeof io.to !== 'function') return;
  io.to('admin/logs').emit('server-log', logLine);
}

module.exports = {
  setSocketInstance,
  broadcastError,
  broadcastLog,
};
