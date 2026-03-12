const jwt = require("jsonwebtoken");
const db = require("../models");
const { createError, ERROR_REASON } = require("../core/error/errorFactory");
const { logError } = require("../core/error/errorLogger");
const { getRecentLogs, getRecentErrors } = require("../core/error/errorStream");
const { getConnectionStatusData } = require("../admin/adminConnectionController");

const SOCKET_PAYLOAD_MAX_BYTES = 100 * 1024; // 100KB

/**
 * Socket.IO 핸들러
 * 문서 요구사항에 맞춘 이벤트 구조:
 * - CONTROL_REQUEST: 프론트 → 백엔드 (기기 제어 명령)
 * - CONTROL_ACK: 백엔드 → 프론트 (명령 수신 확인)
 * - CONTROL_RESULT: 백엔드 → 프론트 (명령 실행 결과)
 * - TELEMETRY: 백엔드 → 프론트 (실시간 측정 데이터)
 */
module.exports = (io, app) => {
  io.use(async (socket, next) => {
    try {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/dbf439ea-9874-404e-bfdd-9c97e098e02b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'socket/index.js:13',message:'Socket auth middleware',data:{hasJwtSecret:!!process.env.JWT_SECRET},timestamp:Date.now(),sessionId:'debug-session',runId:'runtime',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      
      const token =
        socket.handshake.auth.token ||
        socket.handshake.headers.authorization?.split(" ")[1];

      if (!token) {
        return next(new Error("Authentication error: No token provided"));
      }

      if (!process.env.JWT_SECRET) {
        console.error("❌ CRITICAL: JWT_SECRET is not set in Socket.IO middleware");
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/dbf439ea-9874-404e-bfdd-9c97e098e02b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'socket/index.js:JWT_SECRET',message:'JWT_SECRET missing in socket auth',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'runtime',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        return next(new Error("Authentication error: Server configuration error"));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await db.User.findByPk(decoded.email);

      if (!user) {
        return next(new Error("Authentication error: Invalid user"));
      }

      socket.user = {
        email: user.email,
        name: user.name,
        role: user.role || 'user',
      };

      next();
    } catch (error) {
      console.error("Socket authentication error:", error);
      next(new Error("Authentication error: Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    console.log(`[Socket] ✅ User connected: ${socket.user.name} (${socket.id})`);
    console.log(`[Socket] 📧 User email: ${socket.user.email}`);

    // 룸 이름은 이메일 소문자 통일 (Hub user_email·JWT 대소문자 차이로 수신 실패 방지)
    const userEmail = (socket.user.email || '').trim().toLowerCase();
    const roomName = `user:${userEmail}`;
    socket.join(roomName);

    const room = io.sockets.adapter.rooms.get(roomName);
    const socketCount = room ? room.size : 0;
    console.log(`[Socket] 🏠 User joined room: "${roomName}"`, {
      roomExists: !!room,
      socketCount,
      totalRooms: io.sockets.adapter.rooms.size,
    });

    socket.emit("connected", {
      message: "소켓 연결 성공",
      user: socket.user,
    });
    
    console.log(`[Socket] ✅ "connected" event emitted to socket ${socket.id}`);

    // Admin dashboard: join rooms for real-time error + stdout/stderr log stream
    socket.on("join-admin-errors", () => {
      if (socket.user.role === "admin") {
        socket.join("admin/telemetry"); // TELEMETRY 수신 (소유자 룸에 소켓 없을 때 전달)
      }
      socket.join("admin/errors");
      socket.join("admin/logs"); // 실시간 서버 로그(터미널 전체 출력) 수신
      // 접속 시 과거 로그/에러도 전달 (버퍼에 저장된 최근 N개)
      try {
        const recentLogs = getRecentLogs();
        if (recentLogs.length > 0) {
          socket.emit("server-log-history", recentLogs);
        }
        const recentErrors = getRecentErrors();
        if (recentErrors.length > 0) {
          socket.emit("server-error-history", recentErrors);
        }
      } catch (e) {
        console.error("[Socket] Failed to send log/error history:", e);
      }
    });

    // Admin 연결 상태 모니터링: 룸 가입 + (스로틀 적용) 전체 허브에 state:hub 요청 + 초기 스냅샷 전송
    // 스로틀: 동일 소켓에서 state:hub 전체 요청은 최소 60초 간격으로만 수행 (MQTT/사용자 명령 막힘 방지)
    const STATE_HUB_ALL_HUBS_MIN_INTERVAL_MS = 60 * 1000; // 60초
    socket.on("join-admin-connection-status", async () => {
      if (socket.user.role !== "admin") {
        console.warn("[Socket] join-admin-connection-status: non-admin user ignored");
        return;
      }
      socket.join("admin/telemetry");
      socket.join("admin/connection-status");
      if (!socket._adminConnectionStatusLogged) {
        socket._adminConnectionStatusLogged = true;
        console.log("[Socket] Admin joined admin/connection-status");
      }

      try {
        const data = await getConnectionStatusData(app);
        socket.emit("admin-connection-status", data);
      } catch (e) {
        console.error("[Socket] join-admin-connection-status initial snapshot error:", e);
        socket.emit("admin-connection-status", { users: [] });
      }

      const mqttService = app && app.get("mqtt");
      const now = Date.now();
      const lastRequest = socket._lastAllHubsStateRequest || 0;
      if (now - lastRequest >= STATE_HUB_ALL_HUBS_MIN_INTERVAL_MS || lastRequest === 0) {
        if (mqttService) {
          socket._lastAllHubsStateRequest = now;
          const STATE_HUB_DELAY_MS = 120;
          try {
            const hubs = await db.Hub.findAll({ attributes: ["address"] });
            if (hubs.length > 0) {
              console.log("[Socket] Sending state:hub to", hubs.length, "hubs");
              for (const hub of hubs) {
                const topic = mqttService.getHubReceiveTopic(hub.address);
                mqttService.publish(topic, "state:hub", { qos: 1, retain: false });
                await new Promise((r) => setTimeout(r, STATE_HUB_DELAY_MS));
              }
            }
          } catch (e) {
            console.error("[Socket] join-admin-connection-status state:hub error:", e);
          }
        }
      }
    });

    /**
     * CONTROL_REQUEST: 프론트에서 기기 제어 명령 전송 (측정 시작/정지 등)
     * 어드민이 연결 상태 페이지에 있어도 사용자 명령은 항상 이 소켓으로 수신되어 처리되며,
     * 결과는 요청한 소켓(socket.emit)에만 전달됩니다.
     */
    socket.on("CONTROL_REQUEST", async (data) => {
      try {
        const payloadSize = data ? JSON.stringify(data).length : 0;
        if (payloadSize > SOCKET_PAYLOAD_MAX_BYTES) {
          const err = createError("socket", ERROR_REASON.PAYLOAD_TOO_LARGE, "Socket payload exceeded", `size=${payloadSize}`, {
            payloadSize,
            deviceId: data?.deviceId,
          });
          logError(err);
          socket.emit("server-error", err);
          return;
        }
        const { hubId, deviceId, command, requestId } = data;

        if (!hubId || !deviceId || !command) {
          const err = createError("socket", ERROR_REASON.MISSING_FIELD, "hubId, deviceId, command는 필수입니다.", "", { deviceId: data?.deviceId });
          logError(err);
          socket.emit("server-error", err);
          socket.emit("CONTROL_RESULT", {
            requestId: requestId || `req_${Date.now()}`,
            success: false,
            error: "hubId, deviceId, command는 필수입니다.",
          });
          return;
        }

        console.log(`[Socket] 📥 Received CONTROL_REQUEST:`, {
          hubId,
          deviceId,
          command: JSON.stringify(command),
          requestId
        });

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

        // 허브 토픽 모드(prod/test)에 맞는 receive 토픽 선택
        const receiveTopic =
          typeof mqttService.getHubReceiveTopic === 'function'
            ? mqttService.getHubReceiveTopic(hubId)
            : `hub/${hubId}/receive`;

        // connect:devices → hub/{hubId}/receive 에 문자열로 전송
        if (command.action === 'connect_devices') {
          const topic = receiveTopic;
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
          const topic = receiveTopic;
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
          const topic = receiveTopic;
          const payload = command.raw_command || `start:${deviceId}`;
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
            // ✅ TelemetryWorker에 측정 시작 알림
            const telemetryWorker = io.telemetryWorker;
            if (telemetryWorker && typeof telemetryWorker.startMeasurement === 'function') {
              telemetryWorker.startMeasurement(deviceId);
            }
            
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
          const topic = receiveTopic;
          const payload = command.raw_command || `stop:${deviceId}`;
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
            // ✅ TelemetryWorker에 측정 정지 알림
            const telemetryWorker = io.telemetryWorker;
            if (telemetryWorker && typeof telemetryWorker.stopMeasurement === 'function') {
              telemetryWorker.stopMeasurement(deviceId);
            }
            
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

        // state:hub 명령 처리 (허브 상태 및 연결된 디바이스 조회)
        // command.raw_command가 "state:hub"인 경우 또는 action이 'check_hub_state'인 경우
        if (command.raw_command === 'state:hub' || command.action === 'check_hub_state') {
          const topic = receiveTopic;
          const payload = 'state:hub';
          console.log(`[Socket] 📤 Sending MQTT state:hub to ${topic}`);
          const success = mqttService.publish(topic, payload, { qos: 1, retain: false });

          if (!success) {
            socket.emit("CONTROL_RESULT", {
              requestId: requestId || `req_${Date.now()}`,
              hubId,
              deviceId,
              success: false,
              error: 'MQTT publish 실패(state:hub)',
              timestamp: new Date().toISOString(),
            });
          } else {
            // 성공적으로 전송했지만 응답은 CONNECTED_DEVICES 이벤트로 받음
            socket.emit("CONTROL_RESULT", {
              requestId: requestId || `req_${Date.now()}`,
              hubId,
              deviceId,
              success: true,
              data: { command, message: '상태 확인 명령이 전송되었습니다. 응답을 기다리는 중...' },
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
        const err = createError("socket", ERROR_REASON.INTERNAL_ERROR, error.message || "명령 처리 중 오류가 발생했습니다.", error.stack, { deviceId: data?.deviceId });
        logError(err);
        socket.emit("server-error", err);
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
