/**
 * Standardized error codes: error-{channel}-{reason}
 * 3-tier observability: PM2 Log | DB Log | Realtime Stream
 *
 * Channel: 0=MQTT, 1=HTTP, 2=Socket.io, 3=USB
 * Reason: 01-12
 */

const CHANNEL_CODE = {
  mqtt: '0',
  http: '1',
  socket: '2',
  usb: '3',
};

const CHANNEL_NAME = {
  [CHANNEL_CODE.mqtt]: 'mqtt',
  [CHANNEL_CODE.http]: 'http',
  [CHANNEL_CODE.socket]: 'socket',
  [CHANNEL_CODE.usb]: 'usb',
};

const ERROR_REASON = {
  CONNECTION_FAILED: '01',
  PAYLOAD_TOO_LARGE: '02',
  JSON_PARSE_ERROR: '03',
  AUTH_FAILED: '04',
  TIMEOUT: '05',
  INVALID_FORMAT: '06',
  MISSING_FIELD: '07',
  INTERNAL_ERROR: '08',
  DB_ERROR: '09',
  QUEUE_OVERFLOW: '10',
  DEVICE_NOT_FOUND: '11',
  RATE_LIMIT: '12',
};

// Legacy aliases for existing code
const CHANNEL = { MQTT: '0', HTTP: '1', SOCKET: '2', USB: '3' };
const REASON = { ...ERROR_REASON, CONNECTION_FAILURE: '01', PAYLOAD_SIZE_EXCEEDED: '02', JSON_PARSING_FAILURE: '03', AUTHENTICATION_FAILURE: '04', MISSING_REQUIRED_FIELD: '07', INTERNAL_SERVER_ERROR: '08', DATABASE_FAILURE: '09', RATE_LIMIT_EXCEEDED: '12' };

function buildCode(channelCode, reason) {
  return `error-${channelCode}-${reason}`;
}

module.exports = {
  CHANNEL_CODE,
  CHANNEL_NAME,
  ERROR_REASON,
  REASON,
  CHANNEL,
  buildCode,
};
