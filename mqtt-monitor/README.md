# MQTT 통신 모니터 서버

백엔드와 Mosquitto MQTT 브로커 간의 양방향 통신을 실시간으로 모니터링할 수 있는 서버입니다.

## 기능

- ✅ **실시간 메시지 모니터링**: 모든 MQTT 토픽의 메시지를 실시간으로 수신 및 표시
- ✅ **양방향 통신 확인**: 수신(incoming) 및 발신(outgoing) 메시지 구분
- ✅ **통계 정보**: 메시지 수, 토픽별 통계, 방향별 통계
- ✅ **메시지 발행**: 테스트용 메시지 발행 기능
- ✅ **필터링**: 토픽 및 방향별 필터링
- ✅ **웹 인터페이스**: 실시간 대시보드 제공

## 설치 및 실행

### 1. 의존성 설치

```bash
cd mqtt-monitor
npm install
```

### 2. 환경 변수 설정

`.env` 파일 생성 (선택사항):

```env
MQTT_BROKER_URL=mqtt://localhost:1883
MONITOR_PORT=3001
```

### 3. 서버 실행

```bash
# 개발 모드 (nodemon)
npm run dev

# 프로덕션 모드
npm start
```

### 4. 웹 인터페이스 접속

브라우저에서 `http://localhost:3001` 접속

## 사용 방법

### 1. 메시지 모니터링

- 웹 인터페이스에서 실시간으로 모든 MQTT 메시지를 확인할 수 있습니다
- 메시지는 수신/발신/시스템으로 구분되어 표시됩니다
- 토픽별로 색상이 구분됩니다

### 2. 메시지 발행 (테스트)

1. "메시지 발행" 섹션에서 토픽 입력
2. 메시지 입력 (JSON 또는 텍스트)
3. QoS 및 Retain 설정
4. "발행" 버튼 클릭

예시:
- 토픽: `hub/AA:BB:CC:DD:EE:01/status`
- 메시지: `{"status": "online", "timestamp": "2024-12-03T14:31:56Z"}`

### 3. 필터링

- **토픽 필터**: 특정 토픽만 보기
- **방향 필터**: 수신/발신/시스템 메시지만 보기
- **활성 토픽**: 클릭하여 해당 토픽으로 필터링

### 4. 통계 확인

- 총 메시지 수
- 수신/발신 메시지 수
- 고유 토픽 수
- 연결된 클라이언트 수

## API 엔드포인트

### GET /api/messages
메시지 로그 조회

쿼리 파라미터:
- `limit`: 최대 개수 (기본: 100)
- `topic`: 토픽 필터
- `direction`: 방향 필터 (incoming/outgoing/system)

### GET /api/stats
통계 정보 조회

### POST /api/publish
메시지 발행

요청 본문:
```json
{
  "topic": "hub/AA:BB:CC:DD:EE:01/status",
  "message": {"status": "online"},
  "qos": 1,
  "retain": false
}
```

### POST /api/clear
로그 초기화

## 모니터링되는 토픽

모니터 서버는 모든 토픽(`#`)을 구독하므로 다음을 포함한 모든 메시지를 확인할 수 있습니다:

- `hub/{hubId}/status` - 허브 상태
- `hub/{hubId}/telemetry/{deviceId}` - Telemetry 데이터
- `hub/{hubId}/response/{deviceId}` - 명령 응답
- `hub/{hubId}/command/{deviceId}` - 명령 전송
- `backend/status` - 백엔드 상태

## 주의사항

1. **성능**: 모든 토픽을 구독하므로 대량의 메시지가 발생할 수 있습니다
2. **메모리**: 최근 1000개의 메시지만 메모리에 저장됩니다
3. **보안**: 프로덕션 환경에서는 인증을 추가하는 것을 권장합니다

## 문제 해결

### MQTT 브로커에 연결되지 않는 경우

1. Mosquitto가 실행 중인지 확인
2. `MQTT_BROKER_URL` 환경 변수 확인
3. 방화벽 설정 확인

### 메시지가 표시되지 않는 경우

1. 브로커 연결 상태 확인 (상단 상태 표시기)
2. 브라우저 콘솔에서 에러 확인
3. Socket.IO 연결 상태 확인

