const fs = require('fs');
const path = require('path');
const mqttClient = require('./client');
const { createError, ERROR_REASON } = require('../core/error/errorFactory');
const { logError } = require('../core/error/errorLogger');
const presenceStore = require('../core/presenceStore');

const MQTT_PAYLOAD_MAX_BYTES = 1024 * 1024; // 1MB

/**
 * MQTT 서비스 클래스
 * 허브(ESP32-S3)와의 양방향 통신을 위한 고수준 API 제공
 * 문서 요구사항에 맞춘 토픽 구조 사용:
 * - hub/{hubId}/command/{deviceId} - 명령
 * - hub/{hubId}/response/{deviceId} - 응답
 * - hub/{hubId}/telemetry/{deviceId} - 측정값
 * - hub/{hubId}/status - 허브 상태
 */
const ADMIN_SNAPSHOT_THROTTLE_MS = 1500; // 어드민 연결 상태 스냅샷 최소 간격 (사용자 명령 처리 부담 완화)

class MQTTService {
  constructor(io = null, telemetryQueue = null, app = null) {
    this.io = io; // Socket.IO 인스턴스
    this.telemetryQueue = telemetryQueue; // Telemetry 데이터 큐
    this.app = app; // Express app (admin 연결 상태 스냅샷 전송용)
    this.pendingCommands = new Map(); // requestId 기반 명령 대기 목록
    this.hubCallbacks = new Map(); // 허브별 콜백 저장
    this.batteryCache = new Map(); // 디바이스별 마지막 배터리 값 저장
    this.temperatureCache = new Map(); // 디바이스별 마지막 온도 값 저장
    this.hubTopicMode = new Map(); // hubId -> 'prod' | 'test' (test/hub 토픽을 쓰는지 추적)
    this._lastAdminSnapshotAt = 0; // 어드민 스냅샷 스로틀용
  }

