require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const mqtt = require('mqtt');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const PORT = process.env.MONITOR_PORT || 3001;

// Socket.IO 설정
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// 미들웨어
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// MQTT 브로커 연결
const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
const mqttClient = mqtt.connect(MQTT_BROKER_URL, {
  clientId: `monitor_${Date.now()}`,
  clean: true
});

// Telemetry 테스트 라우트
const telemetryTestRoutes = require('./routes/telemetry-test');
// MQTT 클라이언트를 공유
telemetryTestRoutes.setMQTTClient(mqttClient);
app.use('/api/telemetry-test', telemetryTestRoutes);

// 메시지 로그 저장 (최근 1000개)
const messageLog = [];
const MAX_LOG_SIZE = 1000;

// 통계 정보
const stats = {
  totalMessages: 0,
  messagesByTopic: new Map(),
  messagesByDirection: { incoming: 0, outgoing: 0 },
  lastMessageTime: null,
  connectedClients: 0
};

/**
 * 메시지 로그에 추가
 */
function addToLog(message) {
  messageLog.push(message);
  if (messageLog.length > MAX_LOG_SIZE) {
    messageLog.shift();
  }
  
  // 통계 업데이트
  stats.totalMessages++;
  stats.lastMessageTime = new Date().toISOString();
  
  const topic = message.topic;
  if (!stats.messagesByTopic.has(topic)) {
    stats.messagesByTopic.set(topic, 0);
  }
  stats.messagesByTopic.set(topic, stats.messagesByTopic.get(topic) + 1);
  
  stats.messagesByDirection[message.direction]++;
  
  // Socket.IO로 실시간 전송
  io.emit('mqtt_message', message);
  io.emit('stats_update', getStats());
}

/**
 * 통계 정보 가져오기
 */
function getStats() {
  return {
    totalMessages: stats.totalMessages,
    messagesByTopic: Object.fromEntries(stats.messagesByTopic),
    messagesByDirection: stats.messagesByDirection,
    lastMessageTime: stats.lastMessageTime,
    connectedClients: io.engine.clientsCount,
    topics: Array.from(stats.messagesByTopic.keys())
  };
}

// MQTT 연결 이벤트
mqttClient.on('connect', () => {
  console.log(`[MQTT Monitor] Connected to broker: ${MQTT_BROKER_URL}`);
  
  // 모든 토픽 구독 (# 와일드카드)
  mqttClient.subscribe('#', { qos: 0 }, (err) => {
    if (err) {
      console.error('[MQTT Monitor] Failed to subscribe:', err);
    } else {
      console.log('[MQTT Monitor] Subscribed to all topics (#)');
    }
  });
  
  // 백엔드 상태 토픽 구독
  mqttClient.subscribe('backend/status', { qos: 1 });
  
  // 허브 관련 모든 토픽 구독
  mqttClient.subscribe('hub/#', { qos: 0 });
  
  addToLog({
    type: 'system',
    topic: 'system',
    direction: 'system',
    message: 'MQTT Monitor connected',
    timestamp: new Date().toISOString(),
    payload: null
  });
});

// MQTT 메시지 수신
mqttClient.on('message', (topic, message) => {
  try {
    // Buffer를 문자열로 변환
    let payload;
    if (Buffer.isBuffer(message)) {
      payload = message.toString('utf8');
    } else if (typeof message === 'string') {
      payload = message;
    } else {
      payload = String(message);
    }
    
    // 터미널에 상세 출력
    console.log(`\n[MQTT Monitor] 📥 INCOMING MESSAGE`);
    console.log(`  Topic: ${topic}`);
    console.log(`  Size: ${message.length} bytes`);
    console.log(`  Raw payload (first 500 chars):`);
    console.log(`  ${payload.substring(0, 500)}${payload.length > 500 ? '...' : ''}`);
    
    let parsedPayload = null;
    try {
      parsedPayload = JSON.parse(payload);
      console.log(`  Parsed JSON:`, JSON.stringify(parsedPayload, null, 2).substring(0, 500));
    } catch (e) {
      parsedPayload = payload;
      console.log(`  Not JSON, treating as string`);
    }
    
    const logEntry = {
      type: 'incoming',
      topic: topic,
      direction: 'incoming',
      message: parsedPayload,
      payload: payload,
      timestamp: new Date().toISOString(),
      size: message.length
    };
    
    addToLog(logEntry);
  } catch (error) {
    console.error('[MQTT Monitor] ❌ Error processing message:', error);
    console.error('  Topic:', topic);
    console.error('  Message type:', typeof message);
    console.error('  Is Buffer:', Buffer.isBuffer(message));
  }
});

// MQTT 에러 처리
mqttClient.on('error', (error) => {
  console.error('[MQTT Monitor] MQTT error:', error);
  addToLog({
    type: 'error',
    topic: 'system',
    direction: 'error',
    message: `MQTT Error: ${error.message}`,
    timestamp: new Date().toISOString(),
    payload: null
  });
});

// MQTT 연결 끊김
mqttClient.on('close', () => {
  console.log('[MQTT Monitor] MQTT connection closed');
  addToLog({
    type: 'system',
    topic: 'system',
    direction: 'system',
    message: 'MQTT connection closed',
    timestamp: new Date().toISOString(),
    payload: null
  });
});

// MQTT 재연결
mqttClient.on('reconnect', () => {
  console.log('[MQTT Monitor] Reconnecting...');
});

