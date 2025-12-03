# 백엔드 로깅 가이드

백엔드 서버에서 데이터가 어떻게 들어오는지 확인하는 방법입니다.

## 🚀 서버 실행

### 개발 모드
```bash
cd back
npm run dev
```

### 프로덕션 모드
```bash
cd back
npm start
```

## 📊 터미널에서 데이터 확인

서버를 실행하면 터미널에 실시간으로 모든 MQTT 메시지가 출력됩니다.

### 1. 서버 시작 메시지

서버가 시작되면 다음과 같은 메시지가 표시됩니다:

```
============================================================
🚀 Server is running on port 5000
📡 Socket.IO is ready

📊 데이터 모니터링:
   - MQTT 메시지는 터미널에 실시간으로 출력됩니다
   - Telemetry 데이터는 📊 아이콘으로 표시됩니다
   - 허브 상태는 🔌 아이콘으로 표시됩니다
   - 명령 응답은 📨 아이콘으로 표시됩니다
   - 메시지 발행은 📤 아이콘으로 표시됩니다

💡 팁: MQTT 모니터 서버(http://localhost:3001)에서도 확인 가능합니다
============================================================

✅ Telemetry Worker started
   Batch size: 100
   Process interval: 50ms
   Broadcast interval: 100ms
✅ MQTT Client connected
```

### 2. MQTT 메시지 수신 로그

#### Telemetry 데이터 수신
```
[MQTT Client] 📥 Message received
  Topic: hub/AA:BB:CC:DD:EE:01/telemetry/AA:BB:CC:DD:EE:02
  Size: 1234 bytes
  Payload preview: {"device_mac_address":"AA:BB:CC:DD:EE:02",...
  ✅ Parsed as JSON successfully

[MQTT Service] 📊 Telemetry received from hub/AA:BB:CC:DD:EE:01/telemetry/AA:BB:CC:DD:EE:02
  Hub: AA:BB:CC:DD:EE:01, Device: AA:BB:CC:DD:EE:02
  Timestamp: 2024-12-03T14:31:56.789Z
  Samples: 50
  First sample: HR=72, SpO2=98, Temp=37.2°C, Battery=85%
[MQTT Service] ✅ Telemetry queued for processing
```

#### 허브 상태 메시지
```
[MQTT Client] 📥 Message received
  Topic: hub/AA:BB:CC:DD:EE:01/status
  Size: 89 bytes
  Payload preview: {"status":"online","timestamp":"2024-12-03T14:31:56.789Z"}
  ✅ Parsed as JSON successfully

[MQTT Service] 🔌 Hub AA:BB:CC:DD:EE:01 status: {
  "status": "online",
  "timestamp": "2024-12-03T14:31:56.789Z"
}
```

#### 명령 응답
```
[MQTT Client] 📥 Message received
  Topic: hub/AA:BB:CC:DD:EE:01/response/AA:BB:CC:DD:EE:02
  Size: 156 bytes
  Payload preview: {"requestId":"req_1234567890_abc123","success":true,...
  ✅ Parsed as JSON successfully

[MQTT Service] 📨 Hub AA:BB:CC:DD:EE:01 Device AA:BB:CC:DD:EE:02 response: {
  "requestId": "req_1234567890_abc123",
  "success": true,
  "result": "LED blinked"
}
```

### 3. 명령 발행 로그

```
[MQTT Service] 📤 Sending command to hub/AA:BB:CC:DD:EE:01/command/AA:BB:CC:DD:EE:02
  RequestId: req_1234567890_abc123
  Command: {
    "action": "blink_led",
    "duration": 1000
  }

[MQTT Client] 📤 Publishing message
  Topic: hub/AA:BB:CC:DD:EE:01/command/AA:BB:CC:DD:EE:02
  QoS: 1, Retain: false
  Payload: {"action":"blink_led","duration":1000,"requestId":"req_1234567890_abc123",...}
[MQTT Client] ✅ Published successfully to hub/AA:BB:CC:DD:EE:01/command/AA:BB:CC:DD:EE:02

[MQTT Service] ✅ Command published successfully
```

### 4. Telemetry Worker 처리 로그

```
[Telemetry Worker] ✅ Processed 50 telemetry items
   Queue remaining: 23 items
```

## 🔍 로그 아이콘 설명

- 📥 **수신**: MQTT 메시지 수신
- 📤 **발행**: MQTT 메시지 발행
- 📊 **Telemetry**: 생체 데이터 (심박수, SpO2, 온도 등)
- 🔌 **허브 상태**: 허브 연결 상태
- 📨 **응답**: 명령에 대한 응답
- ✅ **성공**: 작업 성공
- ❌ **오류**: 오류 발생
- ⚠️ **경고**: 경고 메시지
- 🔄 **진행 중**: 작업 진행 중

## 📝 로그 레벨

### 개발 모드 (`NODE_ENV=development`)
- 모든 상세 로그 출력
- MQTT 메시지 페이로드 미리보기
- 데이터베이스 쿼리 로그 (선택사항)

### 프로덕션 모드 (`NODE_ENV=production`)
- 필수 로그만 출력
- 오류 및 경고 메시지
- 성능 최적화

## 🛠️ 로그 필터링

터미널에서 특정 로그만 보려면:

### Windows PowerShell
```powershell
npm run dev | Select-String "Telemetry"
npm run dev | Select-String "MQTT"
```

### Linux/Mac
```bash
npm run dev | grep "Telemetry"
npm run dev | grep "MQTT"
```

## 💡 팁

1. **로그 파일로 저장**
   ```bash
   npm run dev > logs/server.log 2>&1
   ```

2. **MQTT 모니터 서버 사용**
   - 별도 터미널에서 `mqtt-monitor` 서버 실행
   - 웹 브라우저에서 `http://localhost:3001` 접속
   - 실시간으로 모든 MQTT 메시지 확인 가능

3. **특정 디바이스만 확인**
   - 터미널에서 `Select-String` 또는 `grep` 사용
   - 예: `Select-String "AA:BB:CC:DD:EE:02"`

4. **로그가 너무 많은 경우**
   - `.env` 파일에서 `NODE_ENV=production` 설정
   - 또는 로그 레벨 조정

## 🐛 문제 해결

### 로그가 보이지 않는 경우

1. **서버가 실행 중인지 확인**
   ```bash
   # 포트 확인
   netstat -ano | findstr :5000  # Windows
   lsof -i :5000                 # Mac/Linux
   ```

2. **MQTT 브로커 연결 확인**
   - Mosquitto가 실행 중인지 확인
   - `.env` 파일의 `MQTT_BROKER_URL` 확인

3. **환경 변수 확인**
   - `NODE_ENV`가 올바르게 설정되었는지 확인

### 로그가 너무 많은 경우

1. **프로덕션 모드로 전환**
   ```env
   NODE_ENV=production
   ```

2. **특정 로그만 필터링**
   - 터미널 필터 사용
   - 로그 파일로 저장 후 검색

