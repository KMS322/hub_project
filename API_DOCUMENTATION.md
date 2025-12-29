# API 문서

## 인증

### 회원가입
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "hospital@example.com",
  "password": "password123",
  "name": "동물병원",
  "postcode": "12345",
  "address": "서울시 강남구",
  "detail_address": "123번지",
  "phone": "02-1234-5678"
}
```

**응답:**
```json
{
  "success": true,
  "message": "회원가입이 완료되었습니다.",
  "data": {
    "user": {
      "email": "hospital@example.com",
      "name": "동물병원",
      ...
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### 로그인
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "hospital@example.com",
  "password": "password123"
}
```

**응답:**
```json
{
  "success": true,
  "message": "로그인에 성공했습니다.",
  "data": {
    "user": { ... },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### 현재 사용자 정보
```http
GET /api/auth/me
Authorization: Bearer {token}
```

**응답:**
```json
{
  "success": true,
  "data": {
    "user": {
      "email": "hospital@example.com",
      "name": "동물병원",
      ...
    }
  }
}
```

---

## 허브 관리

### 허브 목록 조회
```http
GET /api/hub
Authorization: Bearer {token}
```

**응답:**
```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "id": "AA:BB:CC:DD:EE:01",
      "address": "AA:BB:CC:DD:EE:01",
      "name": "허브 1",
      "connectedDevices": 3,
      "updatedAt": "2024-12-03T14:31:56.789Z"
    }
  ]
}
```

### 허브 등록
```http
POST /api/hub
Authorization: Bearer {token}
Content-Type: application/json

{
  "mac_address": "AA:BB:CC:DD:EE:01",
  "name": "허브 1",
  "wifi_id": "WiFi_SSID",
  "wifi_password": "WiFi_Password"
}
```

---

## 디바이스 관리

### 디바이스 목록 조회
```http
GET /api/device
Authorization: Bearer {token}
```

**응답:**
```json
{
  "success": true,
  "count": 3,
  "data": [
    {
      "id": "AA:BB:CC:DD:EE:02",
      "address": "AA:BB:CC:DD:EE:02",
      "name": "디바이스 1",
      "hub_address": "AA:BB:CC:DD:EE:01",
      "hubName": "허브 1",
      "connectedPatient": {
        "id": 1,
        "name": "뽀삐",
        "species": "개",
        "breed": "골든 리트리버"
      },
      "status": "connected",
      "updatedAt": "2024-12-03T14:31:56.789Z"
    }
  ]
}
```

---

## 환자 관리

### 환자 목록 조회
```http
GET /api/pet
Authorization: Bearer {token}
```

**응답:**
```json
{
  "success": true,
  "count": 5,
  "data": [
    {
      "id": 1,
      "name": "뽀삐",
      "species": "개",
      "breed": "골든 리트리버",
      "weight": "25kg",
      "gender": "수컷",
      "neutering": "중성화",
      "connectedDevice": {
        "id": "AA:BB:CC:DD:EE:02",
        "name": "디바이스 1",
        "hubName": "허브 1"
      },
      "status": "admitted"
    }
  ]
}
```

### 환자 등록
```http
POST /api/pet
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "뽀삐",
  "species": "개",
  "breed": "골든 리트리버",
  "weight": "25kg",
  "gender": "수컷",
  "neutering": "중성화",
  "birthDate": "2020-01-01",
  "admissionDate": "2024-12-03",
  "veterinarian": "홍길동",
  "diagnosis": "감기",
  "medicalHistory": "과거 병력 없음",
  "device_address": "AA:BB:CC:DD:EE:02"
}
```

---

## 기록 관리

### 기록 목록 조회
```http
GET /api/records
Authorization: Bearer {token}
```

**응답:**
```json
{
  "success": true,
  "files": [
    {
      "date": "2024-12-03",
      "device": "AA_BB_CC_DD_EE_02",
      "deviceAddress": "AA:BB:CC:DD:EE:02",
      "deviceName": "디바이스 1",
      "pet": "뽀삐",
      "filename": "AA_BB_CC_DD_EE_02_뽀삐_14_31_56_789.csv",
      "size": 12345,
      "mtime": "2024-12-03T14:31:56.789Z",
      "relativePath": "2024-12-03/AA_BB_CC_DD_EE_02/뽀삐/AA_BB_CC_DD_EE_02_뽀삐_14_31_56_789.csv",
      "startTime": "2024-12-03T14:31:56.789Z",
      "endTime": "2024-12-03T14:35:20.123Z",
      "recordCount": 10000
    }
  ]
}
```

---

## Socket.IO 이벤트

### 클라이언트 → 서버

#### CONTROL_REQUEST
디바이스 제어 명령 전송
```javascript
socket.emit('CONTROL_REQUEST', {
  hubId: 'AA:BB:CC:DD:EE:01',
  deviceId: 'AA:BB:CC:DD:EE:02',
  command: {
    action: 'start_measurement',
    raw_command: 'start:AA:BB:CC:DD:EE:02'
  },
  requestId: 'req_1234567890'
})
```

### 서버 → 클라이언트

#### TELEMETRY
실시간 텔레메트리 데이터
```javascript
socket.on('TELEMETRY', (data) => {
  // data.type === 'sensor_data'
  // data.hubId
  // data.deviceId
  // data.data: { hr, spo2, temp, battery, dataArr, ... }
})
```

#### CONNECTED_DEVICES
연결된 디바이스 목록
```javascript
socket.on('CONNECTED_DEVICES', (payload) => {
  // payload.hubAddress
  // payload.connected_devices: ['AA:BB:CC:DD:EE:02', ...]
})
```

#### CONTROL_ACK
명령 수신 확인
```javascript
socket.on('CONTROL_ACK', (data) => {
  // data.requestId
  // data.hubId
  // data.deviceId
  // data.command
})
```

#### CONTROL_RESULT
명령 실행 결과
```javascript
socket.on('CONTROL_RESULT', (data) => {
  // data.requestId
  // data.success
  // data.error (실패 시)
  // data.data (성공 시)
})
```

---

## 에러 코드

### HTTP 상태 코드

| 코드 | 설명 |
|------|------|
| 200 | 성공 |
| 201 | 생성 성공 |
| 400 | 잘못된 요청 |
| 401 | 인증 실패 |
| 403 | 권한 없음 |
| 404 | 리소스 없음 |
| 409 | 중복 리소스 |
| 500 | 서버 오류 |
| 503 | 서비스 불가 |

### 응답 형식

**성공:**
```json
{
  "success": true,
  "message": "성공 메시지",
  "data": { ... }
}
```

**실패:**
```json
{
  "success": false,
  "message": "에러 메시지",
  "error": "상세 에러 메시지 (개발 모드만)"
}
```