// API: 메시지 로그 조회
app.get('/api/messages', (req, res) => {
  const { limit = 100, topic, direction } = req.query;
  let filtered = [...messageLog];
  
  if (topic) {
    filtered = filtered.filter(m => m.topic.includes(topic));
  }
  
  if (direction) {
    filtered = filtered.filter(m => m.direction === direction);
  }
  
  filtered = filtered.slice(-parseInt(limit));
  
  res.json({
    success: true,
    count: filtered.length,
    data: filtered.reverse() // 최신순
  });
});

// API: 통계 정보 조회
app.get('/api/stats', (req, res) => {
  res.json({
    success: true,
    data: getStats()
  });
});

// API: 특정 토픽에 메시지 발행 (테스트용)
app.post('/api/publish', (req, res) => {
  const { topic, message, qos = 0, retain = false } = req.body;
  
  if (!topic || !message) {
    return res.status(400).json({
      success: false,
      message: 'topic과 message는 필수입니다.'
    });
  }
  
  const payload = typeof message === 'object' ? JSON.stringify(message) : message;
  
  mqttClient.publish(topic, payload, { qos, retain }, (err) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: '메시지 발행 실패',
        error: err.message
      });
    }
    
    const logEntry = {
      type: 'outgoing',
      topic: topic,
      direction: 'outgoing',
      message: typeof message === 'object' ? message : null,
      payload: payload,
      timestamp: new Date().toISOString(),
      size: Buffer.byteLength(payload, 'utf8')
    };
    
    console.log(`\n[MQTT Monitor] 📤 OUTGOING MESSAGE`);
    console.log(`  Topic: ${topic}`);
    console.log(`  QoS: ${qos}, Retain: ${retain}`);
    console.log(`  Payload: ${payload.substring(0, 500)}${payload.length > 500 ? '...' : ''}`);
    
    addToLog(logEntry);
    
    res.json({
      success: true,
      message: '메시지가 발행되었습니다.',
      data: logEntry
    });
  });
});

// API: 로그 초기화
app.post('/api/clear', (req, res) => {
  messageLog.length = 0;
  stats.totalMessages = 0;
  stats.messagesByTopic.clear();
  stats.messagesByDirection = { incoming: 0, outgoing: 0 };
  stats.lastMessageTime = null;
  
  io.emit('log_cleared');
  io.emit('stats_update', getStats());
  
  res.json({
    success: true,
    message: '로그가 초기화되었습니다.'
  });
});

// Socket.IO 연결
io.on('connection', (socket) => {
  console.log(`[Monitor] Client connected: ${socket.id}`);
  stats.connectedClients = io.engine.clientsCount;
  
  // 초기 데이터 전송
  socket.emit('stats_update', getStats());
  socket.emit('recent_messages', messageLog.slice(-50).reverse());
  
  socket.on('disconnect', () => {
    console.log(`[Monitor] Client disconnected: ${socket.id}`);
    stats.connectedClients = io.engine.clientsCount;
  });
});

// 자동 Telemetry 전송 설정 (기본값: true로 자동 시작)
const AUTO_START_TELEMETRY = process.env.AUTO_START_TELEMETRY !== 'false'; // 기본값 true
const AUTO_TELEMETRY_HUB_ID = process.env.AUTO_TELEMETRY_HUB_ID || 'AA:BB:CC:DD:EE:01';
const AUTO_TELEMETRY_DEVICE_IDS = (process.env.AUTO_TELEMETRY_DEVICE_IDS || 'AA:BB:CC:DD:EE:02,AA:BB:CC:DD:EE:03,AA:BB:CC:DD:EE:04').split(',');

// 서버 시작
server.listen(PORT, async () => {
  console.log(`[MQTT Monitor] Server running on http://localhost:${PORT}`);
  console.log(`[MQTT Monitor] Web interface: http://localhost:${PORT}`);
  console.log(`[MQTT Monitor] API: http://localhost:${PORT}/api`);
  
  // MQTT 연결 후 자동 Telemetry 전송 시작
  if (AUTO_START_TELEMETRY) {
    mqttClient.once('connect', () => {
      console.log(`[MQTT Monitor] Auto-starting telemetry test...`);
      setTimeout(() => {
        try {
          const { startTelemetryTest } = require('./routes/telemetry-test');
          const result = startTelemetryTest(
            AUTO_TELEMETRY_HUB_ID,
            AUTO_TELEMETRY_DEVICE_IDS,
            1000 // 1초마다
          );
          
          if (result.success) {
            console.log(`[MQTT Monitor] ✅ Auto telemetry test started`);
            console.log(`   Hub: ${AUTO_TELEMETRY_HUB_ID}`);
            console.log(`   Devices: ${AUTO_TELEMETRY_DEVICE_IDS.join(', ')}`);
            console.log(`   Interval: 1 second`);
            console.log(`   Sample count: 50-59 per message`);
            console.log(`   Status: Running continuously until stopped`);
          } else {
            console.log(`[MQTT Monitor] ⚠️  Auto telemetry start failed: ${result.message}`);
          }
        } catch (error) {
          console.error(`[MQTT Monitor] ❌ Auto telemetry start error:`, error.message);
        }
      }, 1000); // 1초 대기 (서버 완전 시작 대기)
    });
  } else {
    console.log(`[MQTT Monitor] Auto telemetry test disabled (set AUTO_START_TELEMETRY=true to enable)`);
  }
});

// 종료 처리
process.on('SIGINT', () => {
  console.log('\n[MQTT Monitor] Shutting down...');
  mqttClient.end();
  server.close(() => {
    console.log('[MQTT Monitor] Server closed');
    process.exit(0);
  });
});

