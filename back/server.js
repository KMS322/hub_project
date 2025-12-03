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
const mqttTestRoutes = require("./routes/mqtt-test");
const initializeDatabase = require("./seeders/init");
const MQTTService = require("./mqtt/service");
const TelemetryWorker = require("./workers/telemetryWorker");

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.set("io", io);

app.use("/auth", authRoutes);
app.use("/mqtt", mqttRoutes);
app.use("/telemetry", telemetryRoutes);
app.use("/hub", hubRoutes);
app.use("/device", deviceRoutes);
app.use("/pet", petRoutes);
app.use("/records", recordsRoutes);
app.use("/mqtt-test", mqttTestRoutes);

// Telemetry 데이터 큐 생성
const telemetryQueue = [];

// Telemetry Worker 초기화
const telemetryWorker = new TelemetryWorker(io, telemetryQueue, {
  batchSize: 100,
  processInterval: 50, // 50ms마다 처리
  broadcastInterval: 100 // 100ms마다 브로드캐스트 (10Hz)
});

// MQTT 서비스 초기화 (Telemetry 큐 전달)
const mqttService = new MQTTService(io, telemetryQueue);
mqttService.initialize();
app.set("mqtt", mqttService);
app.set("telemetryWorker", telemetryWorker);

// Socket.IO에 MQTT 서비스 참조 저장
io.mqttService = mqttService;

const socketHandler = require("./socket");
socketHandler(io);

db.sequelize
  .sync({ alter: false })
  .then(async () => {
    console.log("Database connected successfully");

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
      console.log(`\n💡 팁: MQTT 모니터 서버(http://localhost:3001)에서도 확인 가능합니다`);
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
