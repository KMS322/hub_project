# MQTT 테스트 가이드

백엔드와 MQTT 통신을 테스트하는 방법입니다.

## 🧪 빠른 테스트

### 1. 메시지 발행 및 구독 테스트

**터미널 1: 구독 (백엔드가 자동으로 구독)**
```bash
# 백엔드 서버 실행
cd back
npm run dev
```

**터미널 2: 메시지 발행**
```bash
# Windows
C:\Program Files\mosquitto>.\mosquitto_pub.exe -h localhost -t test/topic -m "Hello from mosquitto_pub"

# 또는 JSON 메시지
C:\Program Files\mosquitto>.\mosquitto_pub.exe -h localhost -t test/topic -m "{\"message\":\"test\",\"value\":123}"
```

**터미널 3: 수동 구독 (확인용)**
```bash
C:\Program Files\mosquitto>.\mosquitto_sub.exe -h localhost -t test/topic -v
```

### 2. 백엔드에서 확인

백엔드 서버 터미널에 다음과 같이 출력됩니다:

```
[MQTT Client] 📥 Message received
  Topic: test/topic
  Size: 25 bytes
  Payload preview: Hello from mosquitto_pub
  ✅ Parsed as JSON successfully

[MQTT Service] 🔍 Debug - Received from test/topic
  Message: Hello from mosquitto_pub
```

## 📋 테스트 시나리오

### 시나리오 1: 간단한 텍스트 메시지

**발행:**
```bash
.\mosquitto_pub.exe -h localhost -t test/topic -m "Test message"
```

**예상 결과:**
- 백엔드 터미널에 메시지 수신 로그 출력
- MQTT 모니터 서버에 메시지 표시
- `mosquitto_sub`에 메시지 표시

### 시나리오 2: JSON 메시지

**발행:**
```bash
.\mosquitto_pub.exe -h localhost -t test/topic -m "{\"type\":\"test\",\"data\":{\"value\":123}}"
```

**예상 결과:**
- 백엔드에서 JSON 파싱 성공 로그
- 파싱된 객체가 로그에 출력

### 시나리오 3: 허브 토픽 테스트

**발행:**
```bash
.\mosquitto_pub.exe -h localhost -t hub/AA:BB:CC:DD:EE:01/status -m "{\"status\":\"online\"}"
```

**예상 결과:**
- 백엔드에서 허브 상태로 처리
- `handleHubStatus` 함수 실행
- Socket.IO로 프론트엔드에 전송

### 시나리오 4: Telemetry 데이터 테스트

**발행:**
```bash
.\mosquitto_pub.exe -h localhost -t hub/AA:BB:CC:DD:EE:01/telemetry/AA:BB:CC:DD:EE:02 -m "{\"device_mac_address\":\"AA:BB:CC:DD:EE:02\",\"timestamp\":1735900000000,\"dataArr\":[{\"hr\":72,\"spo2\":98,\"temp\":37.2,\"battery\":85}]}"
```

**예상 결과:**
- Telemetry Worker에서 처리
- 데이터베이스에 저장
- CSV 파일에 기록
- Socket.IO로 프론트엔드에 전송

## 🔍 문제 해결

### 문제 1: 백엔드에서 메시지가 안 보이는 경우

**확인 사항:**
1. 백엔드 서버가 실행 중인지 확인
2. `NODE_ENV=development`로 설정되어 있는지 확인
3. MQTT 브로커 연결 상태 확인

**해결:**
```bash
# .env 파일 확인
NODE_ENV=development
MQTT_BROKER_URL=mqtt://localhost:1883
```

### 문제 2: `mosquitto_sub`에서 메시지가 안 보이는 경우

**원인:** 구독만 하고 있으면 메시지를 받을 수 없습니다. 메시지를 발행해야 합니다.

**해결:**
- 다른 터미널에서 `mosquitto_pub`로 메시지 발행
- 또는 MQTT 모니터 서버에서 메시지 발행 기능 사용

### 문제 3: MQTT 모니터에서만 보이는 경우

**원인:** 
- 백엔드가 해당 토픽을 구독하지 않음
- 개발 모드가 아닌 경우

**해결:**
1. `.env` 파일에서 `NODE_ENV=development` 확인
2. 백엔드 서버 재시작
3. 백엔드 터미널에서 구독 로그 확인:
   ```
   [MQTT Service] 🔍 Debug mode: Subscribed to all topics (#)
   ```

## 📊 테스트 체크리스트

- [ ] 백엔드 서버 실행 (`npm run dev`)
- [ ] MQTT 모니터 서버 실행 (선택사항)
- [ ] `mosquitto_sub`로 구독 (확인용)
- [ ] `mosquitto_pub`로 메시지 발행
- [ ] 백엔드 터미널에서 메시지 수신 확인
- [ ] MQTT 모니터에서 메시지 확인
- [ ] `mosquitto_sub`에서 메시지 확인

## 💡 팁

1. **여러 터미널 사용**
   - 터미널 1: 백엔드 서버
   - 터미널 2: 메시지 발행 (`mosquitto_pub`)
   - 터미널 3: 수동 구독 (`mosquitto_sub`)
   - 터미널 4: MQTT 모니터 서버 (선택)

2. **JSON 메시지 테스트**
   ```bash
   # PowerShell에서 JSON 이스케이프
   .\mosquitto_pub.exe -h localhost -t test/topic -m '{\"test\":\"value\"}'
   ```

3. **QoS 테스트**
   ```bash
   # QoS 1로 발행
   .\mosquitto_pub.exe -h localhost -t test/topic -m "Test" -q 1
   ```

4. **Retain 메시지 테스트**
   ```bash
   # Retain으로 발행 (구독 시 즉시 받음)
   .\mosquitto_pub.exe -h localhost -t test/topic -m "Retained message" -r
   ```

