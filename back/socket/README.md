# Socket.IO 사용 가이드

백엔드와 프론트엔드 간의 실시간 양방향 통신을 위한 Socket.IO 가이드입니다.

## 백엔드 설정

백엔드는 이미 Socket.IO 서버로 설정되어 있으며, 다음 이벤트를 지원합니다:

### 서버 → 클라이언트 이벤트

- `connected` - 연결 성공 시 수신
- `CONTROL_ACK` - 명령 수신 확인
- `CONTROL_RESULT` - 명령 실행 결과
- `TELEMETRY` - 실시간 측정 데이터
- `DEVICE_STATUS` - 디바이스 상태 정보
- `HUB_STATUS` - 허브 상태 정보

### 클라이언트 → 서버 이벤트

- `CONTROL_REQUEST` - 기기 제어 명령 전송
- `GET_DEVICE_STATUS` - 디바이스 상태 조회 요청

## 프론트엔드 연결 방법

### 1. Socket Service 사용 (권장)

```javascript
import socketService from './services/socketService';
import { useAuthStore } from './stores/useAuthStore';

const { token } = useAuthStore();

// 연결
socketService.connect(token);

// 이벤트 리스너 등록
socketService.on('TELEMETRY', (data) => {
  console.log('Telemetry data:', data);
});

// 이벤트 발송
socketService.emit('CONTROL_REQUEST', {
  hubId: 'AA:BB:CC:DD:EE:01',
  deviceId: 'AA:BB:CC:DD:EE:FF',
  command: { action: 'start_measurement' },
  requestId: `req_${Date.now()}`
});

// 연결 해제
socketService.disconnect();
```

### 2. useSocket 훅 사용 (React 컴포넌트)

```javascript
import { useSocket } from '../hooks/useSocket';

function MyComponent() {
  const { isConnected, on, emit } = useSocket();

  useEffect(() => {
    if (!isConnected) return;

    // TELEMETRY 데이터 수신
    const handleTelemetry = (data) => {
      console.log('Received telemetry:', data);
    };

    on('TELEMETRY', handleTelemetry);

    return () => {
      off('TELEMETRY', handleTelemetry);
    };
  }, [isConnected, on, off]);

  const sendCommand = () => {
    emit('CONTROL_REQUEST', {
      hubId: 'AA:BB:CC:DD:EE:01',
      deviceId: 'AA:BB:CC:DD:EE:FF',
      command: { action: 'led_blink' },
      requestId: `req_${Date.now()}`
    });
  };

  return (
    <div>
      {isConnected ? '연결됨' : '연결 안 됨'}
      <button onClick={sendCommand}>명령 전송</button>
    </div>
  );
}
```

## 이벤트 상세 설명

### CONTROL_REQUEST (프론트 → 백엔드)

기기 제어 명령을 전송합니다.

```javascript
socketService.emit('CONTROL_REQUEST', {
  hubId: 'AA:BB:CC:DD:EE:01',      // 허브 MAC 주소
  deviceId: 'AA:BB:CC:DD:EE:FF',    // 디바이스 MAC 주소
  command: {
    action: 'start_measurement'     // 명령 타입
    // 또는 'stop_measurement', 'led_blink' 등
  },
  requestId: 'req_1234567890'       // 요청 ID (선택사항)
});
```

### CONTROL_ACK (백엔드 → 프론트)

명령이 수신되었음을 확인합니다.

```javascript
socketService.on('CONTROL_ACK', (data) => {
  console.log('Command acknowledged:', data);
  // {
  //   requestId: 'req_1234567890',
  //   hubId: 'AA:BB:CC:DD:EE:01',
  //   deviceId: 'AA:BB:CC:DD:EE:FF',
  //   command: { action: 'start_measurement' },
  //   timestamp: '2024-12-03T14:31:56.789Z'
  // }
});
```

### CONTROL_RESULT (백엔드 → 프론트)

명령 실행 결과를 받습니다.

