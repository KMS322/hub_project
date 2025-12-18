import mqtt from 'mqtt'

/**
 * 프론트엔드 MQTT 서비스
 * 브라우저에서 직접 MQTT 브로커에 연결하여 통신
 */
class MQTTService {
  constructor() {
    this.client = null
    this.isConnected = false
    this.subscriptions = new Map() // 토픽별 콜백 저장
    this.reconnectAttempts = 0
    this.maxReconnectAttempts = 5
  }

  /**
   * MQTT 브로커에 연결
   * @param {string} brokerUrl - MQTT 브로커 URL (ws:// 또는 wss://)
   * @param {Object} options - 연결 옵션
   */
  connect(brokerUrl = null, options = {}) {
    // 브로커 URL이 제공되지 않으면 기본값 사용
    // 브라우저에서는 WebSocket을 통해 연결해야 함
    const defaultUrl = brokerUrl || 'ws://localhost:9001' // MQTT over WebSocket 기본 포트
    const mqttOptions = {
      clientId: `frontend_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      clean: true,
      reconnectPeriod: 5000,
      connectTimeout: 10000,
      ...options
    }

    console.log(`[MQTT Frontend] 🔌 Connecting to broker: ${defaultUrl}`)
    
    this.client = mqtt.connect(defaultUrl, mqttOptions)

    // 연결 성공 이벤트
    this.client.on('connect', () => {
      this.isConnected = true
      this.reconnectAttempts = 0
      console.log(`[MQTT Frontend] ✅ Connected to broker: ${defaultUrl}`)
      
      // 기존 구독 복구
      this.subscriptions.forEach(({ callback, qos }, topic) => {
        this.client.subscribe(topic, { qos }, (err) => {
          if (err) {
            console.error(`[MQTT Frontend] ❌ Failed to resubscribe to ${topic}:`, err)
          } else {
            console.log(`[MQTT Frontend] ✅ Resubscribed to ${topic}`)
          }
        })
      })
    })

    // 연결 끊김 이벤트 (조용히 처리)
    this.client.on('close', () => {
      this.isConnected = false
      // 콘솔 로그 제거
    })

    // 재연결 이벤트 (조용히 처리)
    this.client.on('reconnect', () => {
      this.reconnectAttempts++
      if (this.reconnectAttempts <= this.maxReconnectAttempts) {
        // 콘솔 로그 제거
      } else {
        // 최대 재연결 시도 횟수 초과 시 연결 종료
        this.disconnect()
      }
    })

    // 에러 이벤트 (조용히 처리)
    this.client.on('error', (error) => {
      // 콘솔 로그 제거 - WebSocket 연결 실패는 정상적인 상황일 수 있음
    })

    // 메시지 수신 이벤트
    this.client.on('message', (topic, message) => {
      try {
        // Buffer를 문자열로 변환
        let payload
        if (Buffer.isBuffer(message)) {
          payload = message.toString('utf8')
        } else if (typeof message === 'string') {
          payload = message
        } else {
          payload = String(message)
        }

        // JSON 파싱 시도
        let parsedMessage
        try {
          parsedMessage = JSON.parse(payload)
        } catch (e) {
          parsedMessage = payload
        }

        console.log(`[MQTT Frontend] 📥 Message received from ${topic}`)
        
        // 해당 토픽에 등록된 콜백 실행
        const subscription = this.subscriptions.get(topic)
        if (subscription) {
          subscription.callback(parsedMessage, topic)
        } else {
          // 와일드카드 구독 처리
          for (const [subscribedTopic, sub] of this.subscriptions.entries()) {
            if (this.topicMatches(subscribedTopic, topic)) {
              sub.callback(parsedMessage, topic)
              break
            }
          }
        }
      } catch (error) {
        console.error(`[MQTT Frontend] ❌ Error processing message from ${topic}:`, error)
      }
    })

    // 오프라인 이벤트
    this.client.on('offline', () => {
      this.isConnected = false
      console.log('[MQTT Frontend] Client offline')
    })
  }

  /**
   * 토픽 구독
   * @param {string} topic - 구독할 토픽
   * @param {Function} callback - 메시지 수신 시 실행할 콜백 함수
   * @param {number} qos - Quality of Service (0, 1, 2)
   */
  subscribe(topic, callback, qos = 1) {
    if (!this.client) {
      console.error('[MQTT Frontend] Client not initialized. Cannot subscribe.')
      return
    }

    // 이미 구독된 토픽인지 확인
    if (this.subscriptions.has(topic)) {
      console.log(`[MQTT Frontend] Already subscribed to ${topic}`)
      return
    }

    if (this.isConnected) {
      // 연결되어 있으면 즉시 구독
      this.client.subscribe(topic, { qos }, (err) => {
        if (err) {
          console.error(`[MQTT Frontend] ❌ Failed to subscribe to ${topic}:`, err)
        } else {
          console.log(`[MQTT Frontend] ✅ Subscribed to ${topic} (QoS ${qos})`)
          this.subscriptions.set(topic, { callback, qos })
        }
      })
    } else {
      // 연결되지 않았으면 대기 목록에 추가
      console.log(`[MQTT Frontend] Connection not ready, queuing subscription to ${topic}`)
      this.subscriptions.set(topic, { callback, qos })
    }
  }

  /**
   * 토픽 구독 해제
   * @param {string} topic - 구독 해제할 토픽
   */
  unsubscribe(topic) {
    if (!this.client || !this.isConnected) {
      console.error('[MQTT Frontend] Client not connected. Cannot unsubscribe.')
      return
    }

    this.client.unsubscribe(topic, (err) => {
      if (err) {
        console.error(`[MQTT Frontend] Failed to unsubscribe from ${topic}:`, err)
      } else {
        console.log(`[MQTT Frontend] Unsubscribed from ${topic}`)
        this.subscriptions.delete(topic)
      }
    })
  }

  /**
   * 메시지 발행
   * @param {string} topic - 발행할 토픽
   * @param {string|Object} message - 발행할 메시지
   * @param {Object} options - 발행 옵션 (qos, retain 등)
   */
  publish(topic, message, options = {}) {
    if (!this.client || !this.isConnected) {
      console.error('[MQTT Frontend] ❌ Client not connected. Cannot publish.')
      return false
    }

    const payload = typeof message === 'object' ? JSON.stringify(message) : message
    const publishOptions = {
      qos: options.qos || 1,
      retain: options.retain || false,
      ...options
    }

    console.log(`[MQTT Frontend] 📤 Publishing message to ${topic}`)
    console.log(`  QoS: ${publishOptions.qos}, Retain: ${publishOptions.retain}`)
    console.log(`  Payload: ${payload.substring(0, 200)}${payload.length > 200 ? '...' : ''}`)

    this.client.publish(topic, payload, publishOptions, (err) => {
      if (err) {
        console.error(`[MQTT Frontend] ❌ Failed to publish to ${topic}:`, err)
      } else {
        console.log(`[MQTT Frontend] ✅ Published successfully to ${topic}`)
      }
    })

    return true
  }

  /**
   * 연결 종료
   */
  disconnect() {
    if (this.client) {
      this.client.end()
      this.isConnected = false
      this.subscriptions.clear()
      console.log('[MQTT Frontend] Disconnected')
    }
  }

  /**
   * 연결 상태 확인
   */
  getConnectionStatus() {
    return this.isConnected
  }

  /**
   * 와일드카드 토픽 매칭
   * @param {string} pattern - 구독 패턴 (예: 'hub/+/status')
   * @param {string} topic - 실제 토픽 (예: 'hub/AA:BB:CC:DD:EE:01/status')
   * @returns {boolean} 매칭 여부
   */
  topicMatches(pattern, topic) {
    const patternParts = pattern.split('/')
    const topicParts = topic.split('/')
    
    // #는 반드시 마지막에 와야 하고, 나머지 모든 레벨을 매칭
    if (pattern.includes('#')) {
      const hashIndex = patternParts.indexOf('#')
      if (hashIndex !== patternParts.length - 1) {
        return false
      }
      for (let i = 0; i < hashIndex; i++) {
        if (patternParts[i] === '+') {
          continue
        }
        if (patternParts[i] !== topicParts[i]) {
          return false
        }
      }
      return topicParts.length >= hashIndex
    }
    
    // #가 없으면 길이가 같아야 함
    if (patternParts.length !== topicParts.length) {
      return false
    }
    
    // 각 레벨 비교
    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i] === '+') {
        continue
      }
      if (patternParts[i] !== topicParts[i]) {
        return false
      }
    }
    
    return true
  }
}

// 싱글톤 인스턴스 생성
const mqttService = new MQTTService()

export default mqttService

