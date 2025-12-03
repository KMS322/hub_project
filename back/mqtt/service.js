const mqttClient = require('./client');

/**
 * MQTT 서비스 클래스
 * 허브(ESP32-S3)와의 양방향 통신을 위한 고수준 API 제공
 * 문서 요구사항에 맞춘 토픽 구조 사용:
 * - hub/{hubId}/command/{deviceId} - 명령
 * - hub/{hubId}/response/{deviceId} - 응답
 * - hub/{hubId}/telemetry/{deviceId} - 측정값
 * - hub/{hubId}/status - 허브 상태
 */
class MQTTService {
  constructor(io = null, telemetryQueue = null) {
    this.io = io; // Socket.IO 인스턴스
    this.telemetryQueue = telemetryQueue; // Telemetry 데이터 큐
    this.pendingCommands = new Map(); // requestId 기반 명령 대기 목록
    this.hubCallbacks = new Map(); // 허브별 콜백 저장
  }

  /**
   * MQTT 클라이언트 초기화 및 기본 구독 설정
   */
  initialize() {
    // MQTT 클라이언트 연결
    mqttClient.connect();

    // 구독 설정 (연결 전이어도 대기 목록에 추가됨)
    // mqttClient.subscribe()가 연결 상태를 확인하고
    // 연결되지 않았으면 자동으로 대기 목록에 추가하여
    // 연결 완료 시 자동으로 구독됨
    this.setupSubscriptions();
  }

  /**
   * 기본 구독 설정 (문서 요구사항에 맞춘 토픽 구조)
   */
  setupSubscriptions() {
    // 허브 상태 토픽 구독: hub/{hubId}/status
    mqttClient.subscribe('hub/+/status', (message, topic) => {
      this.handleHubStatus(message, topic);
    }, 1); // QoS 1

    // Telemetry 데이터 토픽 구독: hub/{hubId}/telemetry/{deviceId}
    mqttClient.subscribe('hub/+/telemetry/+', (message, topic) => {
      this.handleTelemetry(message, topic);
    }, 0); // QoS 0 (대량 데이터)

    // 명령 응답 토픽 구독: hub/{hubId}/response/{deviceId}
    mqttClient.subscribe('hub/+/response/+', (message, topic) => {
      this.handleCommandResponse(message, topic);
    }, 1); // QoS 1

    // 모든 허브 메시지 구독 (디버깅용, 개발 모드에서만)
    // 명령 토픽(/command/)은 제외 - 자신이 발행한 메시지를 받지 않도록
    if (process.env.NODE_ENV === 'development') {
      mqttClient.subscribe('hub/#', (message, topic) => {
        // 명령 토픽은 제외 (자신이 발행한 메시지)
        if (topic.includes('/command/')) {
          return; // 명령 토픽은 무시
        }
        // 이미 처리된 토픽은 로그만 남기고 중복 처리 방지
        if (!topic.includes('/status') && !topic.includes('/telemetry') && !topic.includes('/response')) {
          console.log(`[MQTT Service] Received from ${topic}`);
        }
      }, 0);
      
      // 개발 모드에서 모든 토픽 구독 (테스트용)
      mqttClient.subscribe('#', (message, topic) => {
        // hub 관련 토픽은 이미 처리되므로 스킵
        if (!topic.startsWith('hub/') && !topic.startsWith('backend/')) {
          let messageStr;
          try {
            if (Buffer.isBuffer(message)) {
              messageStr = message.toString('utf8');
            } else if (typeof message === 'object') {
              messageStr = JSON.stringify(message);
            } else {
              messageStr = String(message);
            }
            
            let parsedMessage;
            try {
              parsedMessage = JSON.parse(messageStr);
            } catch (e) {
              parsedMessage = messageStr;
            }
            
            console.log(`\n[MQTT Service] 🔍 Debug - Received from ${topic}`);
            console.log(`  Message:`, typeof parsedMessage === 'object' ? JSON.stringify(parsedMessage, null, 2) : parsedMessage);
          } catch (e) {
            console.log(`[MQTT Service] 🔍 Debug - Received from ${topic}`);
            console.log(`  Raw message:`, message);
          }
        }
      }, 0);
      
      console.log(`[MQTT Service] 🔍 Debug mode: Subscribed to all topics (#)`);
    }
  }

