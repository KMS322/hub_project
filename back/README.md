# 백엔드 서버

동물 웨어러블 모니터링 시스템의 백엔드 서버입니다.

## 🚀 시작하기

### 1. 환경 변수 설정

`.env` 파일을 생성하고 다음 변수들을 설정하세요:

```env
# 서버 설정
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:3000

# 데이터베이스 설정
DB_USERNAME=root
DB_PASSWORD=your_password
DB_DATABASE=hubProjectDB
DB_HOST=127.0.0.1
DB_PORT=3306
DB_LOGGING=false

# MQTT 브로커 설정
MQTT_BROKER_URL=mqtt://localhost:1883
MQTT_USERNAME=
MQTT_PASSWORD=

# JWT 설정
JWT_SECRET=your_jwt_secret_key
```

### 2. 의존성 설치

```bash
npm install
```

### 3. 데이터베이스 설정

MySQL 데이터베이스를 생성하고 `.env` 파일에 정보를 입력하세요.

### 4. 서버 실행

**개발 모드 (자동 재시작):**
```bash
npm run dev
```

**프로덕션 모드:**
```bash
npm start
```

## 📊 데이터 모니터링

### 터미널에서 확인

서버를 실행하면 터미널에 실시간으로 MQTT 메시지가 출력됩니다:

#### 1. **Telemetry 데이터 수신**
```
[MQTT Service] 📊 Telemetry received from hub/AA:BB:CC:DD:EE:01/telemetry/AA:BB:CC:DD:EE:02
  Hub: AA:BB:CC:DD:EE:01, Device: AA:BB:CC:DD:EE:02
  Timestamp: 2024-12-03T14:31:56.789Z
  Samples: 50
  First sample: HR=72, SpO2=98, Temp=37.2°C, Battery=85%
[MQTT Service] ✅ Telemetry queued for processing
```

#### 2. **허브 상태 메시지**
```
[MQTT Service] 🔌 Hub AA:BB:CC:DD:EE:01 status: {
  "status": "online",
  "timestamp": "2024-12-03T14:31:56.789Z"
}
```

#### 3. **명령 응답**
```
[MQTT Service] 📨 Hub AA:BB:CC:DD:EE:01 Device AA:BB:CC:DD:EE:02 response: {
  "requestId": "req_1234567890_abc123",
  "success": true,
  "result": "LED blinked"
}
```

#### 4. **명령 발행**
```
[MQTT Service] 📤 Sending command to hub/AA:BB:CC:DD:EE:01/command/AA:BB:CC:DD:EE:02
  RequestId: req_1234567890_abc123
  Command: {
    "action": "blink_led",
    "duration": 1000
  }
[MQTT Service] ✅ Command published successfully
```

### MQTT 클라이언트 로그

MQTT 클라이언트 레벨에서도 상세한 로그가 출력됩니다:

```
[MQTT Client] 📥 Message received
  Topic: hub/AA:BB:CC:DD:EE:01/telemetry/AA:BB:CC:DD:EE:02
  Size: 1234 bytes
  Payload preview: {"device_mac_address":"AA:BB:CC:DD:EE:02",...
  ✅ Parsed as JSON successfully
```

## 🔍 데이터 확인 방법

### 1. **터미널 로그 확인**
- 서버 실행 시 터미널에 모든 MQTT 메시지가 실시간으로 출력됩니다
- 각 메시지 타입별로 아이콘과 색상이 구분됩니다

### 2. **MQTT 모니터 서버 사용**
- 별도의 MQTT 모니터 서버(`mqtt-monitor`)를 실행하여 웹 인터페이스에서 확인
- `http://localhost:3001` 접속

### 3. **API 엔드포인트 확인**
- Telemetry 데이터: `GET /telemetry/recent/:deviceAddress`
- 최근 데이터 조회: `GET /telemetry/recent`

### 4. **Socket.IO 이벤트 확인**
- 프론트엔드에서 Socket.IO로 실시간 데이터 수신
- 이벤트 타입:
  - `TELEMETRY`: Telemetry 데이터
  - `HUB_STATUS`: 허브 상태
  - `DEVICE_STATUS`: 디바이스 상태
  - `CONTROL_ACK`: 명령 확인
  - `CONTROL_RESULT`: 명령 결과

## 📁 주요 디렉토리 구조

```
back/
├── config/          # 데이터베이스 설정
├── models/          # Sequelize 모델
├── routes/          # API 라우트
├── mqtt/            # MQTT 클라이언트 및 서비스
├── socket/          # Socket.IO 핸들러
├── workers/         # 백그라운드 워커 (Telemetry 처리)
├── middlewares/     # 미들웨어 (인증 등)
├── utils/           # 유틸리티 함수
└── seeders/         # 초기 데이터
```

## 🔧 주요 기능

### MQTT 통신
- 허브와의 양방향 MQTT 통신
- Telemetry 데이터 수신 및 처리
- 명령 전송 및 응답 처리
- 허브 상태 모니터링

### 데이터 처리
- 고속 Telemetry 데이터 처리 (300-1000 samples/sec)
- 배치 처리 및 큐 시스템
- 데이터베이스 저장
- CSV 파일 로깅

### 실시간 통신
- Socket.IO를 통한 프론트엔드 실시간 데이터 전송
- WebSocket 브로드캐스트

## 🐛 문제 해결

### MQTT 메시지가 보이지 않는 경우

1. **MQTT 브로커 연결 확인**
   ```bash
   # Mosquitto가 실행 중인지 확인
   mosquitto -v
   ```

2. **환경 변수 확인**
   - `MQTT_BROKER_URL`이 올바른지 확인
   - 기본값: `mqtt://localhost:1883`

3. **토픽 구독 확인**
   - 허브가 올바른 토픽으로 메시지를 발행하는지 확인
   - 구독 패턴: `hub/+/telemetry/+`, `hub/+/status`, `hub/+/response/+`

### 데이터베이스 연결 오류

1. MySQL 서버가 실행 중인지 확인
2. `.env` 파일의 데이터베이스 정보 확인
3. 데이터베이스가 생성되어 있는지 확인

### 로그가 너무 많은 경우

환경 변수에서 로그 레벨을 조정할 수 있습니다:
- `NODE_ENV=production`: 상세 로그 비활성화
- `DB_LOGGING=false`: 데이터베이스 쿼리 로그 비활성화

## 📝 API 문서

자세한 API 문서는 각 라우트 파일의 주석을 참고하세요:
- `/routes/auth.js` - 인증 API
- `/routes/mqtt.js` - MQTT 제어 API
- `/routes/telemetry.js` - Telemetry 데이터 API
- `/routes/hub.js` - 허브 관리 API
- `/routes/device.js` - 디바이스 관리 API
- `/routes/pet.js` - 환자 관리 API
- `/routes/records.js` - 기록 관리 API

