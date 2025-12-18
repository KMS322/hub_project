const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlewares/auth');

/**
 * 허브에 명령 전송 (requestId 기반 RPC)
 * POST /mqtt/command/:hubId/:deviceId
 */
router.post('/command/:hubId/:deviceId', verifyToken, async (req, res) => {
  const { hubId, deviceId } = req.params;
  const command = req.body;

  const mqttService = req.app.get('mqtt');

  if (!mqttService || !mqttService.isConnected()) {
    return res.status(503).json({
      success: false,
      message: 'MQTT 서비스가 연결되지 않았습니다.'
    });
  }

  try {
    const response = await mqttService.sendCommand(hubId, deviceId, command, 200);
    
    res.json({
      success: true,
      message: `허브 ${hubId}의 디바이스 ${deviceId}에 명령이 전송되었습니다.`,
      hubId,
      deviceId,
      response
    });
  } catch (error) {
    console.error('MQTT 명령 전송 에러:', error);
    res.status(500).json({
      success: false,
      message: '명령 전송 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

/**
 * 허브에 설정 전송
 * POST /mqtt/settings/:hubId
 */
router.post('/settings/:hubId', verifyToken, (req, res) => {
  const { hubId } = req.params;
  const settings = req.body;

  const mqttService = req.app.get('mqtt');

  if (!mqttService || !mqttService.isConnected()) {
    return res.status(503).json({
      success: false,
      message: 'MQTT 서비스가 연결되지 않았습니다.'
    });
  }

  try {
    const success = mqttService.sendHubSettings(hubId, settings);
    
    if (success) {
      res.json({
        success: true,
        message: `허브 ${hubId}에 설정이 전송되었습니다.`,
        hubId,
        settings
      });
    } else {
      res.status(500).json({
        success: false,
        message: '설정 전송에 실패했습니다.'
      });
    }
  } catch (error) {
    console.error('MQTT 설정 전송 에러:', error);
    res.status(500).json({
      success: false,
      message: '설정 전송 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

/**
 * 커스텀 토픽에 메시지 발행
 * POST /mqtt/publish
 */
router.post('/publish', verifyToken, (req, res) => {
  const { topic, message, options } = req.body;

  if (!topic || !message) {
    return res.status(400).json({
      success: false,
      message: 'topic과 message는 필수입니다.'
    });
  }

  const mqttService = req.app.get('mqtt');

  if (!mqttService || !mqttService.isConnected()) {
    return res.status(503).json({
      success: false,
      message: 'MQTT 서비스가 연결되지 않았습니다.'
    });
  }

  try {
    const success = mqttService.publish(topic, message, options || {});
    
    if (success) {
      res.json({
        success: true,
        message: '메시지가 발행되었습니다.',
        topic,
        message
      });
    } else {
      res.status(500).json({
        success: false,
        message: '메시지 발행에 실패했습니다.'
      });
    }
  } catch (error) {
    console.error('MQTT 메시지 발행 에러:', error);
    res.status(500).json({
      success: false,
      message: '메시지 발행 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

/**
 * MQTT 연결 상태 확인
 * GET /mqtt/status
 */
router.get('/status', (req, res) => {
  const mqttService = req.app.get('mqtt');

  res.json({
    success: true,
    connected: mqttService ? mqttService.isConnected() : false,
    message: mqttService && mqttService.isConnected() 
      ? 'MQTT 서비스가 연결되어 있습니다.' 
      : 'MQTT 서비스가 연결되지 않았습니다.'
  });
});

module.exports = router;