  /**
   * 허브 상태 메시지 처리
   * @param {Object|string} message - 수신된 메시지
   * @param {string} topic - 메시지가 수신된 토픽
   */
  handleHubStatus(message, topic) {
    const { hubId } = this.extractHubDeviceId(topic);
    let statusData;
    
    try {
      // Buffer를 문자열로 변환
      const messageStr = Buffer.isBuffer(message) ? message.toString('utf8') : 
                        typeof message === 'string' ? message : JSON.stringify(message);
      statusData = JSON.parse(messageStr);
    } catch (e) {
      statusData = { status: Buffer.isBuffer(message) ? message.toString('utf8') : message };
    }

    console.log(`[MQTT Service] 🔌 Hub ${hubId} status:`, JSON.stringify(statusData, null, 2));

    // Socket.IO로 클라이언트에 전달
    if (this.io) {
      this.io.emit('TELEMETRY', {
        type: 'hub_status',
        hubId,
        data: statusData,
        timestamp: new Date().toISOString()
      });
    }

    // 등록된 콜백 실행
    const callback = this.hubCallbacks.get(`status:${hubId}`);
    if (callback) {
      callback(statusData, hubId);
    }
  }

  /**
   * Telemetry 데이터 메시지 처리 (대량 데이터)
   * @param {Object|string} message - 수신된 메시지
   * @param {string} topic - 메시지가 수신된 토픽
   */
  handleTelemetry(message, topic) {
    const receiveStartTime = Date.now(); // 성능 측정 시작 (MQTT 수신 시간)
    const { hubId, deviceId } = this.extractHubDeviceId(topic);
    
    let telemetryData;
    try {
      // Buffer를 문자열로 변환
      const messageStr = Buffer.isBuffer(message) ? message.toString('utf8') : 
                        typeof message === 'string' ? message : JSON.stringify(message);
      
      telemetryData = JSON.parse(messageStr);
      
      // 터미널에 데이터 출력
      const sampleCount = telemetryData.dataArr?.length || 0;
      console.log(`[MQTT Service] 📊 Telemetry received from ${topic}`);
      console.log(`  Hub: ${hubId}, Device: ${deviceId}`);
      console.log(`  Timestamp: ${telemetryData.timestamp || 'N/A'}`);
      console.log(`  Samples: ${sampleCount}`);
      if (sampleCount > 0) {
        const firstSample = telemetryData.dataArr[0];
        console.log(`  First sample: HR=${firstSample.hr}, SpO2=${firstSample.spo2}, Temp=${firstSample.temp}°C, Battery=${firstSample.battery}%`);
      }
    } catch (e) {
      console.error(`[MQTT Service] ❌ Failed to parse telemetry from ${topic}:`, e.message);
      console.error(`  Raw message type: ${typeof message}, isBuffer: ${Buffer.isBuffer(message)}`);
      if (Buffer.isBuffer(message)) {
        console.error(`  Buffer length: ${message.length}, preview: ${message.toString('utf8').substring(0, 200)}`);
      } else {
        console.error(`  Message preview: ${String(message).substring(0, 200)}`);
      }
      return;
    }

    // 큐에 추가 (Worker가 처리)
    if (this.telemetryQueue) {
      this.telemetryQueue.push({
        hubId,
        deviceId,
        data: telemetryData,
        timestamp: new Date(),
        topic,
        receiveStartTime // 성능 측정용
      });
      const queueTime = Date.now() - receiveStartTime;
      console.log(`[MQTT Service] ✅ Telemetry queued for processing (Queue time: ${queueTime}ms)`);
    } else {
      console.warn('[MQTT Service] ⚠️ Telemetry queue not available, data may be lost');
    }

    // 실시간 WebSocket 브로드캐스트는 Worker에서 처리 (성능 최적화)
  }

  /**
   * 명령 응답 메시지 처리 (requestId 기반 매칭)
   * @param {Object|string} message - 수신된 메시지
   * @param {string} topic - 메시지가 수신된 토픽
   */
  handleCommandResponse(message, topic) {
    const { hubId, deviceId } = this.extractHubDeviceId(topic);
    
    let responseData;
    try {
      // Buffer를 문자열로 변환
      const messageStr = Buffer.isBuffer(message) ? message.toString('utf8') : 
                        typeof message === 'string' ? message : JSON.stringify(message);
      responseData = JSON.parse(messageStr);
    } catch (e) {
      responseData = { result: Buffer.isBuffer(message) ? message.toString('utf8') : message };
    }

    console.log(`[MQTT Service] 📨 Hub ${hubId} Device ${deviceId} response:`, JSON.stringify(responseData, null, 2));

    // requestId로 대기 중인 명령 찾기
    const requestId = responseData.requestId;
    if (requestId && this.pendingCommands.has(requestId)) {
      const { resolve, reject, timeout } = this.pendingCommands.get(requestId);
      clearTimeout(timeout);
      this.pendingCommands.delete(requestId);

      // Socket.IO로 CONTROL_RESULT 전송
      if (this.io) {
        this.io.emit('CONTROL_RESULT', {
          requestId,
          hubId,
          deviceId,
          success: responseData.success !== false,
          data: responseData,
          timestamp: new Date().toISOString()
        });
      }

      // Promise resolve
      if (resolve) {
        resolve(responseData);
      }
    } else {
      console.warn(`[MQTT Service] No pending command found for requestId: ${requestId}`);
    }
  }