  /**
   * MQTT 클라이언트 초기화 및 기본 구독 설정
   */
  initialize() {
    // MQTT 클라이언트 연결
    mqttClient.connect();
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

    // hub/+/send 토픽 구독: mqtt ready 메시지 처리
    mqttClient.subscribe('hub/+/send', (message, topic) => {
      this.handleHubSendMessage(message, topic);
    }, 1); // QoS 1

    // ✅ 테스트 허브 토픽 구독: test/hub/{hubId}/send
    // - 포맷: device_mac_address-sampling_rate, hr, spo2, temp, battery
    // - 예: "ec:81:f7:f3:54:6f-50, 78, 97, 36.5, 88"
    mqttClient.subscribe('test/hub/+/send', (message, topic) => {
      this.handleTestHubSendMessage(message, topic);
    }, 1);

    // 테스트 토픽 구독: test/# (ESP32 통신 테스트용)
    mqttClient.subscribe('test/#', (message, topic) => {
      console.log(`[MQTT Service] 📥 Test topic subscription triggered: ${topic}`);
      this.handleTestMessage(message, topic);
    }, 1); // QoS 1
    console.log(`[MQTT Service] ✅ Subscribed to test/# for ESP32 communication testing`);

    // 모든 허브 메시지 구독 (디버깅용, 개발 모드에서만)
    // 명령 토픽(/command/)과 receive 토픽은 제외 - 자신이 발행한 메시지를 받지 않도록
    if (process.env.NODE_ENV === 'development') {
      mqttClient.subscribe('hub/#', (message, topic) => {
        // 명령 토픽은 제외 (자신이 발행한 메시지)
        if (topic.includes('/command/')) {
          return; // 명령 토픽은 무시
        }
        // receive 토픽도 제외 (백엔드가 허브에 명령을 보내는 토픽)
        if (topic.includes('/receive')) {
          return; // receive 토픽은 무시
        }
        // 이미 처리된 토픽은 로그만 남기고 중복 처리 방지
        if (!topic.includes('/status') && !topic.includes('/telemetry') && !topic.includes('/response') && !topic.includes('/send')) {
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

    presenceStore.updateHubSeen(hubId);

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
   * Hub Send 메시지 처리 (mqtt ready, 측정 데이터 등)
   * 토픽: hub/{hubId}/send
   * - state:hub 응답 시 payload에 device:[] 또는 device:["mac",...]
   *   - device:[] → 허브 살아 있음(응답함), 연결된 디바이스 없음
   *   - device:["aa:bb:cc:...", ...] → 배열 값은 연결된 디바이스의 MAC 주소
   * @param {Object|string} message - 수신된 메시지
   * @param {string} topic - 메시지가 수신된 토픽 (예: hub/80:b5:4e:db:44:9a/send)
   */
  async handleHubSendMessage(message, topic) {
    const parts = topic.split('/');
    const hubId = parts[1]; // hub/80:b5:4e:db:44:9a/send에서 허브 ID 추출
    this.setHubTopicMode(hubId, 'prod');
    presenceStore.updateHubSeen(hubId);
    
    let messageStr;
    try {
      // Buffer를 문자열로 변환
      messageStr = Buffer.isBuffer(message) ? message.toString('utf8') : 
                  typeof message === 'string' ? message : JSON.stringify(message);
    } catch (e) {
      console.error(`[MQTT Service] Failed to parse hub send message from ${topic}:`, e);
      return;
    }

    if (messageStr.length > MQTT_PAYLOAD_MAX_BYTES) {
      const err = createError('mqtt', ERROR_REASON.PAYLOAD_TOO_LARGE, 'MQTT payload too large', `size=${messageStr.length}`, {
        payloadSize: messageStr.length,
        topic,
      });
      logError(err);
      return;
    }

    console.log(`[MQTT Service] 📨 Hub send message from ${topic}: ${messageStr}`);
    console.log(`[MQTT Service] 📨 Raw message details:`, {
      topic,
      hubId,
      messageLength: messageStr.length,
      messagePreview: messageStr.slice(0, 200),
      timestamp: new Date().toISOString(),
    });

    // ✅ 수신 데이터를 backend/data/json 에 그대로 저장
    try {
      const jsonDir = process.env.MQTT_JSON_OUTPUT_DIR
        ? path.resolve(process.cwd(), process.env.MQTT_JSON_OUTPUT_DIR)
        : path.join(process.cwd(), 'data', 'json');
      const safeHubId = hubId.replace(/:/g, '_');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${safeHubId}_${timestamp}.json`;
      const filePath = path.join(jsonDir, filename);
      fs.mkdirSync(jsonDir, { recursive: true });
      fs.writeFileSync(filePath, messageStr, 'utf8');
    } catch (e) {
      console.error(`[MQTT Service] JSON 저장 실패:`, e.message);
    }

    // ✅ state:hub 응답 형식: device:[] 또는 device:["mac",...] — JSON이 아니므로 반드시 JSON 파싱 전에 처리
    if (messageStr.includes('device:[')) {
      try {
        const deviceMatch = messageStr.match(/device:\s*\[(.*?)\]/);
        if (deviceMatch) {
          const listStr = deviceMatch[1];
          const macList =
            listStr.match(/"([^"]+)"/g)?.map((m) => m.replace(/"/g, '')) || [];

          if (macList.length === 0) {
            console.log(`[MQTT Service] ✅ Hub ${hubId} alive (device:[] — no devices connected)`);
          } else {
            console.log(
              `[MQTT Service] 🔗 Parsed connected device list from hub ${hubId}:`,
              macList,
            );
          }

          presenceStore.setHubConnectedDevices(hubId, macList);

          try {
            const db = require('../models');
            const hub = await db.Hub.findByPk(hubId, { attributes: ['address', 'user_email'] });
            if (hub && Array.isArray(macList) && macList.length > 0) {
              for (const deviceMac of macList) {
                try {
                  const existing = await db.Device.findByPk(deviceMac);
                  if (existing) {
                    const next = { hub_address: hub.address, user_email: hub.user_email };
                    if (existing.hub_address !== next.hub_address || existing.user_email !== next.user_email) {
                      await existing.update(next);
                    }
                    await existing.update({ updatedAt: new Date() });
                  } else {
                    await db.Device.create({
                      address: deviceMac,
                      name: `디바이스 ${deviceMac}`,
                      hub_address: hub.address,
                      user_email: hub.user_email,
                    });
                  }
                } catch (e) {
                  console.error(`[MQTT Service] Error upserting device ${deviceMac}:`, e.message);
                }
              }
            }
          } catch (e) {
            console.error(`[MQTT Service] Error syncing connected devices to DB for hub ${hubId}:`, e.message);
          }

          if (this.io && macList.length > 0) {
            try {
              const db = require('../models');
              const hub = await db.Hub.findByPk(hubId);
              if (hub && hub.user_email) {
                this.io.to(`user:${hub.user_email}`).emit('CONNECTED_DEVICES', {
                  hubAddress: hubId,
                  connected_devices: macList,
                  timestamp: new Date().toISOString(),
                });
                console.log(
                  `[MQTT Service] ✅ CONNECTED_DEVICES emitted for hub ${hubId} to user ${hub.user_email}`,
                );
              } else {
                this.io.emit('CONNECTED_DEVICES', {
                  hubAddress: hubId,
                  connected_devices: macList,
                  timestamp: new Date().toISOString(),
                });
                console.log(`[MQTT Service] ⚠️ CONNECTED_DEVICES broadcasted (hub not found) for hub ${hubId}`);
              }
            } catch (error) {
              console.error(`[MQTT Service] ❌ Error emitting CONNECTED_DEVICES for hub ${hubId}:`, error);
              this.io.emit('CONNECTED_DEVICES', {
                hubAddress: hubId,
                connected_devices: macList,
                timestamp: new Date().toISOString(),
              });
            }
            if (this.app && this.io) {
              const now = Date.now();
              if (now - this._lastAdminSnapshotAt >= ADMIN_SNAPSHOT_THROTTLE_MS) {
                this._lastAdminSnapshotAt = now;
                const { getConnectionStatusData } = require('../admin/adminConnectionController');
                getConnectionStatusData(this.app)
                  .then((data) => {
                    if (this.io) this.io.to('admin/connection-status').emit('admin-connection-status', data);
                  })
                  .catch((err) => console.error('[MQTT Service] admin-connection-status snapshot error:', err));
              }
            }
          }
        } else {
          console.warn(`[MQTT Service] ⚠️ device:[...] pattern found but no list parsed: ${messageStr}`);
        }
      } catch (e) {
        console.error(`[MQTT Service] ❌ Failed to parse device list from hub ${hubId}:`, e.message);
      }
      return;
    }

    // ✅ 문자열 형식 텔레메트리 처리 (device_mac_address-sampling_rate, hr, spo2, temp, battery)
    // 예: "d4:d5:3f:28:e1:f4-50.11,81,90,34.06,8" 또는 "d4:d5:3f:28:e1:f4-50.45,80,95,28.65,7"
    const parsedString = this.parseTestTelemetryLine(messageStr);
    if (parsedString) {
      console.log(`[MQTT Service] 📊 String format telemetry detected from hub ${hubId}, device ${parsedString.device_mac_address}`);
      
      const deviceMac = parsedString.device_mac_address;
      const samplingRate = parsedString.sampling_rate || 50;
      presenceStore.updateDeviceSeen(hubId, deviceMac);

      // 배터리/온도 캐시 정책 적용
      const currentBattery = parsedString.battery || 0;
      let batteryToUse = currentBattery;
      if (currentBattery === 0) {
        if (this.batteryCache.has(deviceMac)) {
          batteryToUse = this.batteryCache.get(deviceMac);
        }
      } else {
        this.batteryCache.set(deviceMac, currentBattery);
      }

      const currentTemp = parsedString.temp || 0;
      let tempToUse = currentTemp;
      if (currentTemp === 0) {
        if (this.temperatureCache.has(deviceMac)) {
          tempToUse = this.temperatureCache.get(deviceMac);
        }
      } else {
        this.temperatureCache.set(deviceMac, currentTemp);
      }

      // ✅ TelemetryWorker 큐에 추가 (CSV 저장을 위해)
      const telemetryData = {
        device_mac_address: deviceMac,
        sampling_rate: samplingRate,
        hr: parsedString.hr || 0,
        spo2: parsedString.spo2 || 0,
        temp: tempToUse,
        battery: batteryToUse,
        // 단일 샘플 형식: data 배열에 하나의 샘플만 포함
        data: [`0,0,0`], // ir, red, green은 없으므로 0으로 채움
        dataArr: [{
          ir: null,
          red: null,
          green: null,
          hr: parsedString.hr || 0,
          spo2: parsedString.spo2 || 0,
          temp: tempToUse,
          battery: batteryToUse,
        }],
        timestamp: Date.now(),
        start_time: new Date().toISOString().split('T')[1].replace(/\.\d{3}Z$/, '').replace(/:/g, '').slice(0, 9), // HHmmssSSS 형식
      };

      // 큐에 추가 (Worker가 CSV 저장 및 처리)
      const deviceIdNorm = (deviceMac || '').trim().toLowerCase();
      if (this.telemetryQueue) {
        this.telemetryQueue.push({
          hubId,
          deviceId: deviceIdNorm,
          data: telemetryData,
          timestamp: new Date(),
          topic,
          receiveStartTime: Date.now(),
        });
        console.log(`[MQTT Service] ✅ String format telemetry queued for CSV save`, {
          hubId,
          deviceId: deviceMac,
          hr: parsedString.hr,
          spo2: parsedString.spo2,
          temp: tempToUse,
          battery: batteryToUse,
        });
      }

      // ✅ Socket.IO로 즉시 전송하지 않고 TelemetryWorker 큐로만 처리
      // (중복 전송 방지 및 서버 부하 감소)
      console.log(`[MQTT Service] ✅ String format telemetry queued for TelemetryWorker processing`, {
        hubId,
        deviceId: deviceMac,
        hr: parsedString.hr,
        spo2: parsedString.spo2,
        temp: tempToUse,
        battery: batteryToUse,
      });
      return; // 문자열 형식 처리 완료 (TelemetryWorker가 Socket.IO로 전송)
    }

    // JSON 형식의 측정 데이터 처리 (기존 방식)
    try {
      const data = JSON.parse(messageStr);
      
      // 측정 데이터인지 확인 (device_mac_address와 data 배열이 있으면 측정 데이터)
      if (data.device_mac_address && Array.isArray(data.data)) {
        presenceStore.updateDeviceSeen(hubId, data.device_mac_address);
        console.log(`[MQTT Service] 📊 Measurement data detected from hub ${hubId}, device ${data.device_mac_address}`);
        
        // TelemetryWorker 큐에 추가 (Socket.IO 전송용) — 디바이스/CSV 결과와 무관하게 항상 푸시
        const receiveStartTime = Date.now();
        const deviceIdNorm = (data.device_mac_address || '').trim().toLowerCase();
        if (this.telemetryQueue) {
          this.telemetryQueue.push({
            hubId,
            deviceId: deviceIdNorm,
            data,
            timestamp: new Date(),
            topic,
            receiveStartTime,
            publishStartTime: receiveStartTime,
          });
          console.log(`[MQTT Service] ✅ JSON telemetry → queue (Socket.IO 전달용)`, {
            hubId,
            deviceId: data.device_mac_address,
            dataLength: data.data?.length || 0,
            queueLength: this.telemetryQueue.length,
          });
        }
        
        const db = require('../models');
        const csvWriter = require('../utils/csvWriter');
        
        try {
          const device = await db.Device.findOne({
            where: { address: data.device_mac_address },
            include: [{
              model: db.Hub,
              as: 'Hub',
              attributes: ['address', 'user_email']
            }, {
              model: db.Pet,
              as: 'Pet',
              attributes: ['id', 'name', 'user_email']
            }]
          });

          // CSV 저장은 디바이스가 허브에 연결되어 있고 펫이 연결된 경우에만
          if (device && device.user_email) {
            const userEmail = device.user_email;
            const petName = device.Pet?.name || 'Unknown';
            
            // 펫이 연결된 경우에만 CSV 저장
            if (device.Pet) {
              // CSV 세션이 없으면 시작
              if (!csvWriter.hasActiveSession(data.device_mac_address)) {
                const startTime = data.start_time || '000000000';
                const samplingRate = data.sampling_rate || 50;
                csvWriter.startSession(data.device_mac_address, userEmail, petName, startTime, samplingRate);
                console.log(`[MQTT Service] Started CSV session for ${data.device_mac_address}`);
              }
              
              // CSV에 데이터 저장
              await csvWriter.writeBatch(data);
            }
          }

            // (큐 푸시는 위에서 이미 수행됨)
        } catch (error) {
          console.error(`[MQTT Service] Error processing measurement data:`, error);
        }
        
        return; // 측정 데이터 처리 완료
      }
    } catch (e) {
      if (e instanceof SyntaxError) {
        const err = createError('mqtt', ERROR_REASON.JSON_PARSE_ERROR, 'JSON parsing failure', e.message, { topic });
        logError(err);
      }
    }

    // "message:80:b5:4e:db:44:9a mqtt ready" 형식 메시지 처리
    if (messageStr.includes('mqtt ready')) {
      console.log(`[MQTT Service] 🔍 MQTT Ready detected from hub ${hubId}`);
      
      // Socket.IO로 클라이언트에 전달
      if (this.io) {
        this.io.emit('MQTT_READY', {
          type: 'mqtt_ready',
          hubId,
          message: messageStr,
          timestamp: new Date().toISOString()
        });
        console.log(`[MQTT Service] ✅ MQTT_READY event emitted to clients`);
      }

      return;
    }

  }

  /**
   * test/hub/{hubId}/send 메시지 처리
   * - 데이터 형식: device_mac_address-sampling_rate, hr, spo2, temp, battery
   * - 또한 state:hub 응답(device:[...])이 이 토픽으로 올 수도 있으므로 같이 처리
   */
  async handleTestHubSendMessage(message, topic) {
    const parts = topic.split('/');
    // test/hub/{hubId}/send
    const hubId = parts[2];
    this.setHubTopicMode(hubId, 'test');
    presenceStore.updateHubSeen(hubId);

    let messageStr;
    try {
      messageStr = Buffer.isBuffer(message)
        ? message.toString('utf8')
        : typeof message === 'string'
          ? message
          : JSON.stringify(message);
    } catch (e) {
      console.error(`[MQTT Service] Failed to parse test hub send message from ${topic}:`, e);
      return;
    }

    const line = String(messageStr).trim();
    console.log(`[MQTT Service] 🧪 Hub(test) send message from ${topic}: ${line}`);

    // 1) state:hub/connected devices 포맷도 허용
    if (line.includes('device:[')) {
      // 기존 핸들러 로직을 재사용하기 위해 토픽만 hub/{hubId}/send 형태로 변환해서 처리
      await this.handleHubSendMessage(line, `hub/${hubId}/send`);
      return;
    }

    // 2) 요청된 테스트 텔레메트리 포맷 파싱
    const parsed = this.parseTestTelemetryLine(line);
    if (!parsed) {
      console.warn(`[MQTT Service] 🧪 Unrecognized test telemetry format from ${topic}: ${line}`);
      return;
    }

    const deviceMac = parsed.device_mac_address;
    const samplingRate = parsed.sampling_rate || 50;
    presenceStore.updateDeviceSeen(hubId, deviceMac);

    // 배터리/온도 캐시 정책 동일 적용 (0이면 캐시 사용)
    const currentBattery = parsed.battery || 0;
    let batteryToUse = currentBattery;
    if (currentBattery === 0) {
      if (this.batteryCache.has(deviceMac)) {
        batteryToUse = this.batteryCache.get(deviceMac);
      }
    } else {
      this.batteryCache.set(deviceMac, currentBattery);
    }

    const currentTemp = parsed.temp || 0;
    let tempToUse = currentTemp;
    if (currentTemp === 0) {
      if (this.temperatureCache.has(deviceMac)) {
        tempToUse = this.temperatureCache.get(deviceMac);
      }
    } else {
      this.temperatureCache.set(deviceMac, currentTemp);
    }

    // ✅ TelemetryWorker 큐에 추가 (CSV 저장을 위해)
    const telemetryData = {
      device_mac_address: deviceMac,
      sampling_rate: samplingRate,
      hr: parsed.hr || 0,
      spo2: parsed.spo2 || 0,
      temp: tempToUse,
      battery: batteryToUse,
      // 단일 샘플 형식: data 배열에 하나의 샘플만 포함
      data: [`0,0,0`], // ir, red, green은 없으므로 0으로 채움
      dataArr: [{
        ir: null,
        red: null,
        green: null,
        hr: parsed.hr || 0,
        spo2: parsed.spo2 || 0,
        temp: tempToUse,
        battery: batteryToUse,
      }],
      timestamp: Date.now(),
      start_time: new Date().toISOString().split('T')[1].replace(/\.\d{3}Z$/, '').replace(/:/g, '').slice(0, 9), // HHmmssSSS 형식
    };

    // 큐에 추가 (Worker가 CSV 저장 및 처리)
    const deviceIdNormTest = (deviceMac || '').trim().toLowerCase();
    if (this.telemetryQueue) {
      this.telemetryQueue.push({
        hubId,
        deviceId: deviceIdNormTest,
        data: telemetryData,
        timestamp: new Date(),
        topic,
        receiveStartTime: Date.now(),
      });
      console.log(`[MQTT Service] ✅ Test format telemetry queued for CSV save`, {
        hubId,
        deviceId: deviceMac,
        hr: parsed.hr,
        spo2: parsed.spo2,
        temp: tempToUse,
        battery: batteryToUse,
      });
    }

    // ✅ Socket.IO로 즉시 전송하지 않고 TelemetryWorker 큐로만 처리
    // (중복 전송 방지 및 서버 부하 감소)
    console.log(`[MQTT Service] ✅ Test format telemetry queued for TelemetryWorker processing`, {
      hubId,
      deviceId: deviceMac,
      hr: parsed.hr,
      spo2: parsed.spo2,
      temp: tempToUse,
      battery: batteryToUse,
    });
  }

  /**
   * test/hub 토픽 텔레메트리 문자열 파싱
   * 형식: device_mac_address-sampling_rate, hr, spo2, temp, battery
   */
  parseTestTelemetryLine(line) {
    if (!line || typeof line !== 'string') return null;
    const parts = line.split(',').map(p => p.trim()).filter(Boolean);
    if (parts.length < 5) return null;

    const head = parts[0];
    const dashIdx = head.lastIndexOf('-');
    if (dashIdx <= 0) return null;

    const device_mac_address = head.substring(0, dashIdx).trim();
    const sampling_rate = Number(head.substring(dashIdx + 1).trim());
    if (!device_mac_address) return null;

    const hr = Number(parts[1]);
    const spo2 = Number(parts[2]);
    const temp = Number(parts[3]);
    const battery = Number(parts[4]);

    return {
      device_mac_address,
      sampling_rate: Number.isFinite(sampling_rate) ? sampling_rate : 50,
      hr: Number.isFinite(hr) ? hr : 0,
      spo2: Number.isFinite(spo2) ? spo2 : 0,
      temp: Number.isFinite(temp) ? temp : 0,
      battery: Number.isFinite(battery) ? battery : 0,
    };
  }

  setHubTopicMode(hubId, mode) {
    if (!hubId) return;
    const prev = this.hubTopicMode.get(hubId);
    if (prev !== mode) {
      this.hubTopicMode.set(hubId, mode);
      console.log(`[MQTT Service] 🔁 Hub topic mode set: hub=${hubId} mode=${mode}`);
    }
  }

  /**
   * 현재 허브의 토픽 모드에 맞는 receive 토픽 반환
   * - prod: hub/{hubId}/receive
   * - test: test/hub/{hubId}/receive
   */
  getHubReceiveTopic(hubId) {
    const mode = this.hubTopicMode.get(hubId) || 'prod';
    return mode === 'test' ? `test/hub/${hubId}/receive` : `hub/${hubId}/receive`;
  }

  /**
   * Telemetry 데이터 메시지 처리 (대량 데이터)
   * @param {Object|string} message - 수신된 메시지
   * @param {string} topic - 메시지가 수신된 토픽
   */
  async handleTelemetry(message, topic) {
    const receiveStartTime = Date.now(); // 성능 측정 시작 (MQTT 수신 시간)
    const { hubId, deviceId } = this.extractHubDeviceId(topic);
    this.setHubTopicMode(hubId, 'prod');
    
    presenceStore.updateHubSeen(hubId);
    presenceStore.updateDeviceSeen(hubId, deviceId);

    // 허브와 디바이스의 마지막 활동 시간 업데이트 (온라인 상태 표시용)
    try {
      const db = require('../models');

      // 허브 마지막 활동 시간 업데이트
      const hub = await db.Hub.findByPk(hubId);
      if (hub) {
        await hub.update({ updatedAt: new Date() });
      }

      // 디바이스 마지막 활동 시간 업데이트
      const device = await db.Device.findByPk(deviceId);
      if (device) {
        await device.update({ updatedAt: new Date() });
      }
    } catch (error) {
      console.error(`[MQTT Service] Error updating last seen for hub ${hubId} device ${deviceId}:`, error);
    }
    
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
    const deviceIdNormTelemetry = (deviceId || '').trim().toLowerCase();
    if (this.telemetryQueue) {
      this.telemetryQueue.push({
        hubId,
        deviceId: deviceIdNormTelemetry,
        data: telemetryData,
        timestamp: new Date(),
        topic,
        receiveStartTime, // 성능 측정용 (MQTT 수신 시간)
        publishStartTime: telemetryData.publishStartTime || null // mqtt-monitor에서 발행한 시간
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
    this.setHubTopicMode(hubId, 'prod');
    
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

    presenceStore.updateHubSeen(hubId);
    presenceStore.updateDeviceSeen(hubId, deviceId);

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
   * 테스트 메시지 처리
   * @param {Object|string} message - 수신된 메시지
   * @param {string} topic - 메시지가 수신된 토픽
   */
  handleTestMessage(message, topic) {
    console.log(`\n[MQTT Service] 🧪 ===== Test Message Received =====`);
    console.log(`  Topic: ${topic}`);
    console.log(`  Message type: ${typeof message}, isBuffer: ${Buffer.isBuffer(message)}`);
    
    let testData;
    try {
      const messageStr = Buffer.isBuffer(message) ? message.toString('utf8') : 
                        typeof message === 'string' ? message : JSON.stringify(message);
      console.log(`  Raw message length: ${messageStr.length} bytes`);
      console.log(`  Raw message preview: ${messageStr.substring(0, 200)}${messageStr.length > 200 ? '...' : ''}`);
      
      testData = JSON.parse(messageStr);
      console.log(`  ✅ Parsed as JSON successfully`);
    } catch (e) {
      console.log(`  ⚠️  JSON parse failed, using raw message: ${e.message}`);
      testData = { message: Buffer.isBuffer(message) ? message.toString('utf8') : message };
    }

    console.log(`[MQTT Service] 🧪 Test message data:`, JSON.stringify(testData, null, 2));
    console.log(`[MQTT Service] 🧪 ====================================\n`);

    // 응답이 필요한 경우 (requestId가 있고 needResponse가 true인 경우)
    if (testData.requestId && testData.needResponse) {
      const responseTopic = testData.responseTopic || topic.replace('/request', '/response');
      const response = {
        requestId: testData.requestId,
        success: true,
        message: 'Test response from backend',
        originalMessage: testData,
        timestamp: new Date().toISOString()
      };

      console.log(`[MQTT Service] 🧪 Sending test response to ${responseTopic}`);
      mqttClient.publish(responseTopic, response, { qos: 1 });
    }

    // Socket.IO로 프론트엔드에 전달
    if (this.io) {
      this.io.emit('TEST_MESSAGE', {
        topic,
        data: testData,
        timestamp: new Date().toISOString()
      });
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
