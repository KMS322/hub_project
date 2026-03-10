/**
 * Centralized error factory. All transport layers use this for consistent ServerError.
 * Single object flows to: PM2 Log | Database | Realtime Admin Stream.
 *
 * @typedef {Object} ErrorMetadata
 * @property {string} [deviceId]
 * @property {number} [payloadSize]
 * @property {string} [topic]
 * @property {string} [ip]
 * @property {string} [endpoint]
 * @property {string} [stack]
 *
 * @typedef {Object} ServerError
 * @property {string} code
 * @property {string} channel - 'mqtt'|'http'|'socket'|'usb'
 * @property {string} message
 * @property {string} detail
 * @property {ErrorMetadata} [metadata]
 * @property {number} [payloadSize] - flattened for DB/log
 * @property {string} [deviceId]
 * @property {string} [ip]
 * @property {string} [topic]
 * @property {number} createdAt
 */

const { CHANNEL_CODE, CHANNEL_NAME, ERROR_REASON, REASON, buildCode } = require('./errorCodes');

const DEFAULT_MESSAGES = {
  [ERROR_REASON.CONNECTION_FAILED]: 'Connection failed',
  [ERROR_REASON.PAYLOAD_TOO_LARGE]: 'Payload size exceeded',
  [ERROR_REASON.JSON_PARSE_ERROR]: 'JSON parsing failure',
  [ERROR_REASON.AUTH_FAILED]: 'Authentication failure',
  [ERROR_REASON.TIMEOUT]: 'Timeout',
  [ERROR_REASON.INVALID_FORMAT]: 'Invalid data format',
  [ERROR_REASON.MISSING_FIELD]: 'Missing required field',
  [ERROR_REASON.INTERNAL_ERROR]: 'Internal server error',
  [ERROR_REASON.DB_ERROR]: 'Database failure',
  [ERROR_REASON.QUEUE_OVERFLOW]: 'Queue overflow',
  [ERROR_REASON.DEVICE_NOT_FOUND]: 'Device not found',
  [ERROR_REASON.RATE_LIMIT]: 'Rate limit exceeded',
};

/**
 * @param {string} channel - 'mqtt'|'http'|'socket'|'usb'
 * @param {string} reason - ERROR_REASON.*
 * @param {string} [message]
 * @param {string} [detail]
 * @param {ErrorMetadata} [metadata]
 * @returns {ServerError}
 */
function createError(channel, reason, message, detail, metadata = {}) {
  const channelCode = CHANNEL_CODE[channel] || (['0','1','2','3'].includes(channel) ? channel : '1');
  const channelName = CHANNEL_NAME[channelCode] || (typeof channel === 'string' ? channel : 'http');
  const code = buildCode(channelCode, reason);
  const msg = message || DEFAULT_MESSAGES[reason] || 'Unknown error';
  const err = {
    code,
    channel: channelName,
    message: msg,
    detail: detail || '',
    metadata,
    createdAt: Date.now(),
  };
  if (metadata.deviceId !== undefined) err.deviceId = metadata.deviceId;
  if (metadata.payloadSize !== undefined) err.payloadSize = metadata.payloadSize;
  if (metadata.ip !== undefined) err.ip = metadata.ip;
  if (metadata.topic !== undefined) err.topic = metadata.topic;
  if (metadata.endpoint !== undefined) err.endpoint = metadata.endpoint;
  if (metadata.stack !== undefined) err.stack = metadata.stack;
  return err;
}

module.exports = {
  createError,
  ERROR_REASON,
  REASON,
  CHANNEL: CHANNEL_CODE,
};
