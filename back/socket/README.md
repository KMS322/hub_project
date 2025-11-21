# Socket.IO 사용 가이드

## 클라이언트 연결 방법

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:5000', {
  auth: {
    token: 'your_jwt_token_here'
  }
});

// 또는 헤더로 전송
const socket = io('http://localhost:5000', {
  extraHeaders: {
    Authorization: 'Bearer your_jwt_token_here'
  }
});
```

## 이벤트 목록

### 클라이언트 → 서버

- `device:status` - 디바이스 상태 업데이트
- `device:control` - 디바이스 제어 명령

### 서버 → 클라이언트

- `connected` - 연결 성공 시 수신
- `device:status:update` - 디바이스 상태 업데이트 브로드캐스트
- `device:control:command` - 디바이스 제어 명령 브로드캐스트

## 예시 코드

```javascript
// 연결 이벤트
socket.on('connected', (data) => {
  console.log('Connected:', data);
});

// 디바이스 상태 전송
socket.emit('device:status', {
  deviceId: 'device_123',
  status: 'online',
  data: { temperature: 25 }
});

// 디바이스 상태 업데이트 수신
socket.on('device:status:update', (data) => {
  console.log('Device status updated:', data);
});

// 디바이스 제어 명령 전송
socket.emit('device:control', {
  deviceId: 'device_123',
  command: 'turn_on'
});

// 디바이스 제어 명령 수신
socket.on('device:control:command', (data) => {
  console.log('Control command received:', data);
});
```
