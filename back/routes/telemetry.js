const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlewares/auth');

/**
 * 최근 Telemetry 데이터 조회
 * GET /telemetry/recent/:deviceAddress?limit=100
 */
router.get('/recent/:deviceAddress', verifyToken, (req, res) => {
  try {
    const { deviceAddress } = req.params;
    const limit = parseInt(req.query.limit) || 100;

    const telemetryWorker = req.app.get('telemetryWorker');
    if (!telemetryWorker) {
      return res.status(503).json({
        success: false,
        message: 'Telemetry Worker가 초기화되지 않았습니다.'
      });
    }

    const data = telemetryWorker.getRecentData(deviceAddress, limit);

    res.json({
      success: true,
      deviceAddress,
      count: data.length,
      data
    });
  } catch (error) {
    console.error('[Telemetry API] Error:', error);
    res.status(500).json({
      success: false,
      message: '데이터 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

/**
 * 모든 디바이스의 최근 데이터 조회
 * GET /telemetry/recent?limit=100
 */
router.get('/recent', verifyToken, (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;

    const telemetryWorker = req.app.get('telemetryWorker');
    if (!telemetryWorker) {
      return res.status(503).json({
        success: false,
        message: 'Telemetry Worker가 초기화되지 않았습니다.'
      });
    }

    const data = telemetryWorker.getAllRecentData(limit);

    res.json({
      success: true,
      devices: Object.keys(data),
      count: Object.values(data).reduce((sum, arr) => sum + arr.length, 0),
      data
    });
  } catch (error) {
    console.error('[Telemetry API] Error:', error);
    res.status(500).json({
      success: false,
      message: '데이터 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

/**
 * DB에서 최근 데이터 조회 (대안)
 * GET /telemetry/db/recent/:deviceAddress?limit=100
 */
router.get('/db/recent/:deviceAddress', verifyToken, async (req, res) => {
  try {
    const { deviceAddress } = req.params;
    const limit = parseInt(req.query.limit) || 100;
    const db = require('../models');

    const data = await db.Telemetry.findAll({
      where: {
        device_address: deviceAddress
      },
      order: [['timestamp', 'DESC']],
      limit,
      attributes: [
        'device_address',
        'timestamp',
        'starttime',
        'ir',
        'red',
        'green',
        'spo2',
        'hr',
        'temp',
        'battery'
      ]
    });

    // 데이터 형식 변환
    const formattedData = data.map(record => ({
      device_mac_address: record.device_address,
      timestamp: record.timestamp,
      starttime: record.starttime,
      ir: record.ir,
      red: record.red,
      green: record.green,
      spo2: record.spo2,
      hr: record.hr,
      temp: record.temp,
      battery: record.battery
    })).reverse(); // 최신순으로 정렬

    res.json({
      success: true,
      deviceAddress,
      count: formattedData.length,
      data: formattedData
    });
  } catch (error) {
    console.error('[Telemetry API] DB Error:', error);
    res.status(500).json({
      success: false,
      message: '데이터 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

module.exports = router;

