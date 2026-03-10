/**
 * Centralized error factory. All transport layers use this for consistent ServerError objects.
 * @typedef {Object} ServerError
 * @property {string} code
 * @property {'mqtt'|'http'|'socket'|'usb'} channel
 * @property {string} message
 * @property {string} detail
 * @property {number} [payloadSize]
 * @property {string} [deviceId]
 * @property {string} [ip]
 * @property {string} [topic]
 * @property {string} [endpoint]
 * @property {number} createdAt
 * @property {string} [stack]
 */

const { CHANNEL, CHANNEL_NAME, REASON, buildCode } = require('./errorCodes');

const DEFAULT_MESSAGES = {
  [REASON.CONNECTION_FAILURE]: 'Connection failed',
  [REASON.PAYLOAD_SIZE_EXCEEDED]: 'Payload size exceeded',
  [REASON.JSON_PARSING_FAILURE]: 'JSON parsing failure',
  [REASON.AUTHENTICATION_FAILURE]: 'Authentication failure',
  [REASON.TIMEOUT]: 'Timeout',
  [REASON.INVALID_DATA_FORMAT]: 'Invalid data format',
  [REASON.MISSING_REQUIRED_FIELD]: 'Missing required field',
  [REASON.INTERNAL_SERVER_ERROR]: 'Internal server error',
  [REASON.DATABASE_FAILURE]: 'Database failure',
  [REASON.QUEUE_OVERFLOW]: 'Queue overflow',
  [REASON.DEVICE_NOT_FOUND]: 'Device not found',
  [REASON.RATE_LIMIT_EXCEEDED]: 'Rate limit exceeded',
};

/**
 * @param {string} channel - One of CHANNEL.MQTT, CHANNEL.HTTP, CHANNEL.SOCKET, CHANNEL.USB
 * @param {string} reason - One of REASON.*
 * @param {string} [message] - Optional override for default message
 * @param {string} [detail] - Additional detail (e.g. raw error message)
 * @param {Object} [metadata] - Optional: deviceId, payloadSize, ip, topic, endpoint, stack
 * @returns {ServerError}
 */
function createError(channel, reason, message, detail, metadata = {}) {
  const channelName = CHANNEL_NAME[channel] || 'http';
  const code = buildCode(channel, reason);
  const msg = message || DEFAULT_MESSAGES[reason] || 'Unknown error';
  const err = {
    code,
    channel: channelName,
    message: msg,
    detail: detail || '',
    createdAt: Date.now(),
    ...metadata,
  };
  if (metadata.payloadSize !== undefined) err.payloadSize = metadata.payloadSize;
  if (metadata.deviceId !== undefined) err.deviceId = metadata.deviceId;
  if (metadata.ip !== undefined) err.ip = metadata.ip;
  if (metadata.topic !== undefined) err.topic = metadata.topic;
  if (metadata.endpoint !== undefined) err.endpoint = metadata.endpoint;
  if (metadata.stack !== undefined) err.stack = metadata.stack;
  return err;
}

module.exports = {
  createError,
  REASON,
  CHANNEL,
};
