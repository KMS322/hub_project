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

let _stdoutStderrCaptureStarted = false;

/**
 * 터미널에 뜨는 모든 stdout/stderr를 admin 실시간 로그로 전송.
 * process.stdout.write / process.stderr.write를 래핑하여 매 출력마다 broadcastLog 호출.
 */
function startCaptureStdoutStderr() {
  if (_stdoutStderrCaptureStarted) return;
  _stdoutStderrCaptureStarted = true;

  const ts = () => Math.floor(Date.now() / 1000);

  function sendLines(level, text) {
    if (!text || typeof text !== 'string') return;
    const lines = text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    for (const line of lines) {
      try {
        broadcastLog({ level, message: line, timestamp: ts(), raw: true });
      } catch (e) {
        // 방송 실패 시 로거에서 예외 전파 방지
      }
    }
  }

  const origStdout = process.stdout.write.bind(process.stdout);
  process.stdout.write = function (chunk, encoding, cb) {
    const str = typeof chunk === 'string' ? chunk : (chunk && chunk.toString ? chunk.toString(encoding || 'utf8') : '');
    if (str) sendLines('info', str);
    return origStdout(chunk, encoding, cb);
  };

  const origStderr = process.stderr.write.bind(process.stderr);
  process.stderr.write = function (chunk, encoding, cb) {
    const str = typeof chunk === 'string' ? chunk : (chunk && chunk.toString ? chunk.toString(encoding || 'utf8') : '');
    if (str) sendLines('error', str);
    return origStderr(chunk, encoding, cb);
  };
}

module.exports = {
  setSocketInstance,
  broadcastError,
  broadcastLog,
  startCaptureStdoutStderr,
};
