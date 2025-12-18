const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlewares/auth');
const db = require('../models');
const mqttClient = require('../mqtt/client');

/**
 * 허브 목록 조회
 * GET /hub
 */
router.get('/', verifyToken, async (req, res) => {
  try {
    const hubs = await db.Hub.findAll({
      where: {
        user_email: req.user.email
      },
      attributes: ['address', 'name', 'user_email', 'is_change', 'createdAt', 'updatedAt'], // 필요한 필드만 조회
      include: [{
        model: db.Device,
        as: 'Devices',
        attributes: ['address', 'name', 'hub_address'], // 필요한 필드만 조회
        include: [{
          model: db.Pet,
          as: 'Pet',
          attributes: ['id', 'name'] // 필요한 필드만 조회
        }]
      }],
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      count: hubs.length,
      data: hubs.map(hub => ({
        id: hub.address,
        address: hub.address,
        name: hub.name,
        user_email: hub.user_email,
        is_change: hub.is_change,
        connectedDevices: hub.Devices?.length || 0,
        updatedAt: hub.updatedAt, // 마지막 활동 시간
        devices: hub.Devices?.map(device => ({
          id: device.address,
          address: device.address,
          name: device.name,
          hub_address: device.hub_address,
          connectedPatient: device.Pet ? {
            id: device.Pet.id,
            name: device.Pet.name
          } : null
        })) || []
      }))
    });
  } catch (error) {
    console.error('[Hub API] Error:', error);
    res.status(500).json({
      success: false,
      message: '허브 목록 조회 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * 허브 상세 조회
 * GET /hub/:hubAddress
 */
router.get('/:hubAddress', verifyToken, async (req, res) => {
  try {
    const { hubAddress } = req.params;

    const hub = await db.Hub.findOne({
      where: {
        address: hubAddress,
        user_email: req.user.email
      },
      include: [{
        model: db.Device,
        as: 'Devices'
      }]
    });

    if (!hub) {
      return res.status(404).json({
        success: false,
        message: '허브를 찾을 수 없습니다.'
      });
    }

    res.json({
      success: true,
      data: {
        id: hub.address,
        address: hub.address,
        name: hub.name,
        user_email: hub.user_email,
        is_change: hub.is_change,
        devices: hub.Devices || []
      }
    });
  } catch (error) {
    console.error('[Hub API] Error:', error);
    res.status(500).json({
      success: false,
      message: '허브 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

/**
 * 허브 등록
 * POST /hub
 * body: { mac_address, name, wifi_id, wifi_password, user_email }
 */
router.post('/', verifyToken, async (req, res) => {
  try {
    const { mac_address, name, wifi_id, wifi_password, user_email } = req.body;

    // 필수 필드 검증
    if (!mac_address || !name) {
      return res.status(400).json({
        success: false,
        message: 'mac_address와 name은 필수입니다.'
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

    // 중복 확인
    const existingHub = await db.Hub.findByPk(mac_address);
    if (existingHub) {
      return res.status(409).json({
        success: false,
        message: '이미 등록된 허브입니다.'
      });
    }

    // Hub 생성 (address 필드에 mac_address 저장)
    const hub = await db.Hub.create({
      address: mac_address,
      name,
      user_email: user_email || req.user.email,
      is_change: false
    });

    // MQTT 토픽 구독: hub/{mac_address}/send, hub/{mac_address}/receive
    const sendTopic = `hub/${mac_address}/send`;
    const receiveTopic = `hub/${mac_address}/receive`;

    // send 토픽 구독
    mqttClient.subscribe(sendTopic, (message, topic) => {
      console.log(`[Hub API] 📥 Message received from ${topic}`);
      try {
        const messageStr = Buffer.isBuffer(message) ? message.toString('utf8') : 
                          typeof message === 'string' ? message : JSON.stringify(message);
        const data = JSON.parse(messageStr);
        console.log(`[Hub API] Send topic data:`, JSON.stringify(data, null, 2));
      } catch (e) {
        console.log(`[Hub API] Send topic raw message:`, Buffer.isBuffer(message) ? message.toString('utf8') : message);
      }
    }, 1);

    // receive 토픽 구독
    mqttClient.subscribe(receiveTopic, (message, topic) => {
      console.log(`[Hub API] 📥 Message received from ${topic}`);
      try {
        const messageStr = Buffer.isBuffer(message) ? message.toString('utf8') : 
                          typeof message === 'string' ? message : JSON.stringify(message);
        const data = JSON.parse(messageStr);
        console.log(`[Hub API] Receive topic data:`, JSON.stringify(data, null, 2));
      } catch (e) {
        console.log(`[Hub API] Receive topic raw message:`, Buffer.isBuffer(message) ? message.toString('utf8') : message);
      }
    }, 1);

    console.log(`[Hub API] ✅ Subscribed to MQTT topics: ${sendTopic}, ${receiveTopic}`);

    // WiFi 설정이 제공된 경우, 허브에 WiFi 설정 전송
    if (wifi_id && wifi_password) {
      const wifiSettingsTopic = `hub/${mac_address}/wifi-config`;
      const wifiSettings = {
        ssid: wifi_id,
        password: wifi_password,
        timestamp: new Date().toISOString()
      };
      
      const published = mqttClient.publish(wifiSettingsTopic, wifiSettings, { qos: 1, retain: false });
      if (published) {
        console.log(`[Hub API] 📤 WiFi settings sent to ${wifiSettingsTopic}`);
      }
    }

    res.status(201).json({
      success: true,
      message: '허브가 등록되었습니다.',
      data: {
        id: hub.address,
        address: hub.address,
        name: hub.name,
        user_email: hub.user_email,
        is_change: hub.is_change,
        mqttTopics: {
          send: sendTopic,
          receive: receiveTopic
        }
      }
    });
  } catch (error) {
    console.error('[Hub API] Error:', error);
    res.status(500).json({
      success: false,
      message: '허브 등록 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

/**
 * 허브 수정
 * PUT /hub/:hubAddress
 */
router.put('/:hubAddress', verifyToken, async (req, res) => {
  try {
    const { hubAddress } = req.params;
    const { name } = req.body;

    const hub = await db.Hub.findOne({
      where: {
        address: hubAddress,
        user_email: req.user.email
      }
    });

    if (!hub) {
      return res.status(404).json({
        success: false,
        message: '허브를 찾을 수 없습니다.'
      });
    }

    if (name) {
      hub.name = name;
    }

    await hub.save();

    res.json({
      success: true,
      message: '허브 정보가 수정되었습니다.',
      data: {
        id: hub.address,
        address: hub.address,
        name: hub.name,
        user_email: hub.user_email,
        is_change: hub.is_change
      }
    });
  } catch (error) {
    console.error('[Hub API] Error:', error);
    res.status(500).json({
      success: false,
      message: '허브 수정 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

/**
 * 허브 삭제
 * DELETE /hub/:hubAddress
 */
router.delete('/:hubAddress', verifyToken, async (req, res) => {
  try {
    const { hubAddress } = req.params;

    const hub = await db.Hub.findOne({
      where: {
        address: hubAddress,
        user_email: req.user.email
      }
    });

    if (!hub) {
      return res.status(404).json({
        success: false,
        message: '허브를 찾을 수 없습니다.'
      });
    }

    await hub.destroy();

    res.json({
      success: true,
      message: '허브가 삭제되었습니다.'
    });
  } catch (error) {
    console.error('[Hub API] Error:', error);
    res.status(500).json({
      success: false,
      message: '허브 삭제 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

/**
 * 허브 제어 명령 전송 (Socket.IO 대체)
 * POST /hub/:hubAddress/control
 * body: { deviceId, command }
 */
router.post('/:hubAddress/control', verifyToken, async (req, res) => {
  try {
    const { hubAddress } = req.params;
    const { deviceId, command } = req.body;

    if (!deviceId || !command) {
      return res.status(400).json({
        success: false,
        message: 'deviceId와 command는 필수입니다.'
      });
    }

    // 허브 소유권 확인
    const hub = await db.Hub.findOne({
      where: {
        address: hubAddress,
        user_email: req.user.email
      }
    });

    if (!hub) {
      return res.status(404).json({
        success: false,
        message: '허브를 찾을 수 없거나 접근 권한이 없습니다.'
      });
    }

    const mqttService = req.app.get('mqtt');
    if (!mqttService || !mqttService.isConnected()) {
      return res.status(503).json({
        success: false,
        message: 'MQTT 서비스가 연결되지 않았습니다.'
      });
    }

    // connect:devices → hub/{hubAddress}/receive 에 문자열로 전송
    if (command.action === 'connect_devices') {
      const topic = `hub/${hubAddress}/receive`;
      const payload = 'connect:devices';
      const success = mqttService.publish(topic, payload, { qos: 1, retain: false });

      if (!success) {
        return res.status(500).json({
          success: false,
          message: 'MQTT publish 실패(connect:devices)'
        });
      }

      return res.json({
        success: true,
        message: '디바이스 스캔 명령이 전송되었습니다.',
        data: { command }
      });
    }

    // blink:device_mac_address → hub/{hubAddress}/receive 에 문자열로 전송
    if (command.action === 'blink' && command.mac_address) {
      const topic = `hub/${hubAddress}/receive`;
      const payload = `blink:${command.mac_address}`;
      const success = mqttService.publish(topic, payload, { qos: 1, retain: false });

      if (!success) {
        return res.status(500).json({
          success: false,
          message: 'MQTT publish 실패(blink)'
        });
      }

      return res.json({
        success: true,
        message: 'LED 깜빡임 명령이 전송되었습니다.',
        data: { command }
      });
    }

    // start_measurement: startdevice:device_mac_address
    if (command.action === 'start_measurement') {
      const topic = `hub/${hubAddress}/receive`;
      const payload = command.raw_command || `startdevice:${deviceId}`;
      const success = mqttService.publish(topic, payload, { qos: 1, retain: false });

      if (!success) {
        return res.status(500).json({
          success: false,
          message: 'MQTT publish 실패(start_measurement)'
        });
      }

      return res.json({
        success: true,
        message: '측정 시작 명령이 전송되었습니다.',
        data: { command }
      });
    }

    // stop_measurement: stopdevice:device_mac_address
    if (command.action === 'stop_measurement') {
      const topic = `hub/${hubAddress}/receive`;
      const payload = command.raw_command || `stopdevice:${deviceId}`;
      const success = mqttService.publish(topic, payload, { qos: 1, retain: false });

      if (!success) {
        return res.status(500).json({
          success: false,
          message: 'MQTT publish 실패(stop_measurement)'
        });
      }

      return res.json({
        success: true,
        message: '측정 정지 명령이 전송되었습니다.',
        data: { command }
      });
    }

    // 그 외 일반 MQTT 명령인 경우
    try {
      const response = await mqttService.sendCommand(
        hubAddress,
        deviceId,
        command,
        2000 // 2초 타임아웃
      );

      return res.json({
        success: true,
        message: '명령이 전송되었습니다.',
        data: response
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message || '명령 전송 중 오류가 발생했습니다.'
      });
    }
  } catch (error) {
    console.error('[Hub API] Control Error:', error);
    res.status(500).json({
      success: false,
      message: '명령 처리 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

module.exports = router;

