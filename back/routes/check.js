const express = require("express");
const router = express.Router();
const db = require("../models");
const mqttClient = require("../mqtt/client");
const csvWriter = require("../utils/csvWriter");

// Socket.IO 인스턴스를 가져오기 위한 함수
let ioInstance = null;
const setIOInstance = (io) => {
  ioInstance = io;
};
module.exports.setIOInstance = setIOInstance;

// 이미 구독된 허브 MAC 주소 추적 (MQTT 클라이언트가 처리하지만, 불필요한 콜백 등록 방지)
const subscribedHubs = new Set();

// 로깅 헬퍼 (production 모드에서 불필요한 로그 제거)
const log = (message, ...args) => {
  if (process.env.NODE_ENV !== "production" || process.env.DEBUG === "true") {
    console.log(message, ...args);
  }
};

/**
 * 허브 등록 확인 (허브에서 직접 호출)
 * POST /check/hub
 * body: { mac_address, user_email }
 * 인증 없이 허브에서 직접 호출하는 엔드포인트
 */
router.post("/hub", async (req, res) => {
  try {
    const { mac_address, user_email } = req.body;

    log(`[Hub Check] mac_address: ${mac_address}, user_email: ${user_email}`);
    
    // 필수 필드 검증
    if (!mac_address || !user_email) {
      return res.status(400).json({
        success: false,
        message: "mac_address와 user_email은 필수입니다.",
      });
    }

    // MAC 주소 형식 검증
    const macPattern = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
    if (!macPattern.test(mac_address)) {
      return res.status(400).json({
        success: false,
        message: "올바른 MAC 주소 형식이 아닙니다. (예: AA:BB:CC:DD:EE:01)",
      });
    }

    // 이메일 형식 검증
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(user_email)) {
      return res.status(400).json({
        success: false,
        message: "올바른 이메일 형식이 아닙니다.",
      });
    }

    // 병렬 처리: 사용자 확인과 허브 조회를 동시에 수행
    let user, hub;
    try {
      [user, hub] = await Promise.all([
        db.User.findByPk(user_email, { attributes: ["email"] }),
        db.Hub.findByPk(mac_address, {
          attributes: ["address", "user_email", "name", "is_change"],
        }),
      ]);
    } catch (error) {
      // 데이터베이스 테이블이 없는 경우
      if (error.name === 'SequelizeDatabaseError' && error.parent?.code === 'ER_NO_SUCH_TABLE') {
        console.error(`[Hub Check] Database table not found: ${error.parent?.sqlMessage}`);
        return res.status(500).json({
          success: false,
          message: "데이터베이스 테이블이 존재하지 않습니다. 데이터베이스를 초기화해주세요.",
        });
      }
      throw error;
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "등록되지 않은 사용자입니다.",
      });
    }

    // 허브 업데이트 또는 생성
    if (hub) {
      // 이미 등록된 허브인 경우 업데이트 (변경된 경우에만)
      if (hub.user_email !== user_email) {
        hub.user_email = user_email;
        await hub.save();
        log(`[Hub Check] ✅ Hub ${mac_address} updated for user ${user_email}`);
      }
      // 마지막 활동 시간 업데이트 (온라인 상태 표시용)
      await hub.update({ updatedAt: new Date() });
    } else {
      await db.Hub.create({
        address: mac_address,
        name: `허브 ${mac_address}`,
        user_email: user_email,
        is_change: false,
      });
      log(
        `[Hub Check] ✅ New hub ${mac_address} registered for user ${user_email}`
      );
    }

    // MQTT 토픽 구독 (이미 구독된 경우 스킵)
    const sendTopic = `hub/${mac_address}/send`;
    const receiveTopic = `hub/${mac_address}/receive`;

    if (!subscribedHubs.has(mac_address)) {
      // send 토픽 구독 (허브 → 백엔드로 이벤트 전달)
      mqttClient.subscribe(
        sendTopic,
        async (message, topic) => {
        log(`[Hub Check] 📥 Message received from ${topic}`);
        try {
            const messageStr = Buffer.isBuffer(message)
              ? message.toString("utf8")
              : typeof message === "string"
              ? message
              : JSON.stringify(message);
            
            // device:["mac_address"] 형식 처리
            let data;
            if (messageStr.includes('device:[')) {
              // device:["mac1", "mac2"] 형식 파싱
              try {
                const deviceMatch = messageStr.match(/device:\s*\[(.*?)\]/);
                if (deviceMatch) {
                  const deviceListStr = deviceMatch[1];
                  // 따옴표로 둘러싸인 MAC 주소 추출
                  const macAddresses = deviceListStr.match(/"([^"]+)"/g)?.map(m => m.replace(/"/g, '')) || [];
                  data = {
                    connected_devices: macAddresses
                  };
                  log(`[Hub Check] Parsed device list:`, macAddresses);
                } else {
                  // JSON 파싱 시도
                  data = JSON.parse(messageStr);
                }
              } catch (e) {
                log(`[Hub Check] Failed to parse device list, trying JSON:`, e.message);
                data = JSON.parse(messageStr);
              }
            } else {
              // 일반 JSON 파싱
              data = JSON.parse(messageStr);
            }
          log(`[Hub Check] Send topic data:`, JSON.stringify(data, null, 2));

            // 허브에서 측정 데이터를 보내온 경우 (device_mac_address, sampling_rate, data 등 포함)
            if (data && data.device_mac_address && Array.isArray(data.data)) {
              // 디바이스 MAC 주소로 펫 정보와 user_email 조회
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

                // 디바이스의 user_email이 허브의 user_email과 일치하는지 확인
                if (device && device.Hub && device.Hub.user_email !== device.user_email) {
                  log(`[Hub Check] Device user_email mismatch: device.user_email=${device.user_email}, hub.user_email=${device.Hub.user_email}`);
                  // 디바이스의 user_email을 허브의 user_email로 업데이트
                  device.user_email = device.Hub.user_email;
                  await device.save();
                }

                // CSV 저장은 디바이스가 허브에 연결되어 있고 펫이 연결된 경우에만
                if (device && device.Hub && device.Hub.user_email) {
                  const userEmail = device.Hub.user_email;
                  const petName = device.Pet?.name || 'Unknown';
                  
                  // 펫이 연결된 경우에만 CSV 저장
                  if (device.Pet) {
                    // CSV 세션이 없으면 시작
                    if (!csvWriter.hasActiveSession(data.device_mac_address)) {
                      const startTime = data.start_time || '000000000';
                      const samplingRate = data.sampling_rate || 50;
                      csvWriter.startSession(data.device_mac_address, userEmail, petName, startTime, samplingRate);
                      log(`[Hub Check] Started CSV session for ${data.device_mac_address}`);
                    }
                    
                    // CSV에 데이터 저장
                    await csvWriter.writeBatch(data);
                  }
                }

                // 실시간 모니터링을 위한 Telemetry 데이터는 항상 전송 (디바이스가 DB에 없어도)
                if (ioInstance) {
                  // 배터리 캐시 (전역 변수로 관리)
                  if (!global.batteryCache) {
                    global.batteryCache = new Map();
                  }
                  
                  // 배터리 값 처리: 0이 아닐 때만 캐시 업데이트
                  const currentBattery = data.battery || 0;
                  let batteryToUse = currentBattery;
                  
                  if (currentBattery === 0) {
                    // 0이면 캐시된 값 사용
                    if (global.batteryCache.has(data.device_mac_address)) {
                      batteryToUse = global.batteryCache.get(data.device_mac_address);
                      log(`[Hub Check] Using cached battery value for ${data.device_mac_address}: ${batteryToUse}%`);
                    }
                  } else {
                    // 0이 아니면 캐시 업데이트
                    global.batteryCache.set(data.device_mac_address, currentBattery);
                    log(`[Hub Check] Updated battery cache for ${data.device_mac_address}: ${currentBattery}%`);
                  }

                  // 온도 캐시 (전역 변수로 관리)
                  if (!global.temperatureCache) {
                    global.temperatureCache = new Map();
                  }
                  
                  // 온도 값 처리: 0이 아닐 때만 캐시 업데이트
                  const currentTemp = data.temp || 0;
                  let tempToUse = currentTemp;
                  
                  if (currentTemp === 0) {
                    // 0이면 캐시된 값 사용
                    if (global.temperatureCache.has(data.device_mac_address)) {
                      tempToUse = global.temperatureCache.get(data.device_mac_address);
                      log(`[Hub Check] Using cached temperature value for ${data.device_mac_address}: ${tempToUse}°C`);
                    }
                  } else {
                    // 0이 아니면 캐시 업데이트
                    global.temperatureCache.set(data.device_mac_address, currentTemp);
                    log(`[Hub Check] Updated temperature cache for ${data.device_mac_address}: ${currentTemp}°C`);
                  }

                  // start_time을 밀리초로 변환 (HHmmssSSS 형식)
                  const parseStartTime = (startTimeStr) => {
                    if (!startTimeStr || startTimeStr.length < 9) return Date.now();
                    try {
                      const hours = parseInt(startTimeStr.substring(0, 2));
                      const minutes = parseInt(startTimeStr.substring(2, 4));
                      const seconds = parseInt(startTimeStr.substring(4, 6));
                      const milliseconds = parseInt(startTimeStr.substring(6, 9));
                      const today = new Date();
                      today.setHours(hours, minutes, seconds, milliseconds);
                      return today.getTime();
        } catch (e) {
                      return Date.now();
                    }
                  };

                  const startTimeMs = parseStartTime(data.start_time);
                  const samplingRate = data.sampling_rate || 50;
                  const intervalMs = (1 / samplingRate) * 250; // 250 샘플당 간격 (ms)

                  // data 배열의 각 샘플에 대해 시간 계산
                  const dataArr = data.data.map((dataStr, index) => {
                    const sampleTime = startTimeMs + (index * intervalMs);
                    return {
                      hr: data.hr || 0,
                      spo2: data.spo2 || 0,
                      temp: tempToUse, // 캐시된 온도 값 사용
                      battery: batteryToUse, // 캐시된 배터리 값 사용
                      timestamp: sampleTime,
                      index: index
                    };
                  });

                  const telemetryPayload = {
                    type: 'sensor_data',
                    hubId: mac_address,
                    deviceId: data.device_mac_address,
                    data: {
                      hr: data.hr || 0,
                      spo2: data.spo2 || 0,
                      temp: tempToUse, // 캐시된 온도 값 사용
                      battery: batteryToUse, // 캐시된 배터리 값 사용
                      start_time: data.start_time,
                      sampling_rate: samplingRate,
                      dataArr: dataArr,
                      timestamp: Date.now()
                    },
                    timestamp: new Date().toISOString()
                  };

                  ioInstance.emit('TELEMETRY', telemetryPayload);
                  log(`[Hub Check] ✅ Emitted TELEMETRY for device ${data.device_mac_address} (battery: ${batteryToUse}%)`);
                }
              } catch (error) {
                console.error(`[Hub Check] Error processing telemetry data:`, error);
              }
            }

              // 허브에서 연결된 디바이스 목록을 보내온 경우
            if (data && Array.isArray(data.connected_devices) && ioInstance) {
              // ✅ 디바이스 등록/업데이트 (DB에 없으면 생성)
              data.connected_devices.forEach(async (deviceMac) => {
                try {
                  // 허브의 user_email 조회
                  const hub = await db.Hub.findOne({
                    where: { address: mac_address },
                    attributes: ['user_email']
                  });

                  if (!hub) {
                    log(`[Hub Check] Hub not found: ${mac_address}`);
                    return;
                  }

                  const existing = await db.Device.findByPk(deviceMac);
                  if (existing) {
                    // 기존 디바이스가 있으면 소유자/허브 주소/활동 시간 업데이트
                    const next = { hub_address: mac_address, user_email: hub.user_email };
                    if (existing.hub_address !== next.hub_address || existing.user_email !== next.user_email) {
                      await existing.update(next);
                    }
                    await existing.update({ updatedAt: new Date() });
                  } else {
                    // DB에 없으면 생성
                    await db.Device.create({
                      address: deviceMac,
                      name: `디바이스 ${deviceMac}`,
                      hub_address: mac_address,
                      user_email: hub.user_email,
                    });
                    log(`[Hub Check] ✅ Device registered: ${deviceMac} (hub=${mac_address})`);
                  }
                } catch (error) {
                  console.error(`[Hub Check] Error updating device ${deviceMac}:`, error);
                }
              });
              
              // Socket.IO로 프론트엔드에 전송
              ioInstance.emit("CONNECTED_DEVICES", {
                hubAddress: mac_address,
                connected_devices: data.connected_devices,
                timestamp: new Date().toISOString(),
              });
            }
          } catch (e) {
            log(
              `[Hub Check] Send topic raw message:`,
              Buffer.isBuffer(message) ? message.toString("utf8") : message
            );
        }
        },
        1
      );

      // receive 토픽 구독
      mqttClient.subscribe(
        receiveTopic,
        (message, topic) => {
        log(`[Hub Check] 📥 Message received from ${topic}`);
        try {
            const messageStr = Buffer.isBuffer(message)
              ? message.toString("utf8")
              : typeof message === "string"
              ? message
              : JSON.stringify(message);
          const data = JSON.parse(messageStr);
            log(
              `[Hub Check] Receive topic data:`,
              JSON.stringify(data, null, 2)
            );
        } catch (e) {
            log(
              `[Hub Check] Receive topic raw message:`,
              Buffer.isBuffer(message) ? message.toString("utf8") : message
            );
        }
        },
        1
      );

      subscribedHubs.add(mac_address);
      log(
        `[Hub Check] ✅ Subscribed to MQTT topics: ${sendTopic}, ${receiveTopic}`
      );
    }

    // Socket.IO를 통해 허브 활성화 이벤트 전송
    if (ioInstance) {
      ioInstance.emit("HUB_ACTIVITY", {
        hubAddress: mac_address,
        userEmail: user_email,
        status: "online",
        timestamp: new Date().toISOString(),
        message: "허브가 활성화되었습니다.",
      });
    }

    const lastConnectDeviceList = await db.Device.findAll({
      where: { hub_address: mac_address },
      attributes: ["address"],
    });

    const addresses = lastConnectDeviceList.map((device) => device.address);

    const message =
      addresses.length > 0
        ? `mqtt server ready:${addresses.join(", ")}`
        : "mqtt server ready";

    res.status(200).send(message);
  } catch (error) {
    console.error("[Hub Check] Error:", error);
    res.status(500).send("mqtt server fail");
  }
});

module.exports = router;
module.exports.setIOInstance = setIOInstance;
