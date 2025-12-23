require('dotenv').config();
const express = require("express");
const app = express();
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const db = require("./models");
const PORT = process.env.PORT || 5000;
const authRoutes = require("./routes/auth");
const mqttRoutes = require("./routes/mqtt");
const telemetryRoutes = require("./routes/telemetry");
const hubRoutes = require("./routes/hub");
const deviceRoutes = require("./routes/device");
const petRoutes = require("./routes/pet");
const recordsRoutes = require("./routes/records");
const csvRoutes = require("./routes/csv");
const mqttTestRoutes = require("./routes/mqtt-test");
const checkRoutes = require("./routes/check");
const measurementRoutes = require("./routes/measurement");
const hrvRoutes = require("./routes/hrv");
const initializeDatabase = require("./seeders/init");
const MQTTService = require("./mqtt/service");
const TelemetryWorker = require("./workers/telemetryWorker");

const server = http.createServer(app);

// Socket.IO 초기화
const io = new Server(server, {
  cors: {
    origin: true, // 모든 origin 허용 (요청 origin 그대로 반환)
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept"
    ],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204,
  },
});

app.use(cors());
app.use(express.json({ limit: '30mb' })); // 요청 크기 제한 추가
app.use(express.urlencoded({ extended: true, limit: '30mb' })); // 요청 크기 제한 추가

app.set("io", io);

app.use("/api/auth", authRoutes);
app.use("/api/mqtt", mqttRoutes);
app.use("/api/telemetry", telemetryRoutes);
app.use("/api/hub", hubRoutes);
app.use("/api/device", deviceRoutes);
app.use("/api/pet", petRoutes);
app.use("/api/records", recordsRoutes);
app.use("/api/csv", csvRoutes);
app.use("/api/mqtt-test", mqttTestRoutes);
app.use("/api/measurement", measurementRoutes);
app.use("/api/hrv", hrvRoutes);
// check 라우트에 Socket.IO 인스턴스 전달
checkRoutes.setIOInstance(io);
app.use("/api/check", checkRoutes);

// Telemetry 데이터 큐 생성
const telemetryQueue = [];
app.set("telemetryQueue", telemetryQueue);

// Telemetry Worker 초기화 (Socket.IO로 데이터 전송)
const telemetryWorker = new TelemetryWorker(io, telemetryQueue, {
  batchSize: 100,
  processInterval: 50, // 50ms마다 처리
  broadcastInterval: 100 // 100ms마다 브로드캐스트 (10Hz)
});

// MQTT 서비스 초기화 (Telemetry 큐 전달, Socket.IO는 이벤트 전송용)
const mqttService = new MQTTService(io, telemetryQueue);
mqttService.initialize();
app.set("mqtt", mqttService);
app.set("telemetryWorker", telemetryWorker);

// Socket.IO에 MQTT 서비스 참조 저장
io.mqttService = mqttService;

// Socket.IO 핸들러 설정
const socketHandler = require("./socket");
socketHandler(io);

db.sequelize
  .sync({ alter: true, force: false })
  .then(async () => {
    console.log("Database connected successfully");
    
    // 기존 디바이스에 user_email이 없으면 허브의 user_email로 업데이트
    try {
      const devicesWithoutEmail = await db.Device.findAll({
        where: { user_email: null },
        include: [{
          model: db.Hub,
          as: 'Hub',
          attributes: ['address', 'user_email']
        }]
      });

      for (const device of devicesWithoutEmail) {
        if (device.Hub && device.Hub.user_email) {
          device.user_email = device.Hub.user_email;
          await device.save();
          console.log(`[Migration] Updated device ${device.address} with user_email: ${device.Hub.user_email}`);
        }
      }
    } catch (error) {
      console.error("❌ Error migrating device user_email:", error.message);
    }

    // 개발 모드에서만 더미 데이터 초기화
    if (process.env.NODE_ENV === "development") {
      await initializeDatabase();
    }

    server.listen(PORT, () => {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🚀 Server is running on port ${PORT}`);
      console.log(`📡 Socket.IO is ready`);
      console.log(`\n📊 데이터 모니터링:`);
      console.log(`   - MQTT 메시지는 터미널에 실시간으로 출력됩니다`);
      console.log(`   - Telemetry 데이터는 📊 아이콘으로 표시됩니다`);
      console.log(`   - 허브 상태는 🔌 아이콘으로 표시됩니다`);
      console.log(`   - 명령 응답은 📨 아이콘으로 표시됩니다`);
      console.log(`   - 메시지 발행은 📤 아이콘으로 표시됩니다`);
      console.log(`\n💡 팁: Socket.IO를 통해 실시간 데이터를 전송합니다`);
      console.log(`${'='.repeat(60)}\n`);
      
      // Telemetry Worker 시작
      telemetryWorker.start();
      console.log(`✅ Telemetry Worker started`);
      
      // MQTT 연결 상태 확인
      setTimeout(() => {
        if (mqttService.isConnected()) {
          console.log(`✅ MQTT Client connected`);
        } else {
          console.log(`⚠️  MQTT Client not connected yet`);
        }
      }, 1000);
    });
  })
  .catch((err) => {
    console.error("Unable to connect to database:", err);
  });
