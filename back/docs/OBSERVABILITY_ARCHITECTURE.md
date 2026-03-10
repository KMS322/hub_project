# 3-Tier Observability Architecture (Error Framework)

## 목표

- **PM2 로그**: 서버 상태·에러 한 줄 JSON
- **DB 로그**: 에러 히스토리·분석
- **Realtime 로그**: 관리자 페이지 실시간 스트림

모든 통신 오류가 하나의 **Error Framework**를 거쳐 위 3곳으로 동시에 기록됩니다.

## 전체 흐름

```
Device
  │
MQTT Broker
  │
MQTT Handler (mqtt/service.js)
  │
Error Framework (core/error)
  │
  ├─ PM2 Log   (console.error JSON)
  ├─ Database  (server_errors)
  └─ Realtime  (Socket.io → admin/errors)
  │
Socket.io
  │
Frontend → Admin Monitoring Dashboard
```

## 폴더 구조

```
back/
  core/
    error/
      errorCodes.js   # channel, reason 상수
      errorFactory.js # createError() → ServerError
      errorLogger.js  # logError() → PM2 + DB + Realtime
      errorStream.js  # setSocketInstance(), broadcastError()
      index.js
  database/
    errorRepository.js # saveError, findPaginated, getStats, getDeviceErrorStats
  admin/
    adminErrorController.js # getErrors, getStats, getErrorsByDevice, getDeviceStats
  routes/
    admin.js          # /api/admin/errors, /health
  middlewares/
    errorHandler.js   # HTTP → createError + logError
```

## 사용법 (Transport 레이어)

에러 발생 시 **createError → logError** 한 번만 호출하면 됩니다.

```js
const { createError, ERROR_REASON } = require('../core/error/errorFactory');
const { logError } = require('../core/error/errorLogger');

// MQTT payload 초과
const err = createError('mqtt', ERROR_REASON.PAYLOAD_TOO_LARGE, 'MQTT payload too large', `size=${size}`, { payloadSize: size, topic });
logError(err);

// Socket 필수 필드 누락
const err = createError('socket', ERROR_REASON.MISSING_FIELD, 'hubId, deviceId required', '', { deviceId });
logError(err);
```

**logError(serverError)** 한 번으로:

1. PM2용 JSON 한 줄 출력
2. DB `server_errors` 저장 (비동기)
3. Socket.io `admin/errors` room으로 `server-error` 이벤트 전송

## Queue 구조 (MQTT → Queue → Worker → Socket)

현재 구조는 이미 **Queue + Worker** 형태입니다.

- **MQTT** → `telemetryQueue` (배열) push
- **TelemetryWorker** → 주기적으로 큐에서 꺼내 처리 → DB/CSV/브로드캐스트 버퍼
- **broadcastBuffered** → Socket.io로 TELEMETRY 전송

트래픽이 커지면 `telemetryQueue`를 Redis/Kafka 등으로 교체하면 됩니다.

## PM2 로그 로테이션

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 50M
pm2 set pm2-logrotate:retain 30
pm2 set pm2-logrotate:compress true
```

## 관리자 API

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /api/admin/errors | 페이지네이션·필터 (code, channel, deviceId, 기간, keyword) |
| GET | /api/admin/errors/stats | byCode, byChannel, total, last24h |
| GET | /api/admin/errors/device/:deviceId | 디바이스별 에러 목록 |
| GET | /api/admin/errors/device-stats | 디바이스별 에러 건수 (상위 100) |
| GET | /api/admin/health | mqtt.connected, socket.connectionCount, queue.length, uptimeSeconds |

모두 `Authorization: Bearer <token>` 필요 (verifyToken).
