# MQTT 서비스 - 동물 웨어러블 모니터링 시스템

허브(ESP32-S3)와의 양방향 통신을 위한 MQTT 서비스 모듈입니다.

## 토픽 구조

문서 요구사항에 맞춘 토픽 구조:

### 허브 → 백엔드 (구독)
- `hub/{hubId}/status` - 허브 상태 (QoS 1)
- `hub/{hubId}/telemetry/{deviceId}` - 측정 데이터 (QoS 0, 대량 데이터)
- `hub/{hubId}/response/{deviceId}` - 명령 응답 (QoS 1)

### 백엔드 → 허브 (발행)
- `hub/{hubId}/command/{deviceId}` - 디바이스 명령 (QoS 1)
- `hub/{hubId}/settings` - 허브 설정 (QoS 1, retain)

## 환경 변수 설정

`.env` 파일에 다음 변수를 추가하세요:

```env
# MQTT 브로커 설정
MQTT_BROKER_URL=mqtt://localhost:1883
MQTT_USERNAME=your_username  # 선택사항
MQTT_PASSWORD=your_password  # 선택사항
```

## Telemetry 데이터 구조

허브에서 전송되는 Telemetry 데이터 형식:

```json
{
  "device_mac_address": "AA:BB:CC:DD:EE:FF",
  "timestamp": 1735900000000,
  "starttime": 1735899999000,
  "dataArr": [
    {
      "ir": 32000,
      "red": 15000,
      "green": 9000,
      "spo2": 98,
      "hr": 82,
      "temp": 38.1,
      "battery": 88
    },
    ... 50 samples ...
  ]
}
```

## 대량 데이터 처리

- **초당 300~1000 샘플** 처리 가능
- Worker 패턴으로 비동기 처리
- Queue 기반 배치 처리 (50ms 주기)
- DB bulk insert로 성능 최적화
- WebSocket 브로드캐스트는 10Hz로 다운샘플링

## 사용 예시

### 1. 서비스에서 직접 사용

```javascript
const mqttService = req.app.get('mqtt');

// 허브에 명령 전송 (requestId 기반 RPC)
try {
  const response = await mqttService.sendCommand(
    'AA:BB:CC:DD:EE:01',  // hubId
    'AA:BB:CC:DD:EE:FF',  // deviceId
    {
      action: 'start_measurement'
    },
    200  // 타임아웃 (ms)
  );
  console.log('Command response:', response);
} catch (error) {
  console.error('Command failed:', error);
}

// 허브에 설정 전송
mqttService.sendHubSettings('AA:BB:CC:DD:EE:01', {
  interval: 1000,
  threshold: 50
});
```

### 2. HTTP API 사용

#### 명령 전송
```bash
POST /mqtt/command/:hubId/:deviceId
Content-Type: application/json

{
  "action": "start_measurement"
}
```

#### 설정 전송
```bash
POST /mqtt/settings/:hubId
Content-Type: application/json

{
  "interval": 1000,
  "threshold": 50
}
```

#### 연결 상태 확인
```bash
GET /mqtt/status
```

### 3. WebSocket 사용

```javascript
// 프론트엔드에서 명령 전송
socket.emit('CONTROL_REQUEST', {
  hubId: 'AA:BB:CC:DD:EE:01',
  deviceId: 'AA:BB:CC:DD:EE:FF',
  command: {
    action: 'led_blink'
  },
  requestId: 'req_123456'
});

// 응답 수신
socket.on('CONTROL_ACK', (data) => {
  console.log('Command acknowledged:', data);
});

socket.on('CONTROL_RESULT', (data) => {
  console.log('Command result:', data);
});

// Telemetry 데이터 수신
socket.on('TELEMETRY', (data) => {
  console.log('Telemetry:', data);
});
```

## 테스트 시뮬레이터

허브와 디바이스 없이도 백엔드를 테스트할 수 있는 시뮬레이터:

```bash
node back/test/mqttSimulator.js
```

시뮬레이터는 다음을 수행합니다:
- 허브 상태 전송
- Telemetry 데이터 자동 생성 및 전송 (50Hz)
- 명령 수신 및 응답 전송
- 최대 6개 디바이스 시뮬레이션

## 성능 요구사항

- **명령 응답 시간**: 0.2초 이하
- **Telemetry 처리량**: 초당 300~1000 샘플
- **WebSocket 브로드캐스트**: 10~30Hz (다운샘플링)
- **DB 저장**: Bulk insert로 최적화

## 파일 구조

- `client.js` - MQTT 클라이언트 연결 및 기본 기능
- `service.js` - 허브 통신을 위한 고수준 API
- `../workers/telemetryWorker.js` - 대량 데이터 처리 Worker
- `../routes/mqtt.js` - HTTP API 엔드포인트
- `../test/mqttSimulator.js` - 테스트 시뮬레이터
