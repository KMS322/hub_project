# Hub Project - 동물 웨어러블 모니터링 시스템

동물(반려동물)의 생체 신호를 실시간으로 모니터링하고 HRV(심박 변이도) 분석을 제공하는 웹 애플리케이션입니다.

## 📋 목차

1. [프로젝트 개요](#프로젝트-개요)
2. [기술 스택](#기술-스택)
3. [프로젝트 구조](#프로젝트-구조)
4. [설치 및 실행](#설치-및-실행)
5. [환경 변수 설정](#환경-변수-설정)
6. [데이터베이스 모델](#데이터베이스-모델)
7. [API 엔드포인트](#api-엔드포인트)
8. [주요 기능](#주요-기능)
9. [프론트엔드 구조](#프론트엔드-구조)
10. [보안 및 에러 처리](#보안-및-에러-처리)
11. [배포 가이드](#배포-가이드)

---

## 프로젝트 개요

### 목적
동물 병원에서 입원 중인 환자(반려동물)의 생체 신호(심박수, 산소포화도, 체온)를 실시간으로 모니터링하고, HRV 분석을 통해 스트레스 상태를 평가하는 시스템입니다.

### 주요 특징
- **실시간 모니터링**: Socket.IO와 MQTT를 통한 실시간 생체 신호 수신
- **HRV 분석**: CSV 파일 기반 HRV 분석 및 시각화
- **하드웨어 관리**: 허브 및 디바이스 등록 및 관리
- **환자 관리**: 환자 정보 관리 및 디바이스 연결
- **기록 관리**: 측정 데이터 CSV 파일 관리
- **반응형 디자인**: 모바일, 태블릿, 데스크톱 지원

---

## 기술 스택

### 백엔드
- **Runtime**: Node.js
- **Framework**: Express.js 5.1.0
- **Database**: MySQL (Sequelize ORM 6.37.7)
- **Real-time**: Socket.IO 4.8.1
- **MQTT**: mqtt 5.14.1
- **Authentication**: JWT (jsonwebtoken 9.0.2)
- **Password Hashing**: bcryptjs 3.0.3

### 프론트엔드
- **Framework**: React 19.2.0
- **Build Tool**: Vite 7.2.2
- **Routing**: React Router DOM 7.9.6
- **State Management**: Zustand 5.0.8
- **HTTP Client**: Axios 1.13.2
- **Real-time**: Socket.IO Client 4.8.1
- **Charts**: Recharts 3.6.0

---

## 프로젝트 구조

```
hub_project/
├── back/                          # 백엔드 서버
│   ├── config/                    # 설정 파일
│   │   └── config.js             # 데이터베이스 설정
│   ├── models/                    # Sequelize 모델
│   │   ├── User.js               # 사용자 모델
│   │   ├── Pet.js                # 환자(펫) 모델
│   │   ├── Hub.js                # 허브 모델
│   │   ├── Device.js             # 디바이스 모델
│   │   ├── Telemetry.js          # 텔레메트리 데이터 모델
│   │   └── index.js              # 모델 인덱스
│   ├── routes/                    # API 라우트
│   │   ├── auth.js               # 인증 API
│   │   ├── hub.js                # 허브 관리 API
│   │   ├── device.js              # 디바이스 관리 API
│   │   ├── pet.js                # 환자 관리 API
│   │   ├── records.js            # 기록 관리 API
│   │   ├── csv.js                # CSV 파일 API
│   │   ├── hrv.js                # HRV 분석 API
│   │   ├── telemetry.js          # 텔레메트리 API
│   │   ├── measurement.js        # 측정 제어 API
│   │   ├── mqtt.js               # MQTT 제어 API
│   │   └── check.js              # 상태 체크 API
│   ├── middlewares/               # 미들웨어
│   │   └── auth.js               # JWT 인증 미들웨어
│   ├── mqtt/                      # MQTT 클라이언트
│   │   ├── client.js             # MQTT 클라이언트
│   │   └── service.js             # MQTT 서비스
│   ├── socket/                    # Socket.IO 핸들러
│   │   └── index.js              # Socket.IO 이벤트 처리
│   ├── workers/                   # 백그라운드 워커
│   │   └── telemetryWorker.js    # 텔레메트리 처리 워커
│   ├── utils/                     # 유틸리티 함수
│   │   ├── csvWriter.js          # CSV 파일 작성
│   │   ├── validation.js        # 입력 검증
│   │   ├── heartRateProcessor.js # 심박수 처리
│   │   └── signalProcessor.js    # 신호 처리
│   ├── seeders/                   # 초기 데이터
│   │   └── init.js               # 더미 데이터 생성
│   ├── csv_files/                 # CSV 파일 저장 디렉토리
│   ├── server.js                  # 서버 진입점
│   └── package.json
│
├── front/                         # 프론트엔드 애플리케이션
│   ├── src/
│   │   ├── pages/                 # 페이지 컴포넌트
│   │   │   ├── Login.js          # 로그인
│   │   │   ├── Register.js       # 회원가입
│   │   │   ├── Dashboard.js      # 대시보드
│   │   │   ├── Hardware.js       # 하드웨어 관리
│   │   │   ├── Patients.js        # 환자 관리
│   │   │   ├── Records.js         # 기록 관리
│   │   │   ├── HrvAnalysis.js     # HRV 분석
│   │   │   ├── Monitoring.js      # 실시간 모니터링
│   │   │   └── Profile.js         # 내정보
│   │   ├── components/            # 재사용 컴포넌트
│   │   │   ├── Header.js         # 헤더 (네비게이션)
│   │   │   ├── Toast.jsx         # 토스트 알림
│   │   │   ├── LoadingSpinner.jsx # 로딩 스피너
│   │   │   ├── Skeleton.jsx       # 스켈레톤 UI
│   │   │   ├── EmptyState.jsx     # 빈 상태
│   │   │   ├── ErrorState.jsx     # 에러 상태
│   │   │   └── hrv/               # HRV 분석 컴포넌트
│   │   ├── api/                   # API 서비스
│   │   │   ├── axios.js          # Axios 인스턴스
│   │   │   ├── authService.js    # 인증 API
│   │   │   ├── hubService.js     # 허브 API
│   │   │   ├── deviceService.js  # 디바이스 API
│   │   │   ├── petService.js     # 환자 API
│   │   │   ├── recordsService.js  # 기록 API
│   │   │   └── hrvService.js     # HRV API
│   │   ├── hooks/                 # 커스텀 훅
│   │   │   ├── useSocket.js      # Socket.IO 훅
│   │   │   └── useToast.js       # 토스트 훅
│   │   ├── stores/                # 상태 관리
│   │   │   └── useAuthStore.js   # 인증 상태 (Zustand)
│   │   ├── services/              # 서비스
│   │   │   ├── socketService.js  # Socket.IO 서비스
│   │   │   └── mqttService.js    # MQTT 서비스
│   │   ├── utils/                 # 유틸리티
│   │   │   ├── validation.js     # 입력 검증
│   │   │   ├── toastManager.js   # 토스트 관리
│   │   │   └── hardwareErrorDetector.js # 하드웨어 오류 감지
│   │   ├── constants.js          # 상수
│   │   ├── App.js                 # 앱 진입점
│   │   └── main.js                # React 진입점
│   └── package.json
│
└── README.md                      # 프로젝트 문서 (이 파일)
```

---

## 설치 및 실행

### 사전 요구사항
- Node.js (v16 이상)
- MySQL (v8.0 이상)
- MQTT Broker (Mosquitto 등)

### 1. 저장소 클론
```bash
git clone <repository-url>
cd hub_project
```

### 2. 백엔드 설정

```bash
cd back
npm install
```

`.env` 파일 생성:
```env
# 서버 설정
PORT=5000
NODE_ENV=development

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
JWT_SECRET=your_jwt_secret_key_minimum_32_characters
JWT_EXPIRES_IN=24h
```

### 3. 프론트엔드 설정

```bash
cd front
npm install
```

`.env` 파일 생성 (선택사항):
```env
VITE_API_URL=http://localhost:5000
VITE_MQTT_BROKER_URL=ws://localhost:9001
```

### 4. 데이터베이스 생성

MySQL에서 데이터베이스 생성:
```sql
CREATE DATABASE hubProjectDB CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;
```

### 5. 서버 실행

**개발 모드 (백엔드):**
```bash
cd back
npm run dev
```

**개발 모드 (프론트엔드):**
```bash
cd front
npm run dev
```

**동시 실행 (루트 디렉토리):**
```bash
npm run dev
```

### 6. 접속
- 프론트엔드: http://localhost:5173
- 백엔드 API: http://localhost:5000
- Socket.IO: http://localhost:5000

---

## 환경 변수 설정

### 백엔드 (.env)

| 변수명 | 설명 | 기본값 | 필수 |
|--------|------|--------|------|
| `PORT` | 서버 포트 | 5000 | ❌ |
| `NODE_ENV` | 환경 (development/production) | development | ❌ |
| `DB_USERNAME` | MySQL 사용자명 | root | ✅ |
| `DB_PASSWORD` | MySQL 비밀번호 | - | ✅ |
| `DB_DATABASE` | 데이터베이스 이름 | hubProjectDB | ✅ |
| `DB_HOST` | MySQL 호스트 | 127.0.0.1 | ❌ |
| `DB_PORT` | MySQL 포트 | 3306 | ❌ |
| `DB_LOGGING` | SQL 쿼리 로깅 | false | ❌ |
| `MQTT_BROKER_URL` | MQTT 브로커 URL | mqtt://localhost:1883 | ✅ |
| `MQTT_USERNAME` | MQTT 사용자명 | - | ❌ |
| `MQTT_PASSWORD` | MQTT 비밀번호 | - | ❌ |
| `JWT_SECRET` | JWT 시크릿 키 (최소 32자) | - | ✅ |
| `JWT_EXPIRES_IN` | JWT 만료 시간 | 24h | ❌ |

### 프론트엔드 (.env)

| 변수명 | 설명 | 기본값 | 필수 |
|--------|------|--------|------|
| `VITE_API_URL` | 백엔드 API URL | http://localhost:5000 | ❌ |
| `VITE_MQTT_BROKER_URL` | MQTT WebSocket URL | ws://localhost:9001 | ❌ |

---

## 데이터베이스 모델

### User (사용자)
- `email` (PK): 이메일 주소
- `password`: 해시된 비밀번호
- `name`: 병원명
- `postcode`: 우편번호
- `address`: 주소
- `detail_address`: 상세주소
- `phone`: 전화번호

**관계**: 
- `hasMany` Hub
- `hasMany` Pet

### Hub (허브)
- `address` (PK): MAC 주소
- `name`: 허브 이름
- `user_email` (FK): 사용자 이메일
- `is_change`: 변경 여부

**관계**:
- `belongsTo` User
- `hasMany` Device

### Device (디바이스)
- `address` (PK): MAC 주소
- `name`: 디바이스 이름
- `hub_address` (FK): 허브 MAC 주소
- `user_email` (FK): 사용자 이메일

**관계**:
- `belongsTo` Hub
- `belongsTo` User
- `hasOne` Pet

### Pet (환자/펫)
- `id` (PK): 자동 증가 ID
- `name`: 환자 이름
- `species`: 종 (개, 고양이 등)
- `breed`: 품종
- `weight`: 체중
- `gender`: 성별
- `neutering`: 중성화 여부
- `birthDate`: 생년월일
- `admissionDate`: 입원일
- `veterinarian`: 담당 수의사
- `diagnosis`: 진단명
- `medicalHistory`: 병력
- `user_email` (FK): 사용자 이메일
- `device_address` (FK): 연결된 디바이스 MAC 주소
- `state`: 상태 (입원중/퇴원)

**관계**:
- `belongsTo` User
- `belongsTo` Device

### Telemetry (텔레메트리 데이터)
- `id` (PK): 자동 증가 ID
- `hub_address` (FK): 허브 MAC 주소
- `device_address` (FK): 디바이스 MAC 주소
- `timestamp`: 샘플 타임스탬프 (BIGINT)
- `starttime`: 측정 시작 시각 (BIGINT)
- `ir`: IR 센서 값
- `red`: Red 센서 값
- `green`: Green 센서 값
- `spo2`: 산소포화도 (%)
- `hr`: 심박수 (bpm)
- `temp`: 체온 (°C)
- `battery`: 배터리 잔량 (%)

**인덱스**:
- `idx_hub_device_time`: (hub_address, device_address, timestamp)
- `idx_device_time`: (device_address, timestamp)
- `idx_timestamp`: (timestamp)

**관계**:
- `belongsTo` Hub
- `belongsTo` Device

---

## API 엔드포인트

### 인증 (`/api/auth`)

| Method | Endpoint | 설명 | 인증 |
|--------|----------|------|------|
| POST | `/register` | 회원가입 | ❌ |
| POST | `/login` | 로그인 | ❌ |
| GET | `/me` | 현재 사용자 정보 | ✅ |
| POST | `/logout` | 로그아웃 | ✅ |
| PUT | `/update` | 사용자 정보 수정 | ✅ |
| PUT | `/update-password` | 비밀번호 변경 | ✅ |

### 허브 관리 (`/api/hub`)

| Method | Endpoint | 설명 | 인증 |
|--------|----------|------|------|
| GET | `/` | 허브 목록 조회 | ✅ |
| GET | `/:hubAddress` | 허브 상세 조회 | ✅ |
| POST | `/` | 허브 등록 | ✅ |
| PUT | `/:hubAddress` | 허브 정보 수정 | ✅ |
| DELETE | `/:hubAddress` | 허브 삭제 | ✅ |
| POST | `/:hubAddress/control` | 허브 제어 명령 전송 | ✅ |

### 디바이스 관리 (`/api/device`)

| Method | Endpoint | 설명 | 인증 |
|--------|----------|------|------|
| GET | `/` | 디바이스 목록 조회 | ✅ |
| GET | `/:deviceAddress` | 디바이스 상세 조회 | ✅ |
| POST | `/` | 디바이스 등록 | ✅ |
| PUT | `/:deviceAddress` | 디바이스 정보 수정 | ✅ |
| DELETE | `/:deviceAddress` | 디바이스 삭제 | ✅ |
| PUT | `/:deviceAddress/patient` | 디바이스-환자 연결/해제 | ✅ |

### 환자 관리 (`/api/pet`)

| Method | Endpoint | 설명 | 인증 |
|--------|----------|------|------|
| GET | `/` | 환자 목록 조회 | ✅ |
| GET | `/:petId` | 환자 상세 조회 | ✅ |
| POST | `/` | 환자 등록 | ✅ |
| PUT | `/:petId` | 환자 정보 수정 | ✅ |
| DELETE | `/:petId` | 환자 삭제 | ✅ |

### 기록 관리 (`/api/records`)

| Method | Endpoint | 설명 | 인증 |
|--------|----------|------|------|
| GET | `/` | 기록 목록 조회 | ✅ |
| GET | `/download/:fileName` | CSV 파일 다운로드 | ✅ |
| DELETE | `/:fileName` | CSV 파일 삭제 | ✅ |

### CSV 파일 (`/api/csv`)

| Method | Endpoint | 설명 | 인증 |
|--------|----------|------|------|
| GET | `/device/:deviceAddress` | 디바이스별 CSV 목록 | ✅ |
| GET | `/pet/:petName` | 환자별 CSV 목록 | ✅ |
| GET | `/all` | 전체 CSV 목록 | ✅ |
| GET | `/download?path=...` | CSV 파일 다운로드 | ✅ |

### HRV 분석 (`/api/hrv`)

| Method | Endpoint | 설명 | 인증 |
|--------|----------|------|------|
| GET | `/files` | HRV 분석용 CSV 파일 목록 | ✅ |
| GET | `/download/:fileName` | CSV 파일 다운로드 | ✅ |
| DELETE | `/files/:fileName` | CSV 파일 삭제 | ✅ |

### 측정 제어 (`/api/measurement`)

| Method | Endpoint | 설명 | 인증 |
|--------|----------|------|------|
| POST | `/start` | 측정 시작 | ❌ |
| POST | `/stop` | 측정 정지 | ❌ |
| GET | `/status/:deviceAddress` | 측정 상태 조회 | ❌ |

### 텔레메트리 (`/api/telemetry`)

| Method | Endpoint | 설명 | 인증 |
|--------|----------|------|------|
| GET | `/recent/:deviceAddress` | 최근 텔레메트리 데이터 | ✅ |
| GET | `/recent` | 전체 최근 데이터 | ✅ |

---

## 주요 기능

### 1. 실시간 모니터링
- **Socket.IO 통신**: 프론트엔드와 백엔드 간 실시간 양방향 통신
- **MQTT 통신**: 허브와 백엔드 간 MQTT 프로토콜 통신
- **고속 데이터 처리**: 초당 300-1000 샘플 처리
- **배치 처리**: Telemetry Worker를 통한 효율적인 데이터 처리

### 2. 하드웨어 관리
- **허브 등록**: USB 연결을 통한 허브 등록
- **디바이스 등록**: 허브를 통한 디바이스 자동 감지 및 등록
- **상태 모니터링**: 허브 및 디바이스 온라인/오프라인 상태 추적
- **LED 제어**: 디바이스 LED 깜빡임 제어

### 3. 환자 관리
- **환자 등록**: 환자 정보 등록 및 관리
- **디바이스 연결**: 환자와 디바이스 연결/해제
- **입원/퇴원 관리**: 환자 상태 관리

### 4. 기록 관리
- **CSV 파일 관리**: 측정 데이터 CSV 파일 목록, 다운로드, 삭제
- **파일명 형식**: "디바이스 이름 - 환자 이름" 형식
- **메타데이터**: 시작 시간, 종료 시간, 레코드 수 표시

### 5. HRV 분석
- **CSV 파일 분석**: CSV 파일 기반 HRV 분석
- **시각화**: Poincaré Plot, RR Interval Chart 등
- **지표 계산**: 시간 영역, 주파수 영역, 복잡도 분석

### 6. 데이터 처리
- **신호 처리**: 심박수 안정화 및 신호 품질 평가
- **에러 처리**: 
  - SpO2 = 7: 배터리 부족 (이전 값 ±5 표시)
  - SpO2 = 8: 신호 불량 (심박수 0 표시)
  - SpO2 = 9: 움직임 감지 (이전 값 ±5 표시)
  - HR 10-50: HR × 1.6 처리

---

## 프론트엔드 구조

### 페이지

| 페이지 | 경로 | 설명 |
|--------|------|------|
| 로그인 | `/login` | 사용자 로그인 |
| 회원가입 | `/register` | 신규 사용자 등록 |
| 대시보드 | `/dashboard` | 전체 환자 모니터링 |
| 하드웨어 관리 | `/hardware` | 허브/디바이스 등록 및 관리 |
| 환자 관리 | `/patients` | 환자 정보 관리 |
| 기록 관리 | `/records` | CSV 파일 관리 |
| HRV 분석 | `/hrv-analysis` | HRV 분석 및 시각화 |
| 모니터링 | `/monitoring/:patientId` | 개별 환자 실시간 모니터링 |
| 내정보 | `/profile` | 사용자 정보 및 비밀번호 변경 |

### 주요 컴포넌트

- **Header**: 네비게이션 헤더 (모바일 햄버거 메뉴 포함)
- **Toast**: 전역 토스트 알림 시스템
- **LoadingSpinner**: 로딩 스피너
- **Skeleton**: 스켈레톤 UI (로딩 상태)
- **EmptyState**: 빈 상태 표시
- **ErrorState**: 에러 상태 표시
- **ConfirmModal**: 확인 모달
- **AlertModal**: 알림 모달
- **HardwareAlertBar**: 하드웨어 오류 알림 바

### 상태 관리

- **Zustand**: `useAuthStore`를 통한 인증 상태 관리
- **Local State**: React `useState`를 통한 컴포넌트별 상태 관리
- **Socket.IO**: `useSocket` 훅을 통한 실시간 통신

---

## 보안 및 에러 처리

### 보안 기능

1. **JWT 인증**
   - 모든 API 엔드포인트 JWT 토큰 검증
   - 토큰 만료 시 자동 로그아웃
   - 서버 시작 시 JWT_SECRET 검증

2. **입력 검증**
   - MAC 주소 형식 검증
   - 이메일 형식 검증
   - 비밀번호 강도 검증
   - 경로 조작 (Path Traversal) 방지

3. **권한 관리**
   - 사용자별 데이터 접근 제한
   - 소유권 확인 (허브, 디바이스, 환자)

### 에러 처리

1. **전역 에러 핸들러**
   - `unhandledRejection` 처리
   - `uncaughtException` 처리
   - Express 전역 에러 핸들러

2. **리소스 관리**
   - Telemetry 큐 크기 제한 (최대 10,000개)
   - Socket.IO 리스너 중복 방지
   - 타이머 정리 (메모리 누수 방지)

3. **사용자 피드백**
   - Toast 알림 시스템
   - 로딩 상태 표시 (Skeleton UI)
   - 에러 상태 표시

---

## 배포 가이드

### 프로덕션 빌드

**프론트엔드:**
```bash
cd front
npm run build
```

빌드 결과물은 `front/dist` 디렉토리에 생성됩니다.

**백엔드:**
```bash
cd back
NODE_ENV=production npm start
```

### 환경 변수 설정

프로덕션 환경에서는 반드시 다음 변수를 설정하세요:
- `NODE_ENV=production`
- `JWT_SECRET`: 강력한 시크릿 키 (최소 32자)
- `DB_PASSWORD`: 안전한 데이터베이스 비밀번호
- `MQTT_BROKER_URL`: 프로덕션 MQTT 브로커 URL

### 주의사항

1. **JWT_SECRET**: 반드시 강력한 시크릿 키 사용 (최소 32자)
2. **데이터베이스**: 프로덕션 환경에서는 별도의 데이터베이스 사용
3. **MQTT 브로커**: 안전한 MQTT 브로커 설정 (인증 포함)
4. **CORS**: 프로덕션 환경에서는 허용된 origin만 설정
5. **파일 저장**: CSV 파일 저장 경로 권한 확인

---

## 추가 정보

### 개발 가이드
- 코드 스타일: JavaScript/React 표준 스타일
- 커밋 메시지: 한국어 사용
- 브랜치 전략: main, develop 브랜치 사용

### 문제 해결
- 로그 확인: 백엔드 터미널에서 실시간 로그 확인
- 데이터베이스 연결: MySQL 서버 실행 상태 확인
- MQTT 연결: MQTT 브로커 실행 상태 확인
- Socket.IO 연결: 브라우저 콘솔에서 연결 상태 확인

### 성능 최적화
- Telemetry Worker: 배치 처리로 고속 데이터 처리
- 큐 시스템: 메모리 사용량 제한
- 인덱스: 데이터베이스 인덱스 최적화
- 프론트엔드: React.memo, useMemo 활용

---

## 라이선스

이 프로젝트는 비공개 프로젝트입니다.

---

## 작성일

2024년 12월
