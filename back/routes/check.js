const express = require('express');
const router = express.Router();
const db = require('../models');
const mqttClient = require('../mqtt/client');

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
  if (process.env.NODE_ENV !== 'production' || process.env.DEBUG === 'true') {
    console.log(message, ...args);
  }
};

/**
 * 허브 등록 확인 (허브에서 직접 호출)
 * POST /check/hub
 * body: { mac_address, user_email }
 * 인증 없이 허브에서 직접 호출하는 엔드포인트
 */
router.post('/hub', async (req, res) => {
  try {
    const { mac_address, user_email } = req.body;

    log(`[Hub Check] mac_address: ${mac_address}, user_email: ${user_email}`);
    
    // 필수 필드 검증
    if (!mac_address || !user_email) {
      return res.status(400).json({
        success: false,
        message: 'mac_address와 user_email은 필수입니다.'
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

    // 이메일 형식 검증
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(user_email)) {
      return res.status(400).json({
        success: false,
        message: '올바른 이메일 형식이 아닙니다.'
      });
    }

    // 병렬 처리: 사용자 확인과 허브 조회를 동시에 수행
    const [user, hub] = await Promise.all([
      db.User.findByPk(user_email, { attributes: ['email'] }),
      db.Hub.findByPk(mac_address, { attributes: ['address', 'user_email', 'name', 'is_change'] })
    ]);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: '등록되지 않은 사용자입니다.'
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
    } else {
      await db.Hub.create({
        address: mac_address,
        name: `허브 ${mac_address}`,
        user_email: user_email,
        is_change: false
      });
      log(`[Hub Check] ✅ New hub ${mac_address} registered for user ${user_email}`);
    }

    // MQTT 토픽 구독 (이미 구독된 경우 스킵)
    const sendTopic = `hub/${mac_address}/send`;
    const receiveTopic = `hub/${mac_address}/receive`;

    if (!subscribedHubs.has(mac_address)) {
      // send 토픽 구독 (허브 → 백엔드로 이벤트 전달)
      mqttClient.subscribe(sendTopic, (message, topic) => {
        log(`[Hub Check] 📥 Message received from ${topic}`);
        try {
          const messageStr = Buffer.isBuffer(message) ? message.toString('utf8') : 
                            typeof message === 'string' ? message : JSON.stringify(message);
          const data = JSON.parse(messageStr);
          log(`[Hub Check] Send topic data:`, JSON.stringify(data, null, 2));

          // 허브에서 연결된 디바이스 목록을 보내온 경우
          if (data && Array.isArray(data.connected_devices) && ioInstance) {
            ioInstance.emit('CONNECTED_DEVICES', {
              hubAddress: mac_address,
              connected_devices: data.connected_devices,
              timestamp: new Date().toISOString(),
            });
          }
        } catch (e) {
          log(`[Hub Check] Send topic raw message:`, Buffer.isBuffer(message) ? message.toString('utf8') : message);
        }
      }, 1);

      // receive 토픽 구독
      mqttClient.subscribe(receiveTopic, (message, topic) => {
        log(`[Hub Check] 📥 Message received from ${topic}`);
        try {
          const messageStr = Buffer.isBuffer(message) ? message.toString('utf8') : 
                            typeof message === 'string' ? message : JSON.stringify(message);
          const data = JSON.parse(messageStr);
          log(`[Hub Check] Receive topic data:`, JSON.stringify(data, null, 2));
        } catch (e) {
          log(`[Hub Check] Receive topic raw message:`, Buffer.isBuffer(message) ? message.toString('utf8') : message);
        }
      }, 1);

      subscribedHubs.add(mac_address);
      log(`[Hub Check] ✅ Subscribed to MQTT topics: ${sendTopic}, ${receiveTopic}`);
    }

    // Socket.IO를 통해 허브 활성화 이벤트 전송
    if (ioInstance) {
      ioInstance.emit('HUB_ACTIVITY', {
        hubAddress: mac_address,
        userEmail: user_email,
        status: 'online',
        timestamp: new Date().toISOString(),
        message: '허브가 활성화되었습니다.'
      });
    }

    // 등록 완료 응답
    res.status(200).send(
      "mqtt server ready"
    );
  } catch (error) {
    console.error('[Hub Check] Error:', error);
    res.status(500).send(
      "mqtt server fail"
    );
  }
});

module.exports = router;
module.exports.setIOInstance = setIOInstance;

