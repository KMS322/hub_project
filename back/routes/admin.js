/**
 * Admin API: errors, stats, device-stats, system health. Protected by verifyToken.
 * GET /api/admin/errors
 * GET /api/admin/errors/stats
 * GET /api/admin/errors/device/:deviceId
 * GET /api/admin/errors/device-stats
 * GET /api/admin/health
 */

const express = require('express');
const router = express.Router();
const { verifyToken, verifyAdmin } = require('../middlewares/auth');
const adminErrorController = require('../admin/adminErrorController');

router.use(verifyToken);
router.use(verifyAdmin);

router.get('/errors', adminErrorController.getErrors);
router.get('/errors/stats', adminErrorController.getStats);
router.get('/errors/device-stats', adminErrorController.getDeviceStats);
router.get('/errors/device/:deviceId', adminErrorController.getErrorsByDevice);

/**
 * GET /api/admin/health - system health for observability dashboard
 * MQTT status, Socket count, Queue length, uptime
 */
router.get('/health', (req, res) => {
  const startTime = process.env.SERVER_START_TIME ? parseInt(process.env.SERVER_START_TIME, 10) : Date.now();
  const mqttService = req.app.get('mqtt');
  const telemetryQueue = req.app.get('telemetryQueue');
  const io = req.app.get('io');
  res.json({
    success: true,
    data: {
      mqtt: {
        connected: mqttService ? mqttService.isConnected() : false,
      },
      socket: {
        connectionCount: io && io.sockets ? io.sockets.sockets.size : 0,
      },
      queue: {
        length: Array.isArray(telemetryQueue) ? telemetryQueue.length : 0,
      },
      uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
    },
  });
});

module.exports = router;
