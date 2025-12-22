const express = require('express');
const router = express.Router();
const db = require('../models');
const csvWriter = require('../utils/csvWriter');

/**
 * 측정 시작
 * POST /api/measurement/start
 * 
 * Body:
 * {
 *   deviceAddress: "AA:BB:CC:DD:EE:02",
 *   userEmail: "user@example.com",
 *   petName: "멍멍이",
 *   startTime: "17:36:45:163" // HH:mm:ss:SSS
 * }
 */
router.post('/start', async (req, res) => {
  try {
    const { deviceAddress, userEmail, petName, startTime } = req.body;

    if (!deviceAddress || !userEmail || !petName) {
      return res.status(400).json({
        success: false,
        message: 'deviceAddress, userEmail, petName은 필수입니다.'
      });
    }

    // 디바이스가 실제로 존재하는지 확인
    const device = await db.Device.findOne({
      where: { address: deviceAddress }
    });

    if (!device) {
      return res.status(404).json({
        success: false,
        message: '디바이스를 찾을 수 없습니다.'
      });
    }

    // CSV 세션 시작
    const now = new Date();
    const time = startTime || `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}:${String(now.getMilliseconds()).padStart(3, '0')}`;
    const samplingRate = req.body.samplingRate || 50;
    
    csvWriter.startSession(deviceAddress, userEmail, petName, time, samplingRate);

    console.log(`[Measurement API] Started session for ${deviceAddress}`);

    res.json({
      success: true,
      message: '측정이 시작되었습니다.',
      data: {
        deviceAddress,
        userEmail,
        petName,
        startTime: time
      }
    });
  } catch (error) {
    console.error('[Measurement API] Start error:', error);
    res.status(500).json({
      success: false,
      message: '측정 시작 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

/**
 * 측정 정지
 * POST /api/measurement/stop
 * 
 * Body:
 * {
 *   deviceAddress: "AA:BB:CC:DD:EE:02"
 * }
 */
router.post('/stop', async (req, res) => {
  try {
    const { deviceAddress } = req.body;

    if (!deviceAddress) {
      return res.status(400).json({
        success: false,
        message: 'deviceAddress는 필수입니다.'
      });
    }

    // CSV 세션 종료
    csvWriter.endSession(deviceAddress);

    console.log(`[Measurement API] Stopped session for ${deviceAddress}`);

    res.json({
      success: true,
      message: '측정이 정지되었습니다.',
      data: {
        deviceAddress
      }
    });
  } catch (error) {
    console.error('[Measurement API] Stop error:', error);
    res.status(500).json({
      success: false,
      message: '측정 정지 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

/**
 * 측정 상태 조회
 * GET /api/measurement/status/:deviceAddress
 */
router.get('/status/:deviceAddress', async (req, res) => {
  try {
    const { deviceAddress } = req.params;
    const hasActiveSession = csvWriter.hasActiveSession(deviceAddress);

    res.json({
      success: true,
      data: {
        deviceAddress,
        isRunning: hasActiveSession
      }
    });
  } catch (error) {
    console.error('[Measurement API] Status error:', error);
    res.status(500).json({
      success: false,
      message: '상태 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

module.exports = router;
