/**
 * Persist and query server errors. Async, non-blocking for logging path.
 */

const db = require('../models');

const RETENTION_DAYS = 30;

/**
 * @param {Object} serverError - ServerError from errorFactory
 * @returns {Promise<Object>}
 */
async function save(serverError) {
  if (!db.ServerError) return null;
  return db.ServerError.create({
    code: serverError.code,
    channel: serverError.channel,
    message: serverError.message,
    detail: (serverError.detail || '').substring(0, 65535),
    device_id: serverError.deviceId || null,
    payload_size: serverError.payloadSize ?? null,
    ip: serverError.ip || null,
    created_at: new Date(serverError.createdAt),
  });
}

/**
 * @param {Object} opts - { page, limit, code, channel, deviceId, startDate, endDate, keyword }
 * @returns {Promise<{ rows: Object[], total: number }>}
 */
async function findPaginated(opts = {}) {
  const page = Math.max(1, parseInt(opts.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(opts.limit, 10) || 20));
  const offset = (page - 1) * limit;
  const where = {};

  if (opts.code) where.code = opts.code;
  if (opts.channel) where.channel = opts.channel;
  if (opts.deviceId) where.device_id = opts.deviceId;
  if (opts.startDate || opts.endDate) {
    where.created_at = {};
    if (opts.startDate) where.created_at[db.Sequelize.Op.gte] = new Date(opts.startDate);
    if (opts.endDate) where.created_at[db.Sequelize.Op.lte] = new Date(opts.endDate);
  }
  if (opts.keyword) {
    where[db.Sequelize.Op.or] = [
      { message: { [db.Sequelize.Op.like]: `%${opts.keyword}%` } },
      { detail: { [db.Sequelize.Op.like]: `%${opts.keyword}%` } },
      { code: { [db.Sequelize.Op.like]: `%${opts.keyword}%` } },
    ];
  }

  const { count, rows } = await db.ServerError.findAndCountAll({
    where,
    order: [['created_at', 'DESC']],
    limit,
    offset,
  });
  return { rows, total: count };
}

/**
 * @param {string} deviceId
 * @param {Object} opts - { page, limit }
 * @returns {Promise<{ rows: Object[], total: number }>}
 */
async function findByDevice(deviceId, opts = {}) {
  return findPaginated({ ...opts, deviceId });
}

/**
 * @returns {Promise<Object>} - { byCode, byChannel, total, last24h }
 */
async function getStats() {
  if (!db.ServerError) return { byCode: {}, byChannel: {}, total: 0, last24h: 0 };
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const all = await db.ServerError.findAll({ attributes: ['code', 'channel', 'created_at'] });
  const byCode = {};
  const byChannel = {};
  let last24h = 0;
  for (const r of all) {
    byCode[r.code] = (byCode[r.code] || 0) + 1;
    byChannel[r.channel] = (byChannel[r.channel] || 0) + 1;
    if (new Date(r.created_at) >= oneDayAgo) last24h += 1;
  }
  return {
    byCode,
    byChannel,
    total: all.length,
    last24h,
  };
}

/**
 * Delete records older than RETENTION_DAYS. Call from cron or on startup.
 */
async function deleteOlderThanRetention() {
  if (!db.ServerError) return 0;
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const deleted = await db.ServerError.destroy({ where: { created_at: { [db.Sequelize.Op.lt]: cutoff } } });
  return deleted;
}

module.exports = {
  save,
  findPaginated,
  findByDevice,
  getStats,
  deleteOlderThanRetention,
  RETENTION_DAYS,
};
