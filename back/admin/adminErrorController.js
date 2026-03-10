/**
 * Admin API controller: errors list, stats, by device, device error stats.
 */

const errorRepository = require('../database/errorRepository');

/**
 * GET /api/admin/errors
 */
async function getErrors(req, res, next) {
  try {
    const { page, limit, code, channel, deviceId, startDate, endDate, keyword } = req.query;
    const { rows, total } = await errorRepository.findPaginated({
      page,
      limit,
      code,
      channel,
      deviceId,
      startDate,
      endDate,
      keyword,
    });
    const pageNum = parseInt(req.query.page, 10) || 1;
    const limitNum = parseInt(req.query.limit, 10) || 20;
    res.json({
      success: true,
      data: {
        rows: rows.map((r) => ({
          id: r.id,
          code: r.code,
          channel: r.channel,
          message: r.message,
          detail: r.detail,
          device_id: r.device_id,
          payload_size: r.payload_size,
          ip: r.ip,
          created_at: r.created_at,
        })),
        total,
        page: pageNum,
        limit: limitNum,
      },
    });
  } catch (e) {
    next(e);
  }
}

/**
 * GET /api/admin/errors/stats
 */
async function getStats(req, res, next) {
  try {
    const data = await errorRepository.getStats();
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}

/**
 * GET /api/admin/errors/device/:deviceId
 */
async function getErrorsByDevice(req, res, next) {
  try {
    const { deviceId } = req.params;
    const { page, limit } = req.query;
    const { rows, total } = await errorRepository.findByDevice(deviceId, { page, limit });
    res.json({
      success: true,
      data: {
        rows: rows.map((r) => ({
          id: r.id,
          code: r.code,
          channel: r.channel,
          message: r.message,
          detail: r.detail,
          device_id: r.device_id,
          payload_size: r.payload_size,
          ip: r.ip,
          created_at: r.created_at,
        })),
        total,
      },
    });
  } catch (e) {
    next(e);
  }
}

/**
 * GET /api/admin/errors/device-stats
 */
async function getDeviceStats(req, res, next) {
  try {
    const data = await errorRepository.getDeviceErrorStats();
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}

module.exports = {
  getErrors,
  getStats,
  getErrorsByDevice,
  getDeviceStats,
};
