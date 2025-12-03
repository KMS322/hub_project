const mqtt = require('mqtt');

/**
 * MQTT 테스트 시뮬레이터
 * 허브와 디바이스의 동작을 시뮬레이션하여 백엔드 테스트에 사용
 * 
 * 사용법:
 * node back/test/mqttSimulator.js
 */

class MQTTSimulator {
  constructor(brokerUrl = 'mqtt://localhost:1883') {
    this.brokerUrl = brokerUrl;
    this.client = null;
    this.hubs = new Map(); // 허브별 시뮬레이터 인스턴스
  }

  /**
   * MQTT 브로커에 연결
   */
  connect() {
    this.client = mqtt.connect(this.brokerUrl, {
      clientId: `simulator_${Date.now()}`,
      clean: true
    });

    this.client.on('connect', () => {
      console.log('[Simulator] Connected to MQTT broker');
      this.setupSubscriptions();
    });

    this.client.on('error', (error) => {
      console.error('[Simulator] MQTT error:', error);
    });

    this.client.on('close', () => {
      console.log('[Simulator] Connection closed');
    });
  }

  /**
   * 백엔드 명령 구독
   */
  setupSubscriptions() {
    // 허브 명령 구독: hub/{hubId}/command/{deviceId}
    this.client.subscribe('hub/+/command/+', (err) => {
      if (err) {
        console.error('[Simulator] Failed to subscribe:', err);
      } else {
        console.log('[Simulator] Subscribed to hub/+/command/+');
      }
    });

    // 허브 설정 구독: hub/{hubId}/settings
    this.client.subscribe('hub/+/settings', (err) => {
      if (err) {
        console.error('[Simulator] Failed to subscribe:', err);
      } else {
        console.log('[Simulator] Subscribed to hub/+/settings');
      }
    });

    // 메시지 수신 처리
    this.client.on('message', (topic, message) => {
      this.handleMessage(topic, message);
    });
  }

  /**
   * 수신된 메시지 처리
   */
  handleMessage(topic, message) {
    try {
      const data = JSON.parse(message.toString());
      const parts = topic.split('/');
      
      if (parts[0] === 'hub' && parts[2] === 'command') {
        const hubId = parts[1];
        const deviceId = parts[3];
        this.handleCommand(hubId, deviceId, data);
      } else if (parts[0] === 'hub' && parts[2] === 'settings') {
        const hubId = parts[1];
        this.handleSettings(hubId, data);
      }
    } catch (error) {
      console.error('[Simulator] Error handling message:', error);
    }
  }

  /**
   * 명령 처리 및 응답 전송
   */
  handleCommand(hubId, deviceId, command) {
    console.log(`[Simulator] Command received: hub=${hubId}, device=${deviceId}`, command);

    // 명령 타입에 따라 처리
    const response = {
      requestId: command.requestId,
      success: true,
      timestamp: new Date().toISOString()
    };

    if (command.action === 'start_measurement') {
      response.message = '측정이 시작되었습니다.';
      response.data = { status: 'measuring' };
    } else if (command.action === 'stop_measurement') {
      response.message = '측정이 중지되었습니다.';
      response.data = { status: 'stopped' };
    } else if (command.action === 'led_blink') {
      response.message = 'LED가 깜빡입니다.';
      response.data = { led: 'blinking' };
    } else {
      response.message = '명령이 처리되었습니다.';
      response.data = command;
    }

    // 응답 전송: hub/{hubId}/response/{deviceId}
    const responseTopic = `hub/${hubId}/response/${deviceId}`;
    this.client.publish(responseTopic, JSON.stringify(response), { qos: 1 }, (err) => {
      if (err) {
        console.error('[Simulator] Failed to publish response:', err);
      } else {
        console.log(`[Simulator] Response sent to ${responseTopic}`);
      }
    });
  }

  /**
   * 설정 처리
   */
  handleSettings(hubId, settings) {
    console.log(`[Simulator] Settings received for hub ${hubId}:`, settings);
    // 설정 저장 로직 (시뮬레이션)
  }

