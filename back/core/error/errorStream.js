/**
 * Realtime streams for admin dashboard.
 * - broadcastError: ServerError objects
 * - broadcastLog: structured log lines (info/warn/error)
 * - 최근 N개를 버퍼에 저장해, 어드민 접속 시 과거 로그/에러도 함께 전달
 */

let io = null;

const LOG_BUFFER_MAX = 300;
const ERROR_BUFFER_MAX = 100;
const _logBuffer = [];
const _errorBuffer = [];

/**
 * @param {Object} socketServer - Socket.IO server instance
 */
function setSocketInstance(socketServer) {
  io = socketServer;
}

/**
 * Emit server-error to room "admin/errors". Admin clients join via join-admin-errors.
 * 최근 에러는 버퍼에 저장해 새로 접속한 어드민에게 과거 에러도 전달.
 * @param {Object} serverError - ServerError from errorFactory
 */
function broadcastError(serverError) {
  const payload = { ...serverError };
  if (process.env.DEBUG !== 'true' && payload.stack) delete payload.stack;
  _errorBuffer.push(payload);
  if (_errorBuffer.length > ERROR_BUFFER_MAX) _errorBuffer.shift();
  if (io && typeof io.to === 'function') {
    io.to('admin/errors').emit('server-error', payload);
  }
}

/**
 * Emit structured log line to room "admin/logs".
 * 최근 로그는 버퍼에 저장해 새로 접속한 어드민에게 과거 로그도 전달.
 * @param {Object} logLine - { level, message, timestamp, ...meta }
 */
function broadcastLog(logLine) {
  _logBuffer.push({ ...logLine });
  if (_logBuffer.length > LOG_BUFFER_MAX) _logBuffer.shift();
  if (io && typeof io.to === 'function') {
    io.to('admin/logs').emit('server-log', logLine);
  }
}

/** 어드민 접속 시 과거 로그 전달용 (최신순 유지) */
function getRecentLogs() {
  return _logBuffer.slice();
}

/** 어드민 접속 시 과거 에러 전달용 (최신순 유지) */
function getRecentErrors() {
  return _errorBuffer.slice();
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
  getRecentLogs,
  getRecentErrors,
};