  /**
   * 토픽에서 허브 ID와 디바이스 ID 추출
   * @param {string} topic - MQTT 토픽 (예: hub/hub123/telemetry/device456)
   * @returns {Object} { hubId, deviceId }
   */
  extractHubDeviceId(topic) {
    const parts = topic.split('/');
    const hubId = parts[1] || 'unknown';
    const deviceId = parts.length > 3 ? parts[3] : null;
    return { hubId, deviceId };
  }

  /**
   * 허브에 명령 전송 (requestId 기반 RPC)
   * @param {string} hubId - 허브 ID (MAC 주소)
   * @param {string} deviceId - 디바이스 ID (MAC 주소)
   * @param {Object} command - 전송할 명령
   * @param {number} timeout - 타임아웃 (ms, 기본 2000ms)
   * @returns {Promise} 응답을 기다리는 Promise
   */
  sendCommand(hubId, deviceId, command, timeout = 2000) {
    return new Promise((resolve, reject) => {
      const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const topic = `hub/${hubId}/command/${deviceId}`;
      
      const message = {
        ...command,
        requestId,
        timestamp: new Date().toISOString()
      };

      // 타임아웃 설정
      const timeoutId = setTimeout(() => {
        if (this.pendingCommands.has(requestId)) {
          this.pendingCommands.delete(requestId);
          reject(new Error(`Command timeout after ${timeout}ms`));
        }
      }, timeout);

      // 대기 목록에 추가
      this.pendingCommands.set(requestId, { resolve, reject, timeout: timeoutId });

      // MQTT로 명령 발행 (QoS 1)
      console.log(`[MQTT Service] 📤 Sending command to ${topic}`);
      console.log(`  RequestId: ${requestId}`);
      console.log(`  Command:`, JSON.stringify(command, null, 2));
      
      const success = mqttClient.publish(topic, message, {
        qos: 1,
        retain: false
      });

      if (!success) {
        clearTimeout(timeoutId);
        this.pendingCommands.delete(requestId);
        reject(new Error('Failed to publish command'));
      } else {
        console.log(`[MQTT Service] ✅ Command published successfully`);
      }
    });
  }

  /**
   * 허브에 설정 전송
   * @param {string} hubId - 허브 ID
   * @param {Object} settings - 설정 객체
   */
  sendHubSettings(hubId, settings) {
    const topic = `hub/${hubId}/settings`;
    const message = {
      ...settings,
      timestamp: new Date().toISOString()
    };

    return mqttClient.publish(topic, message, {
      qos: 1,
      retain: true // 설정은 retain으로 저장
    });
  }

  /**
   * 허브별 콜백 등록
   * @param {string} hubId - 허브 ID
   * @param {string} type - 콜백 타입 ('status', 'telemetry', 'response')
   * @param {Function} callback - 콜백 함수
   */
  registerCallback(hubId, type, callback) {
    const key = `${type}:${hubId}`;
    this.hubCallbacks.set(key, callback);
  }

  /**
   * 허브별 콜백 제거
   * @param {string} hubId - 허브 ID
   * @param {string} type - 콜백 타입
   */
  unregisterCallback(hubId, type) {
    const key = `${type}:${hubId}`;
    this.hubCallbacks.delete(key);
  }

  /**
   * 커스텀 토픽 구독
   * @param {string} topic - 구독할 토픽 (와일드카드 지원)
   * @param {Function} callback - 메시지 수신 시 실행할 콜백
   * @param {number} qos - Quality of Service
   */
  subscribe(topic, callback, qos = 1) {
    mqttClient.subscribe(topic, callback, qos);
  }

  /**
   * 커스텀 토픽에 메시지 발행
   * @param {string} topic - 발행할 토픽
   * @param {Object|string} message - 발행할 메시지
   * @param {Object} options - 발행 옵션
   */
  publish(topic, message, options = {}) {
    return mqttClient.publish(topic, message, options);
  }

  /**
   * 연결 상태 확인
   */
  isConnected() {
    return mqttClient.getConnectionStatus();
  }

  /**
   * MQTT 서비스 종료
   */
  shutdown() {
    mqttClient.disconnect();
    this.hubCallbacks.clear();
    this.pendingCommands.clear();
  }
}

module.exports = MQTTService;