```javascript
socketService.on('CONTROL_RESULT', (data) => {
  if (data.success) {
    console.log('Command succeeded:', data);
  } else {
    console.error('Command failed:', data.error);
  }
  // {
  //   requestId: 'req_1234567890',
  //   hubId: 'AA:BB:CC:DD:EE:01',
  //   deviceId: 'AA:BB:CC:DD:EE:FF',
  //   success: true,
  //   data: { ... },
  //   timestamp: '2024-12-03T14:31:56.789Z'
  // }
});
```

### TELEMETRY (백엔드 → 프론트)

실시간 측정 데이터를 받습니다.

```javascript
socketService.on('TELEMETRY', (data) => {
  if (data.type === 'sensor_data') {
    const { hubId, deviceId, data: telemetryData } = data;
    
    // dataArr가 있는 경우 (배치 데이터)
    if (telemetryData.dataArr) {
      telemetryData.dataArr.forEach(sample => {
        console.log('Sample:', {
          ir: sample.ir,
          red: sample.red,
          green: sample.green,
          spo2: sample.spo2,
          hr: sample.hr,
          temp: sample.temp,
          battery: sample.battery
        });
      });
    } else {
      // 단일 샘플
      console.log('Single sample:', telemetryData);
    }
  }
});
```

### GET_DEVICE_STATUS (프론트 → 백엔드)

디바이스 상태를 조회합니다.

```javascript
socketService.emit('GET_DEVICE_STATUS', {
  deviceId: 'AA:BB:CC:DD:EE:FF'
  // 또는 hubId: 'AA:BB:CC:DD:EE:01'
});

// 응답: DEVICE_STATUS 또는 HUB_STATUS 이벤트로 수신
socketService.on('DEVICE_STATUS', (data) => {
  console.log('Device status:', data);
});
```

## 인증

Socket.IO 연결 시 JWT 토큰이 필요합니다. 토큰은 다음 방법으로 전달할 수 있습니다:

```javascript
// 방법 1: auth 옵션 사용 (권장)
socketService.connect(token, 'http://localhost:5000');

// 방법 2: 직접 io 사용
import { io } from 'socket.io-client';

const socket = io('http://localhost:5000', {
  auth: {
    token: 'your_jwt_token_here'
  }
});
```

## 연결 상태 확인

```javascript
// Socket Service 사용
const isConnected = socketService.getConnectionStatus();

// useSocket 훅 사용
const { isConnected } = useSocket();
```

## 에러 처리

```javascript
socketService.on('connect_error', (error) => {
  console.error('Connection error:', error);
  // 인증 실패 시 'Authentication error' 메시지
});

socketService.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
  // 자동 재연결 시도
});
```

## 예시: Monitoring 페이지

```javascript
import { useSocket } from '../hooks/useSocket';

function Monitoring() {
  const { isConnected, on, emit } = useSocket();
  const [telemetryData, setTelemetryData] = useState([]);

  useEffect(() => {
    if (!isConnected) return;

    const handleTelemetry = (data) => {
      if (data.type === 'sensor_data') {
        setTelemetryData(prev => [...prev, data.data].slice(-100));
      }
    };

    on('TELEMETRY', handleTelemetry);

    return () => {
      off('TELEMETRY', handleTelemetry);
    };
  }, [isConnected, on, off]);

  const startMeasurement = () => {
    emit('CONTROL_REQUEST', {
      hubId: 'AA:BB:CC:DD:EE:01',
      deviceId: 'AA:BB:CC:DD:EE:FF',
      command: { action: 'start_measurement' },
      requestId: `req_${Date.now()}`
    });
  };

  return (
    <div>
      <div>연결 상태: {isConnected ? '연결됨' : '연결 안 됨'}</div>
      <button onClick={startMeasurement}>측정 시작</button>
      {/* 차트 표시 */}
    </div>
  );
}
```

## 주의사항

1. **토큰 필수**: Socket.IO 연결 시 유효한 JWT 토큰이 필요합니다.
2. **자동 재연결**: 연결이 끊어지면 자동으로 재연결을 시도합니다.
3. **이벤트 정리**: 컴포넌트 언마운트 시 이벤트 리스너를 제거해야 합니다.
4. **CORS 설정**: 백엔드의 CORS 설정이 프론트엔드 URL을 허용해야 합니다.
