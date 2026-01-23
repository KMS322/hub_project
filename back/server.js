require('dotenv').config();
const express = require("express");
const app = express();
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const db = require("./models");
const PORT = process.env.PORT || 5000;

// #region agent log
fetch('http://127.0.0.1:7242/ingest/dbf439ea-9874-404e-bfdd-9c97e098e02b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'server.js:8',message:'Server startup - checking JWT_SECRET',data:{hasJwtSecret:!!process.env.JWT_SECRET,jwtSecretLength:process.env.JWT_SECRET?.length||0},timestamp:Date.now(),sessionId:'debug-session',runId:'startup',hypothesisId:'A'})}).catch(()=>{});
// #endregion

// Critical: JWT_SECRET 환경변수 검증
if (!process.env.JWT_SECRET) {
  console.error("❌ CRITICAL ERROR: JWT_SECRET environment variable is not set!");
  console.error("   The server cannot securely verify JWT tokens.");
  console.error("   Please set JWT_SECRET in your .env file.");
  process.exit(1);
}

if (process.env.JWT_SECRET.length < 32) {
  console.warn("⚠️  WARNING: JWT_SECRET is too short (less than 32 characters).");
  console.warn("   For production, use a strong secret (at least 32 characters).");
}
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
  broadcastInterval: 1000, // 1초마다 브로드캐스트 (1Hz) - 서버 부하 감소
  minBroadcastInterval: 500 // 최소 500ms 간격으로 전송 (디바이스별 throttling)
});

// Socket.IO 인스턴스에 TelemetryWorker 참조 추가 (측정 시작/정지 제어용)
io.telemetryWorker = telemetryWorker;

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
    process.exit(1);
  });

// #region agent log
fetch('http://127.0.0.1:7242/ingest/dbf439ea-9874-404e-bfdd-9c97e098e02b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'server.js:151',message:'Global error handler setup',data:{hasErrorHandler:true},timestamp:Date.now(),sessionId:'debug-session',runId:'startup',hypothesisId:'B'})}).catch(()=>{});
// #endregion

// 전역 에러 핸들러 추가 (처리되지 않은 에러 캐치)
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/dbf439ea-9874-404e-bfdd-9c97e098e02b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'server.js:unhandledRejection',message:'Unhandled promise rejection',data:{reason:String(reason)},timestamp:Date.now(),sessionId:'debug-session',runId:'runtime',hypothesisId:'B'})}).catch(()=>{});
  // #endregion
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/dbf439ea-9874-404e-bfdd-9c97e098e02b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'server.js:uncaughtException',message:'Uncaught exception',data:{error:error.message,stack:error.stack},timestamp:Date.now(),sessionId:'debug-session',runId:'runtime',hypothesisId:'B'})}).catch(()=>{});
  // #endregion
  // 프로덕션에서는 서버를 재시작해야 함
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
});

// Express 전역 에러 핸들러
app.use((err, req, res, next) => {
  console.error('❌ Express Error:', err);
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/dbf439ea-9874-404e-bfdd-9c97e098e02b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'server.js:errorHandler',message:'Express error handler',data:{error:err.message,url:req.url,method:req.method},timestamp:Date.now(),sessionId:'debug-session',runId:'runtime',hypothesisId:'B'})}).catch(()=>{});
  // #endregion
  
  if (res.headersSent) {
    return next(err);
  }
  
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});
