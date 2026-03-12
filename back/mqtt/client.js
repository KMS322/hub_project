const mqtt = require('mqtt');

class MQTTClient {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.subscriptions = new Map(); // 토픽별 콜백 저장
    this.pendingSubscriptions = new Map(); // 연결 전 구독 요청 저장
  }

  /**
   * MQTT 브로커에 연결
   */
  connect() {
    const brokerUrl = process.env.MQTT_BROKER_URL || 'mqtt://192.168.0.23:1883';
    const options = {
      clientId: `backend_${Date.now()}`,
      clean: true,
      reconnectPeriod: 5000,
      connectTimeout: 10000,
      username: process.env.MQTT_USERNAME || '',
      password: process.env.MQTT_PASSWORD || '',
      will: {
        topic: 'backend/status',
        payload: 'offline',
        qos: 1,
        retain: true
      }
    };

    this.client = mqtt.connect(brokerUrl, options);

    // 연결 성공 이벤트
    this.client.on('connect', () => {
      this.isConnected = true;
      console.log(`[MQTT] ✅ Connected to broker: ${brokerUrl}`);
      console.log(`[MQTT] ℹ️  Note: Mosquitto is running as a Windows service`);
      
      // 백엔드 상태를 online으로 발행
      this.client.publish('backend/status', 'online', { qos: 1, retain: true });
      
      // 기존 구독 복구
      this.subscriptions.forEach((callback, topic) => {
        this.client.subscribe(topic, (err) => {
          if (err) {
            console.error(`[MQTT] ❌ Failed to resubscribe to ${topic}:`, err);
          } else {
            console.log(`[MQTT] ✅ Resubscribed to ${topic}`);
            if (topic.startsWith('test/')) {
              console.log(`[MQTT] 🧪 Test topic resubscribed - ready to receive messages`);
            }
          }
        });
      });

      // 연결 전에 요청된 구독 처리
      this.pendingSubscriptions.forEach(({ callback, qos }, topic) => {
        this.client.subscribe(topic, { qos }, (err) => {
          if (err) {
            console.error(`[MQTT] Failed to subscribe to ${topic}:`, err);
          } else {
            console.log(`[MQTT] Subscribed to ${topic} (pending)`);
            this.subscriptions.set(topic, callback);
            this.pendingSubscriptions.delete(topic);
          }
        });
      });
    });

    // 연결 끊김 이벤트
    this.client.on('close', () => {
      this.isConnected = false;
      console.log('[MQTT] Connection closed');
    });

    // 재연결 이벤트
    this.client.on('reconnect', () => {
      console.log('[MQTT] Reconnecting...');
    });

    // 에러 이벤트
    this.client.on('error', (error) => {
      console.error('[MQTT] Error:', error);
    });

    // 메시지 수신 이벤트
    this.client.on('message', (topic, message) => {
      try {
        // 명령/receive 토픽은 자신이 발행한 메시지 에코이므로 로그 없이 무시
        if (topic.includes('/command/') || topic.includes('/receive')) {
          return;
        }

        // Buffer를 문자열로 변환 (로그용)
        let payload;
        if (Buffer.isBuffer(message)) {
          payload = message.toString('utf8');
        } else if (typeof message === 'string') {
          payload = message;
        } else {
          payload = String(message);
        }
        const preview = payload.length > 200 ? payload.substring(0, 200) + '...' : payload;
        console.log(`[MQTT] 📥 ${topic} | ${preview.replace(/\n/g, ' ')}`);

        let parsedMessage;
        try {
          parsedMessage = JSON.parse(payload);
          console.log(`  ✅ Parsed as JSON successfully`);
        } catch (e) {
          parsedMessage = payload;
          console.log(`  ℹ️  Not JSON, using raw string`);
        }
        
        // test/ 토픽인 경우 특별히 강조
        if (topic.startsWith('test/')) {
          console.log(`  🧪 TEST TOPIC DETECTED (${topic}) - Processing test message...`);
        }
        
        // 해당 토픽에 등록된 콜백 실행
        const callback = this.subscriptions.get(topic);
        if (callback) {
          console.log(`  ✅ Found exact topic subscription callback`);
          callback(parsedMessage, topic);
        } else {
          // 와일드카드 구독 처리
          let matched = false;
          for (const [subscribedTopic, cb] of this.subscriptions.entries()) {
            if (this.topicMatches(subscribedTopic, topic)) {
              console.log(`  ✅ Found wildcard subscription match: ${subscribedTopic} matches ${topic}`);
              cb(parsedMessage, topic);
              matched = true;
              break; // 첫 번째 매칭만 처리
            }
          }
          if (!matched) {
            console.log(`  ⚠️  No subscription callback found for topic: ${topic}`);
            console.log(`  Available subscriptions:`, Array.from(this.subscriptions.keys()));
            console.log(`  Attempted wildcard matching but no match found`);
            
            // 디버깅: 각 구독 패턴과의 매칭 시도
            for (const [subscribedTopic] of this.subscriptions.entries()) {
              const matches = this.topicMatches(subscribedTopic, topic);
              console.log(`    - Pattern "${subscribedTopic}" matches "${topic}": ${matches}`);
            }
          }
        }
      } catch (error) {
        console.error(`[MQTT] ❌ Error processing message from ${topic}:`, error);
        console.error(`  Message type: ${typeof message}, isBuffer: ${Buffer.isBuffer(message)}`);
      }
    });

    // 오프라인 이벤트
    this.client.on('offline', () => {
      this.isConnected = false;
      console.log('[MQTT] Client offline');
    });
  }

  /**
   * 토픽 구독
   * @param {string} topic - 구독할 토픽
   * @param {Function} callback - 메시지 수신 시 실행할 콜백 함수
   * @param {number} qos - Quality of Service (0, 1, 2)
   */
  subscribe(topic, callback, qos = 1) {
    if (!this.client) {
      console.error('[MQTT] Client not initialized. Cannot subscribe.');
      return;
    }

    // 이미 구독된 토픽인지 확인
    if (this.subscriptions.has(topic)) {
      console.log(`[MQTT] Already subscribed to ${topic}`);
      return;
    }

    if (this.isConnected) {
      // 연결되어 있으면 즉시 구독
      this.client.subscribe(topic, { qos }, (err) => {
        if (err) {
          console.error(`[MQTT] ❌ Failed to subscribe to ${topic}:`, err);
        } else {
          console.log(`[MQTT] ✅ Subscribed to ${topic} (QoS ${qos})`);
          this.subscriptions.set(topic, callback);
          
          // test/ 토픽인 경우 특별히 강조
          if (topic.startsWith('test/')) {
            console.log(`[MQTT] 🧪 Test topic subscription active - ready to receive ESP32 messages`);
          }
        }
      });
    } else {
      // 연결되지 않았으면 대기 목록에 추가
      console.log(`[MQTT] Connection not ready, queuing subscription to ${topic}`);
      this.pendingSubscriptions.set(topic, { callback, qos });
    }
  }

  /**
   * 토픽 구독 해제
   * @param {string} topic - 구독 해제할 토픽
   */
  unsubscribe(topic) {
    if (!this.client || !this.isConnected) {
      console.error('[MQTT] Client not connected. Cannot unsubscribe.');
      return;
    }

    this.client.unsubscribe(topic, (err) => {
      if (err) {
        console.error(`[MQTT] Failed to unsubscribe from ${topic}:`, err);
      } else {
        console.log(`[MQTT] Unsubscribed from ${topic}`);
        this.subscriptions.delete(topic);
      }
    });
  }

  /**
   * 메시지 발행
   * @param {string} topic - 발행할 토픽
   * @param {string|Object} message - 발행할 메시지
   * @param {Object} options - 발행 옵션 (qos, retain 등)
   */
  publish(topic, message, options = {}) {
    if (!this.client || !this.isConnected) {
      console.error('[MQTT] ❌ Client not connected. Cannot publish.');
      return false;
    }

    const payload = typeof message === 'object' ? JSON.stringify(message) : message;
    const publishOptions = {
      qos: options.qos || 1,
      retain: options.retain || false,
      ...options
    };

    this.client.publish(topic, payload, publishOptions, (err) => {
      if (err) {
        console.error(`[MQTT] ❌ Failed to publish to ${topic}:`, err);
      }
    });

    return true;
  }

  /**
   * 연결 종료
   */
  disconnect() {
    if (this.client) {
      this.client.publish('backend/status', 'offline', { qos: 1, retain: true });
      this.client.end();
      this.isConnected = false;
      this.subscriptions.clear();
      console.log('[MQTT] Disconnected');
    }
  }

  /**
   * 연결 상태 확인
   */
  getConnectionStatus() {
    return this.isConnected;
  }

  /**
   * 와일드카드 토픽 매칭
   * @param {string} pattern - 구독 패턴 (예: 'hub/+/status')
   * @param {string} topic - 실제 토픽 (예: 'hub/AA:BB:CC:DD:EE:01/status')
   * @returns {boolean} 매칭 여부
   */
  topicMatches(pattern, topic) {
    // MQTT 와일드카드 매칭 규칙 (#, +)
    const patternParts = pattern.split('/');
    const topicParts = topic.split('/');
    
    // #는 반드시 마지막에 와야 하고, 나머지 모든 레벨을 매칭
    if (pattern.includes('#')) {
      const hashIndex = patternParts.indexOf('#');
      if (hashIndex !== patternParts.length - 1) {
        // #가 마지막이 아니면 잘못된 패턴
        return false;
      }
      // # 이전의 모든 레벨이 매칭되는지 확인
      for (let i = 0; i < hashIndex; i++) {
        if (patternParts[i] === '+') {
          continue; // +는 한 레벨 매칭
        }
        if (patternParts[i] !== topicParts[i]) {
          return false;
        }
      }
      // # 이후의 모든 레벨이 매칭됨
      return topicParts.length >= hashIndex;
    }
    
    // #가 없으면 길이가 같아야 함
    if (patternParts.length !== topicParts.length) {
      return false;
    }
    
    // 각 레벨 비교
    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i] === '+') {
        continue; // +는 한 레벨 매칭
      }
      if (patternParts[i] !== topicParts[i]) {
        return false;
      }
    }
    
    return true;
  }
}

// 싱글톤 인스턴스 생성
const mqttClient = new MQTTClient();

module.exports = mqttClient;