  /**
   * Telemetry 데이터 자동 생성 및 전송
   * @param {string} hubId - 허브 ID
   * @param {string} deviceId - 디바이스 ID
   * @param {number} frequency - 전송 주기 (ms, 기본 20ms = 50Hz)
   */
  startTelemetry(hubId, deviceId, frequency = 20) {
    const key = `${hubId}:${deviceId}`;
    
    if (this.hubs.has(key)) {
      console.log(`[Simulator] Telemetry already running for ${key}`);
      return;
    }

    let sampleIndex = 0;
    const startTime = Date.now();

    const interval = setInterval(() => {
      // 50개 샘플 배치 생성 (1초치 데이터)
      if (sampleIndex % 50 === 0) {
        const dataArr = [];
        for (let i = 0; i < 50; i++) {
          dataArr.push({
            ir: 30000 + Math.floor(Math.random() * 5000),
            red: 15000 + Math.floor(Math.random() * 3000),
            green: 9000 + Math.floor(Math.random() * 2000),
            spo2: 95 + Math.floor(Math.random() * 5),
            hr: 70 + Math.floor(Math.random() * 30),
            temp: 37.5 + Math.random() * 1.5,
            battery: 80 + Math.floor(Math.random() * 20)
          });
        }

        const telemetryData = {
          device_mac_address: deviceId,
          timestamp: Date.now(),
          starttime: startTime,
          dataArr: dataArr
        };

        // Telemetry 전송: hub/{hubId}/telemetry/{deviceId}
        const topic = `hub/${hubId}/telemetry/${deviceId}`;
        this.client.publish(topic, JSON.stringify(telemetryData), { qos: 0 }, (err) => {
          if (err) {
            console.error(`[Simulator] Failed to publish telemetry:`, err);
          }
        });

        console.log(`[Simulator] Telemetry sent: ${key} (${dataArr.length} samples)`);
      }

      sampleIndex++;
    }, frequency);

    this.hubs.set(key, interval);
    console.log(`[Simulator] Started telemetry for ${key} (${1000/frequency}Hz)`);
  }

  /**
   * Telemetry 전송 중지
   */
  stopTelemetry(hubId, deviceId) {
    const key = `${hubId}:${deviceId}`;
    const interval = this.hubs.get(key);
    
    if (interval) {
      clearInterval(interval);
      this.hubs.delete(key);
      console.log(`[Simulator] Stopped telemetry for ${key}`);
    }
  }

  /**
   * 허브 상태 전송
   */
  sendHubStatus(hubId, status = 'online') {
    const topic = `hub/${hubId}/status`;
    const statusData = {
      status,
      timestamp: new Date().toISOString(),
      connected_devices: 6
    };

    this.client.publish(topic, JSON.stringify(statusData), { qos: 1, retain: true }, (err) => {
      if (err) {
        console.error('[Simulator] Failed to publish hub status:', err);
      } else {
        console.log(`[Simulator] Hub status sent: ${hubId}`);
      }
    });
  }

  /**
   * 연결 종료
   */
  disconnect() {
    // 모든 Telemetry 중지
    this.hubs.forEach((interval) => clearInterval(interval));
    this.hubs.clear();

    if (this.client) {
      this.client.end();
    }
  }
}

// CLI 실행
if (require.main === module) {
  const simulator = new MQTTSimulator(process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883');
  simulator.connect();

  // 예시: 허브 및 디바이스 시뮬레이션
  setTimeout(() => {
    const hubId = 'AA:BB:CC:DD:EE:01';
    const deviceId = 'AA:BB:CC:DD:EE:FF';

    // 허브 상태 전송
    simulator.sendHubStatus(hubId, 'online');

    // Telemetry 시작 (50Hz)
    simulator.startTelemetry(hubId, deviceId, 20);

    // 추가 디바이스들 (최대 6개)
    for (let i = 2; i <= 6; i++) {
      const devId = `AA:BB:CC:DD:EE:${i.toString(16).padStart(2, '0').toUpperCase()}`;
      simulator.startTelemetry(hubId, devId, 20);
    }
  }, 2000);

  // 종료 처리
  process.on('SIGINT', () => {
    console.log('\n[Simulator] Shutting down...');
    simulator.disconnect();
    process.exit(0);
  });
}

module.exports = MQTTSimulator;

