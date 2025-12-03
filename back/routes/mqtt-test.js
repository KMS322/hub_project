const express = require('express');
const router = express.Router();
const mqttService = require('../mqtt/service');

/**
 * 테스트용 MQTT 라우트 (인증 없음)
 * mqtt-monitor와의 양방향 테스트용
 */

/**
 * 백엔드에서 메시지 발행 (테스트용)
 * POST /mqtt-test/publish
 */
router.post('/publish', (req, res) => {
  const { topic, message, qos = 1, retain = false } = req.body;

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
    // message가 문자열인 경우 파싱 시도
    let parsedMessage = message;
    if (typeof message === 'string') {
      try {
        parsedMessage = JSON.parse(message);
      } catch (e) {
        // JSON이 아니면 그대로 사용
        parsedMessage = message;
      }
    }

    const success = mqttService.publish(topic, parsedMessage, { qos, retain });
    
    if (success) {
      res.json({
        success: true,
        message: '메시지가 발행되었습니다.',
        data: {
          topic,
          message: parsedMessage,
          qos,
          retain,
          timestamp: new Date().toISOString()
        }
      });
    } else {
      res.status(500).json({
        success: false,
        message: '메시지 발행에 실패했습니다.'
      });
    }
  } catch (error) {
    console.error('[MQTT Test] Error:', error);
    res.status(500).json({
      success: false,
      message: '메시지 발행 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

/**
 * 허브 명령 시뮬레이션 (테스트용)
 * POST /mqtt-test/command
 */
router.post('/command', (req, res) => {
  const { hubId, deviceId, command } = req.body;

  if (!hubId || !deviceId || !command) {
    return res.status(400).json({
      success: false,
      message: 'hubId, deviceId, command는 필수입니다.'
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
    mqttService.sendCommand(hubId, deviceId, command, 200)
      .then(response => {
        res.json({
          success: true,
          message: '명령이 전송되었고 응답을 받았습니다.',
          data: {
            hubId,
            deviceId,
            command,
            response,
            timestamp: new Date().toISOString()
          }
        });
      })
      .catch(error => {
        res.status(500).json({
          success: false,
          message: '명령 전송 실패 또는 타임아웃',
          error: error.message
        });
      });
  } catch (error) {
    console.error('[MQTT Test] Error:', error);
    res.status(500).json({
      success: false,
      message: '명령 전송 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

/**
 * MQTT 연결 상태 확인 (테스트용)
 * GET /mqtt-test/status
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

