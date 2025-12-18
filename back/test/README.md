# 테스트 시뮬레이터

허브와 디바이스 없이도 백엔드 시스템을 테스트할 수 있는 MQTT 시뮬레이터입니다.

## MQTT 시뮬레이터

### 실행 방법

```bash
# 환경 변수 설정 (선택사항)
export MQTT_BROKER_URL=mqtt://localhost:1883

# 시뮬레이터 실행
node back/test/mqttSimulator.js
```

### 기능

1. **허브 상태 시뮬레이션**
   - 허브 온라인 상태 전송
   - 연결된 디바이스 수 표시

2. **Telemetry 데이터 자동 생성**
   - 50Hz (초당 50개 샘플) 데이터 생성
   - 최대 6개 디바이스 동시 시뮬레이션
   - 실제 데이터 구조와 동일한 형식

3. **명령 응답 시뮬레이션**
   - 백엔드에서 보낸 명령 수신
   - 적절한 응답 자동 전송
   - requestId 기반 매칭

4. **설정 수신**
   - 허브 설정 수신 및 처리

### 사용 예시

```javascript
const MQTTSimulator = require('./mqttSimulator');

const simulator = new MQTTSimulator('mqtt://localhost:1883');
simulator.connect();

// Telemetry 시작
setTimeout(() => {
  simulator.startTelemetry('AA:BB:CC:DD:EE:01', 'AA:BB:CC:DD:EE:FF', 20);
}, 2000);

// Telemetry 중지
simulator.stopTelemetry('AA:BB:CC:DD:EE:01', 'AA:BB:CC:DD:EE:FF');
```

### 테스트 시나리오

1. **대량 데이터 처리 테스트**
   - 6개 디바이스 × 50Hz = 300 샘플/초
   - Worker가 정상적으로 처리하는지 확인

2. **명령-응답 테스트**
   - 측정 시작/정지 명령
   - LED 깜빡임 명령
   - 0.2초 이하 응답 시간 확인

3. **WebSocket 브로드캐스트 테스트**
   - 프론트엔드에서 실시간 데이터 수신 확인
   - 다운샘플링 적용 확인

## 주의사항

- MQTT 브로커가 실행 중이어야 합니다
- 테스트 전에 데이터베이스가 초기화되어 있어야 합니다
- 시뮬레이터는 개발/테스트 환경에서만 사용하세요

