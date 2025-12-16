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
    const timeout = req.body.timeout || 2000; // 기본 2초
    
    console.log(`[MQTT Test] 📤 Sending command to hub ${hubId} device ${deviceId}`);
    console.log(`  Command:`, JSON.stringify(command, null, 2));
    console.log(`  Timeout: ${timeout}ms`);
    
    mqttService.sendCommand(hubId, deviceId, command, timeout)
      .then(response => {
        console.log(`[MQTT Test] ✅ Command response received:`, response);
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
        console.error(`[MQTT Test] ❌ Command failed:`, error.message);
        res.status(500).json({
          success: false,
          message: '명령 전송 실패 또는 타임아웃',
          error: error.message,
          hint: 'ESP32가 연결되어 있고 명령 토픽을 구독하는지 확인하세요.'
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

/**
 * 허브에 직접 명령 전송 (테스트용, 인증 없음)
 * POST /mqtt-test/send-command
 * 
 * 요청 본문:
 * {
 *   "hubId": "AA:BB:CC:DD:EE:01",
 *   "deviceId": "AA:BB:CC:DD:EE:02",
 *   "action": "start_measurement",
 *   "params": {},
 *   "timeout": 2000
 * }
 */
router.post('/send-command', (req, res) => {
  const { hubId, deviceId, action, params = {}, timeout = 2000 } = req.body;

  if (!hubId || !deviceId || !action) {
    return res.status(400).json({
      success: false,
      message: 'hubId, deviceId, action은 필수입니다.'
    });
  }

  const mqttService = req.app.get('mqtt');

  if (!mqttService || !mqttService.isConnected()) {
    return res.status(503).json({
      success: false,
      message: 'MQTT 서비스가 연결되지 않았습니다.'
    });
  }

  const command = {
    action,
    params
  };

  try {
    console.log(`[MQTT Test] 📤 Sending command via /send-command endpoint`);
    console.log(`  Hub: ${hubId}, Device: ${deviceId}`);
    console.log(`  Action: ${action}`);
    console.log(`  Params:`, params);
    console.log(`  Timeout: ${timeout}ms`);
    
    mqttService.sendCommand(hubId, deviceId, command, timeout)
      .then(response => {
        console.log(`[MQTT Test] ✅ Command response received:`, response);
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
        console.error(`[MQTT Test] ❌ Command failed:`, error.message);
        res.status(500).json({
          success: false,
          message: '명령 전송 실패 또는 타임아웃',
          error: error.message,
          hint: 'ESP32가 연결되어 있고 hub/{hubId}/command/# 토픽을 구독하는지 확인하세요.'
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
 * test/receive 토픽으로 간단하게 메시지 발행 (ESP32 허브로 데이터 전송)
 * POST /mqtt-test/test
 * POST /mqtt-test/send-to-hub (별칭)
 * 
 * Postman 사용 예제:
 * - URL: http://localhost:5000/mqtt-test/test
 * - Method: POST
 * - Headers: Content-Type: application/json
 * - Body (raw JSON):
 *   {
 *     "message": "Hello ESP32!"
 *   }
 * 
 * 요청 본문:
 * {
 *   "message": "Hello ESP32!"  // 문자열 또는 객체
 * }
 * 
 * 또는 간단하게:
 * {
 *   "data": "test data"
 * }
 */
router.post('/test', (req, res) => {
  const { message, data, topic = 'test/receive' } = req.body;

  // message 또는 data 중 하나는 필수
  const messageContent = message || data;
  
  if (!messageContent) {
    return res.status(400).json({
      success: false,
      message: 'message 또는 data는 필수입니다.'
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
    // 메시지 포맷 (간단하게)
    let testMessage;
    if (typeof messageContent === 'object') {
      testMessage = messageContent;
    } else if (typeof messageContent === 'string') {
      // 문자열인 경우 JSON 파싱 시도
      try {
        testMessage = JSON.parse(messageContent);
      } catch (e) {
        // JSON이 아니면 그냥 문자열로
        testMessage = { message: messageContent };
      }
    } else {
      testMessage = { data: messageContent };
    }

    // 타임스탬프 추가
    testMessage.timestamp = new Date().toISOString();

    console.log(`[MQTT Test] 📤 Publishing to ${topic} (ESP32 허브로 데이터 전송):`, JSON.stringify(testMessage, null, 2));

    const success = mqttService.publish(topic, testMessage, { qos: 1 });
    
    if (success) {
      res.json({
        success: true,
        message: '메시지가 발행되었습니다.',
        data: {
          topic,
          message: testMessage,
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
 * test/receive 토픽으로 허브에 데이터 전송 (별칭 엔드포인트)
 * POST /mqtt-test/send-to-hub
 * 
 * Postman에서 더 직관적으로 사용할 수 있는 별칭 엔드포인트
 * /test와 동일한 기능을 제공합니다.
 */
router.post('/send-to-hub', (req, res) => {
  const { message, data, topic = 'test/receive' } = req.body;

  // message 또는 data 중 하나는 필수
  const messageContent = message || data;
  
  if (!messageContent) {
    return res.status(400).json({
      success: false,
      message: 'message 또는 data는 필수입니다.'
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
    // 메시지 포맷 (간단하게)
    let testMessage;
    if (typeof messageContent === 'object') {
      testMessage = messageContent;
    } else if (typeof messageContent === 'string') {
      // 문자열인 경우 JSON 파싱 시도
      try {
        testMessage = JSON.parse(messageContent);
      } catch (e) {
        // JSON이 아니면 그냥 문자열로
        testMessage = { message: messageContent };
      }
    } else {
      testMessage = { data: messageContent };
    }

    // 타임스탬프 추가
    testMessage.timestamp = new Date().toISOString();

    console.log(`[MQTT Test] 📤 Publishing to ${topic} (ESP32 허브로 데이터 전송):`, JSON.stringify(testMessage, null, 2));

    const success = mqttService.publish(topic, testMessage, { qos: 1 });
    
    if (success) {
      res.json({
        success: true,
        message: `메시지가 ${topic} 토픽으로 허브에 전송되었습니다.`,
        data: {
          topic,
          message: testMessage,
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
 * MAC 주소 기반 허브 토픽으로 메시지 발행
 * POST /mqtt-test/send-by-mac
 * 
 * 요청 본문:
 * {
 *   "mac_address": "AA:BB:CC:DD:EE:01",
 *   "message": "Hello Hub!",
 *   "topic_type": "send"  // "send" 또는 "receive" (기본값: "send")
 * }
 * 
 * 생성되는 토픽:
 * - hub/{mac_address}/send (기본)
 * - hub/{mac_address}/receive (topic_type이 "receive"인 경우)
 * 
 * Postman 사용 예제:
 * - URL: http://localhost:5000/mqtt-test/send-by-mac
 * - Method: POST
 * - Headers: Content-Type: application/json
 * - Body:
 *   {
 *     "mac_address": "AA:BB:CC:DD:EE:01",
 *     "message": "Hello Hub!"
 *   }
 */
router.post('/send-by-mac', (req, res) => {
  const { mac_address, message, data, topic_type = 'send' } = req.body;

  // mac_address는 필수
  if (!mac_address) {
    return res.status(400).json({
      success: false,
      message: 'mac_address는 필수입니다.'
    });
  }

  // MAC 주소 형식 검증 (간단한 검증)
  const macPattern = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
  if (!macPattern.test(mac_address)) {
    return res.status(400).json({
      success: false,
      message: '올바른 MAC 주소 형식이 아닙니다. (예: AA:BB:CC:DD:EE:01)'
    });
  }

  // message 또는 data 중 하나는 필수
  const messageContent = message || data;
  
  if (!messageContent) {
    return res.status(400).json({
      success: false,
      message: 'message 또는 data는 필수입니다.'
    });
  }

  // topic_type 검증
  if (topic_type !== 'send' && topic_type !== 'receive') {
    return res.status(400).json({
      success: false,
      message: 'topic_type은 "send" 또는 "receive"여야 합니다.'
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
    // 토픽 생성: hub/{mac_address}/send 또는 hub/{mac_address}/receive
    const topic = `hub/${mac_address}/${topic_type}`;

    // 메시지 포맷
    let mqttMessage;
    if (typeof messageContent === 'object') {
      mqttMessage = messageContent;
    } else if (typeof messageContent === 'string') {
      // 문자열인 경우 JSON 파싱 시도
      try {
        mqttMessage = JSON.parse(messageContent);
      } catch (e) {
        // JSON이 아니면 그냥 문자열로
        mqttMessage = { message: messageContent };
      }
    } else {
      mqttMessage = { data: messageContent };
    }

    // 타임스탬프 추가
    mqttMessage.timestamp = new Date().toISOString();
    mqttMessage.mac_address = mac_address;

    console.log(`[MQTT Test] 📤 Publishing to ${topic} (MAC: ${mac_address}):`, JSON.stringify(mqttMessage, null, 2));

    const success = mqttService.publish(topic, mqttMessage, { qos: 1 });
    
    if (success) {
      res.json({
        success: true,
        message: `메시지가 ${topic} 토픽으로 전송되었습니다.`,
        data: {
          mac_address,
          topic,
          topic_type,
          message: mqttMessage,
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
 * MAC 주소 기반으로 send와 receive 토픽 모두에 메시지 발행
 * POST /mqtt-test/send-both-by-mac
 * 
 * 요청 본문:
 * {
 *   "mac_address": "AA:BB:CC:DD:EE:01",
 *   "message": "Hello Hub!",
 *   "send_message": {...},  // send 토픽용 메시지 (선택)
 *   "receive_message": {...}  // receive 토픽용 메시지 (선택)
 * }
 * 
 * 생성되는 토픽:
 * - hub/{mac_address}/send
 * - hub/{mac_address}/receive
 */
router.post('/send-both-by-mac', (req, res) => {
  const { mac_address, message, data, send_message, receive_message } = req.body;

  // mac_address는 필수
  if (!mac_address) {
    return res.status(400).json({
      success: false,
      message: 'mac_address는 필수입니다.'
    });
  }

  // MAC 주소 형식 검증
  const macPattern = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
  if (!macPattern.test(mac_address)) {
    return res.status(400).json({
      success: false,
      message: '올바른 MAC 주소 형식이 아닙니다. (예: AA:BB:CC:DD:EE:01)'
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
    const sendTopic = `hub/${mac_address}/send`;
    const receiveTopic = `hub/${mac_address}/receive`;
    const results = [];

    // send 토픽으로 메시지 발행
    let sendMsg = send_message || message || data;
    if (typeof sendMsg === 'string') {
      try {
        sendMsg = JSON.parse(sendMsg);
      } catch (e) {
        sendMsg = { message: sendMsg };
      }
    } else if (typeof sendMsg !== 'object') {
      sendMsg = { data: sendMsg };
    }
    
    sendMsg.timestamp = new Date().toISOString();
    sendMsg.mac_address = mac_address;
    sendMsg.topic_type = 'send';

    console.log(`[MQTT Test] 📤 Publishing to ${sendTopic} (MAC: ${mac_address}):`, JSON.stringify(sendMsg, null, 2));
    const sendSuccess = mqttService.publish(sendTopic, sendMsg, { qos: 1 });
    results.push({
      topic: sendTopic,
      success: sendSuccess,
      message: sendMsg
    });

    // receive 토픽으로 메시지 발행
    let receiveMsg = receive_message || message || data;
    if (typeof receiveMsg === 'string') {
      try {
        receiveMsg = JSON.parse(receiveMsg);
      } catch (e) {
        receiveMsg = { message: receiveMsg };
      }
    } else if (typeof receiveMsg !== 'object') {
      receiveMsg = { data: receiveMsg };
    }
    
    receiveMsg.timestamp = new Date().toISOString();
    receiveMsg.mac_address = mac_address;
    receiveMsg.topic_type = 'receive';

    console.log(`[MQTT Test] 📤 Publishing to ${receiveTopic} (MAC: ${mac_address}):`, JSON.stringify(receiveMsg, null, 2));
    const receiveSuccess = mqttService.publish(receiveTopic, receiveMsg, { qos: 1 });
    results.push({
      topic: receiveTopic,
      success: receiveSuccess,
      message: receiveMsg
    });

    const allSuccess = results.every(r => r.success);
    
    res.json({
      success: allSuccess,
      message: allSuccess 
        ? `메시지가 ${sendTopic}와 ${receiveTopic} 토픽으로 모두 전송되었습니다.`
        : '일부 토픽으로 메시지 전송에 실패했습니다.',
      data: {
        mac_address,
        topics: {
          send: sendTopic,
          receive: receiveTopic
        },
        results,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[MQTT Test] Error:', error);
    res.status(500).json({
      success: false,
      message: '메시지 발행 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

module.exports = router;

