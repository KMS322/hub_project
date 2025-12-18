const jwt = require("jsonwebtoken");
const db = require("../models");

/**
 * Socket.IO 핸들러
 * 문서 요구사항에 맞춘 이벤트 구조:
 * - CONTROL_REQUEST: 프론트 → 백엔드 (기기 제어 명령)
 * - CONTROL_ACK: 백엔드 → 프론트 (명령 수신 확인)
 * - CONTROL_RESULT: 백엔드 → 프론트 (명령 실행 결과)
 * - TELEMETRY: 백엔드 → 프론트 (실시간 측정 데이터)
 */
module.exports = (io) => {
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth.token ||
        socket.handshake.headers.authorization?.split(" ")[1];

      if (!token) {
        return next(new Error("Authentication error: No token provided"));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await db.User.findByPk(decoded.email);

      if (!user) {
        return next(new Error("Authentication error: Invalid user"));
      }

      socket.user = {
        email: user.email,
        name: user.name,
      };

      next();
    } catch (error) {
      console.error("Socket authentication error:", error);
      next(new Error("Authentication error: Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    console.log(`User connected: ${socket.user.name} (${socket.id})`);

    socket.join(`user:${socket.user.email}`);

    socket.emit("connected", {
      message: "소켓 연결 성공",
      user: socket.user,
    });

    /**
     * CONTROL_REQUEST: 프론트에서 기기 제어 명령 전송
     * 예: 측정 시작/정지, LED 깜빡임 등
     */
    socket.on("CONTROL_REQUEST", async (data) => {
      try {
        const { hubId, deviceId, command, requestId } = data;

        console.log(`[Socket] 📥 Received CONTROL_REQUEST:`, {
          hubId,
          deviceId,
          command: JSON.stringify(command),
          requestId
        });

        if (!hubId || !deviceId || !command) {
          socket.emit("CONTROL_RESULT", {
            requestId: requestId || `req_${Date.now()}`,
            success: false,
            error: "hubId, deviceId, command는 필수입니다.",
          });
          return;
        }

        // CONTROL_ACK 전송 (명령 수신 확인)
        socket.emit("CONTROL_ACK", {
          requestId: requestId || `req_${Date.now()}`,
          hubId,
          deviceId,
          command,
          timestamp: new Date().toISOString(),
        });

        // MQTT 서비스 가져오기 (io 인스턴스에서)
        const mqttService = io.mqttService;
        if (!mqttService || !mqttService.isConnected()) {
          socket.emit("CONTROL_RESULT", {
            requestId: requestId || `req_${Date.now()}`,
            hubId,
            deviceId,
            success: false,
            error: "MQTT 서비스가 연결되지 않았습니다.",
            timestamp: new Date().toISOString(),
          });
          return;
        }

        // connect:devices → hub/{hubId}/receive 에 문자열로 전송
        if (command.action === 'connect_devices') {
          const topic = `hub/${hubId}/receive`;
          const payload = 'connect:devices';
          console.log(`[Socket] 📤 Sending MQTT connect:devices to ${topic}`);
          const success = mqttService.publish(topic, payload, { qos: 1, retain: false });

          if (!success) {
            socket.emit("CONTROL_RESULT", {
              requestId: requestId || `req_${Date.now()}`,
              hubId,
              deviceId,
              success: false,
              error: 'MQTT publish 실패(connect:devices)',
              timestamp: new Date().toISOString(),
            });
          } else {
            socket.emit("CONTROL_RESULT", {
              requestId: requestId || `req_${Date.now()}`,
              hubId,
              deviceId,
              success: true,
              data: { command },
              timestamp: new Date().toISOString(),
            });
          }
          return;
        }

        // blink:device_mac_address → hub/{hubId}/receive 에 문자열로 전송
        if (command.action === 'blink' && command.mac_address) {
          const topic = `hub/${hubId}/receive`;
          const payload = `blink:${command.mac_address}`;
          console.log(`[Socket] 📤 Sending MQTT blink to ${topic}: ${payload}`);
          const success = mqttService.publish(topic, payload, { qos: 1, retain: false });

          if (!success) {
            socket.emit("CONTROL_RESULT", {
              requestId: requestId || `req_${Date.now()}`,
              hubId,
              deviceId,
              success: false,
              error: 'MQTT publish 실패(blink)',
              timestamp: new Date().toISOString(),
            });
          } else {
            socket.emit("CONTROL_RESULT", {
              requestId: requestId || `req_${Date.now()}`,
              hubId,
              deviceId,
              success: true,
              data: { command },
              timestamp: new Date().toISOString(),
            });
          }
          return;
        }

        // start_measurement: start:device_mac_address
        if (command.action === 'start_measurement') {
          const topic = `hub/${hubId}/receive`;
          const payload = command.raw_command || `start:${deviceId}`;
          console.log(`[Socket] 📤 Sending MQTT start measurement to ${topic}: ${payload}`);
          const success = mqttService.publish(topic, payload, { qos: 1, retain: false });

          if (!success) {
            socket.emit("CONTROL_RESULT", {
              requestId: requestId || `req_${Date.now()}`,
              hubId,
              deviceId,
              success: false,
              error: 'MQTT publish 실패(start_measurement)',
              timestamp: new Date().toISOString(),
            });
          } else {
            socket.emit("CONTROL_RESULT", {
              requestId: requestId || `req_${Date.now()}`,
              hubId,
              deviceId,
              success: true,
              data: { command },
              timestamp: new Date().toISOString(),
            });
          }
          return;
        }

        // stop_measurement: stop:device_mac_address
        if (command.action === 'stop_measurement') {
          const topic = `hub/${hubId}/receive`;
          const payload = command.raw_command || `stop:${deviceId}`;
          console.log(`[Socket] 📤 Sending MQTT stop measurement to ${topic}: ${payload}`);
          const success = mqttService.publish(topic, payload, { qos: 1, retain: false });

          if (!success) {
            socket.emit("CONTROL_RESULT", {
              requestId: requestId || `req_${Date.now()}`,
              hubId,
              deviceId,
              success: false,
              error: 'MQTT publish 실패(stop_measurement)',
              timestamp: new Date().toISOString(),
            });
          } else {
            socket.emit("CONTROL_RESULT", {
              requestId: requestId || `req_${Date.now()}`,
              hubId,
              deviceId,
              success: true,
              data: { command },
              timestamp: new Date().toISOString(),
            });
          }
          return;
        }

        // 그 외 일반 MQTT 명령인 경우 기존 sendCommand 로 처리
        console.log(`[Socket] 📤 Sending MQTT command to hub ${hubId} device ${deviceId}:`, command);
        try {
          const response = await mqttService.sendCommand(
            hubId,
            deviceId,
            command,
            2000 // 2초 타임아웃 (200ms에서 증가)
          );

          // CONTROL_RESULT는 MQTT 응답 핸들러에서 자동으로 전송됨
          console.log(
            `[Socket] ✅ Command sent successfully to hub ${hubId} device ${deviceId}`
          );
        } catch (error) {
          console.error(
            `[Socket] ❌ Failed to send command to hub ${hubId} device ${deviceId}:`,
            error.message
          );
          socket.emit("CONTROL_RESULT", {
            requestId: requestId || `req_${Date.now()}`,
            hubId,
            deviceId,
            success: false,
            error: error.message,
            timestamp: new Date().toISOString(),
          });
        }
      } catch (error) {
        console.error("[Socket] CONTROL_REQUEST error:", error);
        socket.emit("CONTROL_RESULT", {
          requestId: data.requestId || `req_${Date.now()}`,
          success: false,
          error: "명령 처리 중 오류가 발생했습니다.",
        });
      }
    });

    /**
     * 허브/기기 상태 조회 요청
     */
    socket.on("GET_DEVICE_STATUS", async (data) => {
      try {
        const { hubId, deviceId } = data;

        // DB에서 최신 상태 조회
        if (deviceId) {
          const device = await db.Device.findByPk(deviceId);
          if (device) {
            socket.emit("DEVICE_STATUS", {
              hubId: device.hub_address,
              deviceId: device.address,
              name: device.name,
              timestamp: new Date().toISOString(),
            });
          }
        } else if (hubId) {
          const hub = await db.Hub.findByPk(hubId);
          if (hub) {
            const devices = await db.Device.findAll({
              where: { hub_address: hubId },
            });
            socket.emit("HUB_STATUS", {
              hubId: hub.address,
              name: hub.name,
              devices: devices.map((d) => ({
                deviceId: d.address,
                name: d.name,
              })),
              timestamp: new Date().toISOString(),
            });
          }
        }
      } catch (error) {
        console.error("[Socket] GET_DEVICE_STATUS error:", error);
      }
    });

    /**
     * 연결 해제 처리
     */
    socket.on("disconnect", (reason) => {
      console.log(
        `User disconnected: ${socket.user.name} (${socket.id}) - Reason: ${reason}`
      );
    });

    /**
     * 에러 처리
     */
    socket.on("error", (error) => {
      console.error("Socket error:", error);
    });
  });

  return io;
};
