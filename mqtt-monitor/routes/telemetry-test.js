const express = require('express');
const router = express.Router();
const mqtt = require('mqtt');

// MQTT 클라이언트 (server.js에서 전달받거나 새로 생성)
let mqttClient = null;

/**
 * MQTT 클라이언트 설정 (server.js에서 호출)
 */
function setMQTTClient(client) {
  mqttClient = client;
}

/**
 * MQTT 클라이언트 초기화 (fallback)
 */
function initMQTTClient() {
  if (mqttClient && mqttClient.connected) {
    return mqttClient;
  }

  // server.js의 클라이언트가 없으면 새로 생성
  const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
  mqttClient = mqtt.connect(MQTT_BROKER_URL, {
    clientId: `telemetry_test_${Date.now()}`,
    clean: true
  });

  mqttClient.on('connect', () => {
    console.log('[Telemetry Test] MQTT connected');
  });

  mqttClient.on('error', (error) => {
    console.error('[Telemetry Test] MQTT error:', error);
  });

  return mqttClient;
}

// 테스트 상태 관리
const testStatus = {
  isRunning: false,
  intervals: new Map(), // hubId:deviceId -> intervalId
  startTime: null,
  messageCount: 0,
  lastMessageTime: null
};

/**
 * Telemetry 테스트 시작 (내부 함수)
 */
function startTelemetryTest(hubId, deviceIds, interval = 1000) {
  if (testStatus.isRunning) {
    return { success: false, message: '이미 테스트가 실행 중입니다.' };
  }

  const client = initMQTTClient();
  
  if (!client || !client.connected) {
    return { success: false, message: 'MQTT 브로커에 연결되지 않았습니다.' };
  }

  testStatus.isRunning = true;
  testStatus.startTime = Date.now();
  testStatus.messageCount = 0;
  testStatus.intervals.clear();

  // 각 디바이스별로 Telemetry 전송 시작
  deviceIds.forEach((deviceId, index) => {
    const intervalId = setInterval(() => {
      const now = Date.now();
      const startTime = testStatus.startTime || now - 10000;

      // 50개 이상 샘플 생성 (각기 다른 랜덤 값)
      const dataArr = [];
      const sampleCount = 50 + Math.floor(Math.random() * 10); // 50-59개 랜덤
      
      for (let i = 0; i < sampleCount; i++) {
        // 각 샘플마다 완전히 랜덤한 값 생성
        dataArr.push({
          ir: 25000 + Math.floor(Math.random() * 10000) + (index * 1000),
          red: 12000 + Math.floor(Math.random() * 6000) + (index * 500),
          green: 7000 + Math.floor(Math.random() * 4000) + (index * 300),
          spo2: 90 + Math.floor(Math.random() * 10),
          hr: 60 + Math.floor(Math.random() * 40),
          temp: 36.0 + Math.random() * 3.0,
          battery: 50 + Math.floor(Math.random() * 50)
        });
      }

      const publishStartTime = Date.now(); // 발행 시작 시간
      
      const telemetryData = {
        device_mac_address: deviceId,
        timestamp: now,
        starttime: startTime,
        dataArr: dataArr,
        publishStartTime: publishStartTime // 성능 측정용
      };

      const topic = `hub/${hubId}/telemetry/${deviceId}`;
      
      client.publish(topic, JSON.stringify(telemetryData), { qos: 0 }, (err) => {
        if (err) {
          console.error(`[Telemetry Test] Failed to publish to ${topic}:`, err);
        } else {
          testStatus.messageCount++;
          testStatus.lastMessageTime = Date.now();
          console.log(`[Telemetry Test] 📤 Published to ${topic} (${dataArr.length} samples, total: ${testStatus.messageCount})`);
        }
      });
    }, interval);

    testStatus.intervals.set(`${hubId}:${deviceId}`, intervalId);
  });

  return {
    success: true,
    message: `Telemetry 테스트가 시작되었습니다.`,
    data: {
      hubId,
      deviceIds,
      interval,
      deviceCount: deviceIds.length
    }
  };
}

/**
 * Telemetry 테스트 시작
 * POST /telemetry-test/start
 */
router.post('/start', async (req, res) => {
  const { hubId, deviceIds, interval = 1000 } = req.body;

  if (!hubId || !deviceIds || !Array.isArray(deviceIds) || deviceIds.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'hubId와 deviceIds 배열은 필수입니다.'
    });
  }

  // 연결 대기
  const client = initMQTTClient();
  if (!client.connected) {
    await new Promise((resolve) => {
      if (client.connected) {
        resolve();
      } else {
        const timeout = setTimeout(() => {
          resolve();
        }, 2000);
        client.once('connect', () => {
          clearTimeout(timeout);
          resolve();
        });
      }
    });
  }

  const result = startTelemetryTest(hubId, deviceIds, interval);
  
  if (!result.success) {
    return res.status(result.message.includes('연결') ? 503 : 400).json(result);
  }

  res.json(result);
});

/**
 * Telemetry 테스트 중지
 * POST /telemetry-test/stop
 */
router.post('/stop', (req, res) => {
  if (!testStatus.isRunning) {
    return res.status(400).json({
      success: false,
      message: '실행 중인 테스트가 없습니다.'
    });
  }

  // 모든 인터벌 정지
  testStatus.intervals.forEach((intervalId) => {
    clearInterval(intervalId);
  });
  testStatus.intervals.clear();

  const duration = testStatus.startTime ? Date.now() - testStatus.startTime : 0;
  const totalMessages = testStatus.messageCount;

  testStatus.isRunning = false;
  testStatus.startTime = null;
  testStatus.messageCount = 0;
  testStatus.lastMessageTime = null;

  res.json({
    success: true,
    message: 'Telemetry 테스트가 중지되었습니다.',
    data: {
      duration: duration,
      totalMessages: totalMessages,
      averageRate: duration > 0 ? (totalMessages / (duration / 1000)).toFixed(2) : 0
    }
  });
});

/**
 * 테스트 상태 조회
 * GET /telemetry-test/status
 */
router.get('/status', (req, res) => {
  res.json({
    success: true,
    data: {
      isRunning: testStatus.isRunning,
      startTime: testStatus.startTime,
      messageCount: testStatus.messageCount,
      lastMessageTime: testStatus.lastMessageTime,
      duration: testStatus.startTime ? Date.now() - testStatus.startTime : 0,
      activeDevices: testStatus.intervals.size
    }
  });
});

// 내부 함수도 export (자동 시작용)
module.exports = router;
module.exports.startTelemetryTest = startTelemetryTest;
module.exports.testStatus = testStatus;
module.exports.setMQTTClient = setMQTTClient;

