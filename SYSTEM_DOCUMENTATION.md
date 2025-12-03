# 동물 웨어러블 모니터링 시스템 통합 문서

## 1. 프로젝트 개요

이 프로젝트는 **동물의 생체 데이터를 실시간으로 측정 및 모니터링**하기 위한 IoT 기반 시스템이다. 측정 항목은 다음과 같다:

* 심박수(Heart Rate)
* 산소포화도(SpO₂)
* 체온(Temperature)

다수의 웨어러블 기기를 **허브(ESP32-S3)** 를 통해 병원/동물병원에서 사용할 수 있도록 하고,
**웹사이트(프론트/백엔드 서버)** 를 통해 실시간 모니터링 및 제어가 가능하도록 설계한다.

---

## 2. 전체 시스템 구성 요소

### ✔ Frontend (React)

* 병원에서 사용하는 웹 페이지
* 실시간 모니터링 (WebSocket 사용)
* 기기 제어(측정 시작/정지, LED 깜빡임 등)
* 허브/기기/동물 정보 관리 UI 제공
* Socket.IO를 통한 실시간 양방향 통신

### ✔ Backend (Express + WebSocket + MQTT Client)

* React와 WebSocket으로 실시간 통신
* 허브와 MQTT 양방향 통신
* 기기 제어 명령 전달
* 데이터 저장 및 병원 사용자 인증
* Worker 기반 대량 데이터 처리
* CSV 파일 로깅

### ✔ Hub (ESP32-S3)

* 병원에서 설치됨 (인터넷만 연결되면 위치가 중요하지 않음)
* 초기 설치 시 컴퓨터를 USB로 연결하여 **Wi-Fi SSID / PW 설정 저장**
* 허브는 Wi-Fi 연결 후 중앙 백엔드와 MQTT로 연결
* BLE를 통해 웨어러블 기기 최대 6개까지 연결
* BLE로 받은 데이터를 MQTT로 백엔드에 전송
* 백엔드에서 내려오는 제어 명령을 BLE로 기기에 전달

### ✔ Wearable Device (BLE 기반 센서 디바이스)

* ESP32 Hub와 BLE로 통신
* 심박, SpO₂, 온도 센서 내장
* 허브로 측정 데이터를 지속적으로 전송
* 허브로부터 제어 명령(측정 시작/정지, LED 깜빡임)을 받을 수 있어야 함

### ✔ MQTT Monitor (별도 서버)

* MQTT 통신 모니터링 전용 서버
* 모든 MQTT 메시지 실시간 모니터링
* 웹 인터페이스를 통한 메시지 확인
* 테스트용 메시지 발행 기능

---

## 3. 데이터 흐름 구조

### 🔵 1) Telemetry 데이터 흐름 (생체 데이터)

```
Device → BLE → Hub → MQTT → Backend → WebSocket → Frontend
```

* 디바이스는 초당 여러 개의 샘플을 허브에게 전송
* 허브는 이를 가공하여 MQTT로 백엔드에 push
* 백엔드는 WebSocket으로 프론트에 실시간 전달

### 🔵 2) Control 데이터 흐름 (기기 제어)

예: 측정 시작/정지, LED 깜빡임

```
Frontend → WebSocket → Backend → MQTT → Hub → BLE → Device
```

* 프론트에서 제어 명령 발생
* 백엔드에서 MQTT로 허브에 전달
* 허브는 BLE로 기기에 명령 전달

### 🔵 3) 허브 등록 및 관리

* 허브는 Wi-Fi 설정 후 자동으로 백엔드 MQTT에 연결
* 첫 연결 시 허브 MAC 주소를 백엔드 DB에 등록

---

## 3-1. 업데이트된 Telemetry 데이터 흐름 정리

```
Device (50Hz × 6대)
      ↓ BLE
Hub (ESP32-S3) - 데이터 버퍼링 및 배치 전송
      ↓ MQTT (QoS 0)
Backend (Express) - Worker 기반 대량 처리, WebSocket 브로드캐스트
      ↓ WebSocket (10-30Hz)
Frontend (React) - 실시간 차트/모니터링 (downsampling)
```

**핵심 포인트:**

* 기기별 대량 샘플은 반드시 **배치(batch)** 로 전달해야 하고,
* 백엔드에서 직접 DB 저장을 바로 하면 병목이 발생하므로 **Worker 패턴** 및 **Queue 기반 처리**가 필수.

---

## 3-2. 허브 → 백엔드 Telemetry 데이터 구조

허브에서 백엔드로 전달되는 최종 데이터 형식은 다음과 같다:

```json
{
  "device_mac_address": "AA:BB:CC:DD:EE:FF",
  "timestamp": 1735900000000,          // 허브가 해당 샘플을 처리한 시각
  "starttime": 1735899999000,          // 측정 시작 시각
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

### 데이터 특성

* **dataArr는 1초에 50개 이상의 샘플**을 포함
* 허브 1대당 기기 최대 6대 → **초당 300 샘플 이상**
* 데이터는 BLE → 허브 → MQTT → 백엔드 순서로 전송됨
* 백엔드는 이 대량 데이터를 loss 없이 수신하고 프론트에 제공해야 함

---

## 3-3. 대량 Telemetry 처리 요구사항

* 허브 1대당 50Hz × 6 = **300샘플/초**
* 병원에서 여러 허브를 쓴다면 2~4배 증가 가능
* 백엔드는 이 데이터를 **실시간 시각화 + 저장** 둘 다 커버해야 함

### 처리 전략

1. **MQTT → 백엔드 이벤트 핸들러에서는 최소한의 작업만 수행**
   * JSON 파싱 후 메모리 Queue에 push만 함

2. **Worker 프로세스에서 10ms ~ 50ms 주기로 Queue에서 batch로 처리**
   * DB Insert (bulk insert)
   * CSV 파일 저장 (날짜별, 디바이스별 분리)
   * WebSocket 브로드캐스트 (debounce 적용, 10-30Hz로 제한)

3. **프론트는 50Hz 원본을 모두 그릴 필요 없음**
   * 그래프는 downsampling 적용
   * 데이터 테이블에서는 원본을 사용

4. **백엔드 → 프론트 실시간 전송은 10~30Hz로 제한 (성능 고려)**

---

## 4. 기능 요구사항 정리

### ✔ 웨어러블 기기 기능

* 실시간 측정 데이터 전송
* 허브의 BLE 명령 수신
* LED 깜빡임 기능 (기기 찾기용)
* 측정 시작/정지 기능

### ✔ 허브 기능

* BLE로 최대 6개의 기기 동시 연결 및 관리
* MQTT를 통한 백엔드와의 완전 양방향 통신
* 0.2초 이하 응답 시간 유지
* 기기별 데이터 버퍼링 및 전송 안정화
* Wi-Fi 설정 저장 및 재연결 기능

### ✔ 백엔드 기능

* MQTT Client 역할 수행
* WebSocket 서버 역할 수행
* 명령–응답(requestId 기반) 매칭 관리
* 허브/기기 정보 DB 저장
* 병원 사용자 인증 및 권한 관리
* Telemetry 데이터 실시간 브로드캐스트
* CSV 파일 로깅 (디바이스별, 날짜별)
* Worker 기반 대량 데이터 처리

### ✔ 프론트 기능

* 실시간 대시보드
* 기기별 측정값 표시 (심박, SpO₂, 온도)
* 측정 시작/정지 버튼
* LED 깜빡임 제어 버튼
* 허브/기기/동물 정보 등록 및 관리
* Socket.IO를 통한 실시간 데이터 수신

---

## 5. 데이터베이스 구조

### ✔ User 테이블

| 필드          | 설명         |
| ----------- | ---------- |
| email       | 이메일 (PK)   |
| password    | 해시된 비밀번호 |
| name        | 병원명       |
| postcode    | 우편번호      |
| address     | 주소         |
| detail_address | 상세주소  |
| phone       | 전화번호      |
| created_at  | 생성일        |
| updated_at  | 수정일        |

### ✔ Hub 테이블

| 필드          | 설명         |
| ----------- | ---------- |
| address     | 허브 MAC 주소 (PK) |
| name        | 허브 이름      |
| user_email  | 병원 관리자 이메일 (FK) |
| is_change   | 변경 여부      |
| created_at  | 생성일        |
| updated_at  | 수정일        |

### ✔ Device 테이블

| 필드          | 설명            |
| ----------- | ------------- |
| address     | 디바이스 MAC 주소 (PK) |
| name        | 디바이스 이름       |
| hub_address | 연결된 허브 MAC 주소 (FK) |
| created_at  | 생성일           |
| updated_at  | 수정일           |

### ✔ Pet 테이블

| 필드          | 설명             |
| ----------- | -------------- |
| id          | 환자 ID (PK, Auto Increment) |
| name        | 동물 이름          |
| species     | 종 (개, 고양이 등)   |
| breed       | 품종             |
| weight      | 체중             |
| gender      | 성별             |
| neutering   | 중성화 여부        |
| birthDate   | 생년월일          |
| admissionDate | 입원일         |
| veterinarian | 담당수의사        |
| diagnosis   | 진단명           |
| medicalHistory | 과거병력      |
| user_email  | 동물병원 원장 이메일 (FK) |
| device_address | 착용 중인 디바이스 (FK, nullable) |
| created_at  | 생성일            |
| updated_at  | 수정일            |

### ✔ Telemetry 테이블

| 필드          | 설명             |
| ----------- | -------------- |
| id          | 레코드 ID (PK, Auto Increment) |
| device_address | 디바이스 MAC 주소 (FK) |
| timestamp   | 샘플 처리 시각 (BIGINT, milliseconds) |
| starttime   | 측정 시작 시각 (BIGINT, milliseconds, nullable) |
| ir          | IR 센서 값 (INT, nullable) |
| red         | Red 센서 값 (INT, nullable) |
| green       | Green 센서 값 (INT, nullable) |
| spo2        | 산소포화도 (INT, nullable) |
| hr          | 심박수 (INT, nullable) |
| temp        | 체온 (DECIMAL, nullable) |
| battery     | 배터리 (INT, nullable) |
| created_at  | 생성일            |

### ✔ CSV 파일 저장 구조

Telemetry 데이터는 CSV 파일로도 저장됩니다:

* 경로: `back/data/csv/`
* 파일명 형식: `{device_mac_address}_{YYYY-MM-DD}.csv`
* 예: `AA-BB-CC-DD-EE-FF_2024-12-03.csv`
* 컬럼: `device_mac_address, timestamp, starttime, ir, red, green, spo2, hr, temp, battery`

---

## 6. 통신 기술 요약

### ✔ WebSocket (Frontend ↔ Backend)

* Socket.IO 사용
* 실시간 제어/데이터 표시용
* 이벤트 타입:
  * `CONTROL_REQUEST`: 프론트에서 명령 요청
  * `CONTROL_ACK`: 백엔드에서 명령 수신 확인
  * `CONTROL_RESULT`: 명령 실행 결과
  * `TELEMETRY`: Telemetry 데이터 전송
  * `HUB_STATUS`: 허브 상태
  * `DEVICE_STATUS`: 디바이스 상태
  * `GET_DEVICE_STATUS`: 디바이스 상태 요청

### ✔ MQTT (Backend ↔ Hub)

* 토픽 구조:
  * 명령: `hub/{hubId}/command/{deviceId}` (QoS 1)
  * 응답: `hub/{hubId}/response/{deviceId}` (QoS 1)
  * 측정값: `hub/{hubId}/telemetry/{deviceId}` (QoS 0)
  * 허브 상태: `hub/{hubId}/status` (QoS 1)
  * 설정: `hub/{hubId}/settings` (QoS 1, retain)

* 와일드카드 구독:
  * `hub/+/status`
  * `hub/+/telemetry/+`
  * `hub/+/response/+`
  * 개발 모드: `#` (모든 토픽)

### ✔ BLE (Hub ↔ Device)

* GATT Write/Notify 기반 제어
* 6개 디바이스 동시 연결
* LED 깜빡임 / 측정명령 / 상태요청 처리

---

## 7. 성능 요구사항

* **명령 요청 → 기기 응답: 0.2초 이하**
* **허브 1대당 기기 최대 6개**
* **기기 1대당 초당 50샘플 이상 처리 가능**
* **백엔드는 초당 300~1000 샘플 처리 가능해야 함**
* Telemetry 병렬 처리 + 버퍼링 + MQTT 최적화 필요
* WebSocket은 per-client 10~30Hz로 전송 최적화

---

## 8. 시스템 안정성 및 확장성 고려사항

* MQTT 브로커는 클라우드에 설치 (ESP32가 어디서든 접속 가능)
* 허브당 BLE 장치 6개 연결 제한 고려한 스케일링
* 백엔드에서 Worker 패턴으로 대량 데이터 처리
* Hub/Device 오류 시 재연결 로직 필수
* Queue 기반 비동기 처리로 메인 스레드 블로킹 방지

---

## 9. 보안 고려 사항

### ✔ MQTT 인증

* MQTT 브로커에 사용자명/비밀번호 설정 가능
* 환경 변수로 관리: `MQTT_USERNAME`, `MQTT_PASSWORD`
* TLS/SSL 지원 (프로덕션 환경 권장)

### ✔ 병원 사용자 인증 (JWT)

* JWT(JSON Web Token) 기반 인증
* 로그인 시 토큰 발급
* 모든 API 엔드포인트에 토큰 검증 미들웨어 적용
* 토큰 만료 시간 설정 가능

### ✔ 허브 등록 인증

* 허브는 첫 연결 시 MAC 주소로 자동 등록
* 병원 사용자만 자신의 허브에 접근 가능
* 데이터베이스에서 `user_email`로 권한 분리

### ✔ 데이터 접근 제어

* 사용자는 자신의 병원에 등록된 허브/디바이스만 조회 가능
* Telemetry 데이터는 디바이스 소유권 확인 후 제공
* CSV 파일 다운로드 시 권한 검증

---

## 10. 장애 상황 처리

### ✔ 허브 연결 끊김

* MQTT `will` 메시지로 허브 상태 자동 업데이트
* 백엔드에서 허브 상태 모니터링
* 프론트에 허브 오프라인 상태 표시
* 재연결 시 자동 상태 복구

### ✔ 디바이스 연결 끊김

* 허브에서 BLE 연결 상태 모니터링
* 허브가 백엔드에 디바이스 상태 전송
* 프론트에 디바이스 연결 끊김 알림
* 재연결 시 자동 복구

### ✔ 데이터 유실 방지

* MQTT QoS 1 사용 (명령/응답)
* Queue 기반 처리로 일시적 오류 시 재시도 가능
* CSV 파일로 데이터 영구 저장
* 데이터베이스 트랜잭션 사용

### ✔ 백엔드 장애

* MQTT 브로커의 retain 메시지 활용
* 허브 재연결 시 최신 설정 자동 수신
* 로그 파일로 장애 원인 추적

---

## 11. 실시간 차트 렌더링 전략

### ✔ Downsampling

* 프론트에서 그래프 표시 시 샘플 수 제한
* 예: 1000개 샘플 → 100개로 다운샘플링
* 최근 데이터 우선 표시
* 전체 데이터는 테이블에서 확인 가능

### ✔ Batch Update

* WebSocket으로 받은 데이터를 버퍼에 저장
* 일정 간격(예: 100ms)마다 그래프 업데이트
* React의 `useState` 배치 업데이트 활용
* 성능 최적화를 위한 `requestAnimationFrame` 사용

### ✔ 데이터 표시 전략

* 실시간 모니터링: 최근 1분 데이터만 표시
* 기록 조회: 전체 데이터 CSV 다운로드
* 데이터베이스: 최근 N개 레코드만 조회

---

## 12. 대량 Telemetry 저장 전략

### ✔ Raw 데이터 저장

* 모든 샘플을 데이터베이스에 저장
* Telemetry 테이블에 개별 레코드로 저장
* CSV 파일에도 동일하게 저장
* 장기 보관 및 분석용

### ✔ Summary 데이터 (선택사항)

* 1분 단위 평균값 계산
* 일일/주간/월간 통계 생성
* 별도 Summary 테이블에 저장
* 빠른 조회를 위한 인덱스 활용

### ✔ 데이터 보관 정책

* Raw 데이터: 최근 30일 보관
* Summary 데이터: 장기 보관
* CSV 파일: 무제한 보관 (디스크 용량 고려)
* 자동 삭제 스크립트 (선택사항)

---

## 13. 백엔드 테스트 준비를 위한 사항

허브와 디바이스는 다른 팀이 개발하므로, 백엔드/프론트만 개발하는 경우 **테스트용 시뮬레이터가 필수**다.

### 테스트를 위한 시뮬레이터 필요 항목

1. **MQTT Command 시뮬레이터**
   * 백엔드에서 허브로 보내는 명령을 받아줄 dummy MQTT client
   * 위치: `back/test/mqttSimulator.js`

2. **Telemetry 자동 생성기**
   * 허브가 보내는 것과 동일한 JSON 구조로
   * 1초당 300개의 샘플을 백엔드로 publish 하는 스크립트
   * Node.js 또는 Python으로 쉽게 제작 가능
   * 위치: `back/test/mqttSimulator.js`

3. **Response 시뮬레이터 (BLE 응답 대역)**
   * command → response 흐름을 가짜로 만들어 RPC 흐름 테스트 가능
   * 위치: `back/test/mqttSimulator.js`

4. **LED 깜빡임/측정 시작 명령 시뮬레이터**
   * 허브가 실제 BLE로 하는 역할을 대신
   * MQTT로 response 토픽을 publish

### MQTT 모니터 서버

* 별도 서버로 모든 MQTT 메시지 모니터링
* 웹 인터페이스 제공
* 테스트용 메시지 발행 기능
* 위치: `mqtt-monitor/`

### 왜 시뮬레이터가 필요한가?

* 허브/디바이스 완성 전에도 백엔드 개발을 모두 끝낼 수 있음
* 제어 플로우(RPC), WebSocket 브로드캐스트, DB 적재 테스트 가능
* 실 병원 환경만큼의 고주파 Telemetry 테스트 가능

---

## 14. 허브 초기 설정(Provisioning) 절차

### ✔ USB 연결을 통한 Wi-Fi 설정

1. 허브를 PC에 USB로 연결
2. 시리얼 모니터 또는 전용 설정 도구 실행
3. Wi-Fi SSID 및 비밀번호 입력
4. 설정을 플래시 메모리에 저장
5. 허브 자동 재부팅
6. Wi-Fi 연결 확인
7. MQTT 브로커에 자동 연결
8. 첫 연결 시 MAC 주소를 백엔드에 등록

### ✔ 허브 등록 프로세스

1. 허브가 MQTT 브로커에 연결
2. `hub/{hubId}/status` 토픽으로 상태 발행
3. 백엔드가 허브 상태 수신
4. 허브 MAC 주소가 DB에 없으면 자동 등록
5. 병원 사용자가 허브 이름 설정 (선택사항)

---

## 15. 허브-디바이스 BLE 권한 구조

### ✔ 페어링 여부

* 허브와 디바이스는 BLE 스캔 후 연결
* 페어링은 필요 없음 (GATT 기반 통신)
* 허브가 디바이스 MAC 주소로 식별

### ✔ 자동 재연결 로직

* 허브는 연결된 디바이스 목록 유지
* BLE 연결 끊김 감지 시 자동 재연결 시도
* 재연결 실패 시 백엔드에 상태 전송

### ✔ 디바이스 스캔/연결/해제 규칙

* 허브는 주기적으로 주변 BLE 디바이스 스캔
* 등록된 디바이스만 연결 (MAC 주소 기반)
* 최대 6개 디바이스 동시 연결
* 디바이스 해제는 백엔드 명령 또는 수동 해제

---

## 16. API 엔드포인트 문서

### 인증 API (`/auth`)

* `POST /auth/register` - 회원가입
* `POST /auth/login` - 로그인
* `GET /auth/me` - 사용자 정보 조회

### 허브 API (`/hub`)

* `GET /hub` - 허브 목록 조회
* `GET /hub/:hubAddress` - 허브 상세 조회
* `POST /hub` - 허브 등록
* `PUT /hub/:hubAddress` - 허브 수정
* `DELETE /hub/:hubAddress` - 허브 삭제

### 디바이스 API (`/device`)

* `GET /device` - 디바이스 목록 조회
* `GET /device/:deviceAddress` - 디바이스 상세 조회
* `POST /device` - 디바이스 등록
* `PUT /device/:deviceAddress` - 디바이스 수정
* `DELETE /device/:deviceAddress` - 디바이스 삭제
* `PUT /device/:deviceAddress/patient` - 디바이스에 환자 연결/해제

### 환자 API (`/pet`)

* `GET /pet` - 환자 목록 조회
* `GET /pet/:petId` - 환자 상세 조회
* `POST /pet` - 환자 등록
* `PUT /pet/:petId` - 환자 수정
* `DELETE /pet/:petId` - 환자 삭제

### Telemetry API (`/telemetry`)

* `GET /telemetry/recent/:deviceAddress` - 최근 데이터 조회 (CSV)
* `GET /telemetry/recent` - 모든 디바이스 최근 데이터 조회 (CSV)
* `GET /telemetry/db/recent/:deviceAddress` - 최근 데이터 조회 (DB)

### 기록 API (`/records`)

* `GET /records` - CSV 파일 목록 조회
* `GET /records/download/:fileName` - CSV 파일 다운로드
* `DELETE /records/:fileName` - CSV 파일 삭제

### MQTT 제어 API (`/mqtt`)

* `POST /mqtt/command` - 명령 전송
* `POST /mqtt/settings` - 설정 전송
* `GET /mqtt/status` - MQTT 연결 상태 확인

---

## 17. 허브 100개 이상일 때의 MQTT 기반 양방향 통신 구조

허브가 1개에서 100개 이상으로 확장된다고 해도, MQTT는 본질적으로 **모든 허브를 동일 방식으로 다룰 수 있는 구조**를 가지고 있다. 그렇기 때문에 백엔드에서는 허브 개수 증가에 따른 구조 변경이 거의 필요하지 않으며, 설계만 잘 해두면 허브 수가 수십 배로 증가해도 안정적으로 확장된다.

### ✔ 핵심 개념

* 허브는 모두 **MQTT 브로커에 클라이언트로 접속**한다.
* 백엔드는 **MQTT 브로커에 단 한 번** 클라이언트로 접속한다.
* 백엔드는 **와일드카드 토픽 구독**을 통해 *모든 허브의 메시지를 자동으로 수신*한다.
* 허브마다 고유한 `hubId`를 사용하여 토픽을 구분한다.
* 프론트에는 WebSocket으로 필요한 기기의 데이터만 전달한다.

즉, 허브 개수가 (1 → 100 → 300 → 1000) 로 늘어나도 백엔드는 구조적으로 동일하게 동작한다.

### 17.1 허브 100개를 위한 MQTT 토픽 구조

허브가 많아져도 토픽 규칙은 동일하며, 가운데 들어가는 **hubId만 다르게** 설계한다.

```text
# 백엔드 → 허브(명령)
hub/{hubId}/command/{deviceMac}

# 허브 → 백엔드(명령 응답)
hub/{hubId}/response/{deviceMac}

# 허브 → 백엔드(데이터)
hub/{hubId}/telemetry/{deviceMac}

# 허브 → 백엔드(허브 상태)
hub/{hubId}/status
```

예:

```text
hub/AA:BB:CC:00:01/command/DC:11:22:33:44:55
hub/AA:BB:CC:00:01/telemetry/DC:11:22:33:44:55
hub/AA:BB:CC:00:02/telemetry/DC:66:77:88:99:00
```

허브가 100개면 위 패턴이 100개 생기는 것일 뿐이며,
**모든 허브와 양방향 통신이 가능한 구조**가 유지된다.

### 17.2 백엔드에서 100개 허브 처리 방식

백엔드는 모든 허브를 위해 개별 구독을 하지 않는다.
대신 와일드카드 구독을 사용한다.

```javascript
mqttClient.subscribe("hub/+/response/+");
mqttClient.subscribe("hub/+/telemetry/+");
mqttClient.subscribe("hub/+/status");
```

이 코드만 있으면 브로커로 들어오는 **모든 허브의 모든 기기 메시지를 자동 수신**하게 된다.

메시지가 오면 토픽을 split 해서 hubId, deviceMac을 추출하면 된다.

```javascript
const [_, hubId, kind, deviceMac] = topic.split("/");
```

이 방식으로 허브 수와 상관없이 안정적으로 확장된다.

### 17.3 백엔드 → 허브로 명령 보내기 (100개 허브 공통)

특정 허브와 특정 디바이스에 명령을 보내려면 아래 방식으로 토픽을 조합한다.

```javascript
const topic = `hub/${hubId}/command/${deviceMac}`;
```

payload는 다음처럼 구성한다.

```json
{
  "requestId": "uuid-1234",
  "command": "START_MEASURE",
  "params": {}
}
```

`requestId`는 백엔드가 생성하고, 허브는 응답 시 그대로 넣어서 회신한다.
이렇게 하면 **RPC 형식의 요청–응답 구조**가 완성된다.

### 17.4 허브 → 백엔드 응답 처리 (100개 허브 공통)

백엔드가 구독 중인 `hub/+/response/+` 토픽에서 모든 허브의 응답을 받는다.

```javascript
mqttClient.on("message", (topic, payload) => {
  const [_, hubId, kind, deviceMac] = topic.split("/");

  if (kind === "response") {
    const msg = JSON.parse(payload.toString());
    const requestId = msg.requestId;
    const record = pending.get(requestId);
    // record.resolve()로 프론트에 결과 전달
  }
});
```

`pending Map` 구조로 100개 허브의 동시에 들어오는 요청을 전부 매칭할 수 있다.

### 17.5 ESP32 허브 100개가 동시에 붙을 때 필요한 조건

#### 허브 개수 100개여도 문제 없는 이유

* MQTT는 **수천~수만 클라이언트**를 처리하도록 설계되었다.
* 허브 100개 × 디바이스 6개 = 600 디바이스 → 충분히 manageable.
* 각 허브는 자체적으로 BLE → MQTT 처리만 하면 됨.

#### 허브별 설계 규칙

각 허브는 아래 사항을 준수해야 한다.

1. **고유 hubId 사용** → MAC 주소 추천
2. 클라이언트ID도 고유하게 설정
   ```cpp
   client.connect("hub_" + hub_mac);
   ```
3. 구독 토픽:
   ```text
   hub/{hubId}/command/#
   ```
4. 응답/데이터는 반드시 본인 hubId로 publish

이렇게 하면 허브가 1대든 100대든 동일한 방식으로 동작한다.

### 17.6 대량 Telemetry 처리 (허브 100개 기준)

허브 1대당 디바이스 최대 6개 × 50Hz 전송 = **300 샘플/초**

허브 100개면:

```
300 샘플 × 100 허브 = 30,000 샘플/초 (peak)
```

→ 이 경우 batch + worker 기반 구조가 필수이다.

#### 처리 구조

```
MQTT → (가벼운 파싱) → Queue → Worker → DB + WebSocket
```

* MQTT 핸들러에서는 절대 DB insert 금지
* Queue에만 넣고 Worker(10~20ms 주기)가 처리
* WebSocket 브로드캐스트는 10~20Hz로 제한하여 프론트 성능 보장

### 17.7 프론트에서 100개 허브 관리 방식

* 병원 계정에 연결된 허브 목록 표시
* 허브 선택 → 해당 허브에 연결된 1~6개 디바이스 목록 표시
* 디바이스 선택 시 실시간 telemetry 스트림 구독
* LED 찾기, 측정 시작/정지 같은 제어 기능 제공
* WebSocket으로 백엔드와 실시간 통신

**허브 100개라도 프론트는 병원별로 분리되기 때문에 UI 부담 낮음.**

### 17.8 결론: 허브 100개에서도 완전한 양방향 통신 가능

MQTT 기반 구조는 허브가 1개에서 100개로 증가해도 아래 조건만 지키면 문제 없다.

* **고유 hubId 기반 토픽 분리**
* **백엔드의 MQTT 와일드카드 구독**
* **requestId 기반 RPC 응답 구조**
* **worker 기반 대량 telemetry 처리**
* **프론트는 WebSocket만 알면 됨**

따라서 허브가 많아져도 전체 시스템은 변경 없이 그대로 확장 가능하며,
병원 여러 곳에서 동시에 100개 이상의 허브를 사용해도 안정적으로 동작한다.

---

## 18. 배포 및 운영 가이드

### ✔ 개발 환경 설정

1. Node.js 설치 (v18 이상)
2. MySQL 설치 및 데이터베이스 생성
3. Mosquitto MQTT 브로커 설치
4. 환경 변수 설정 (`.env` 파일)
5. 의존성 설치 (`npm install`)

### ✔ 프로덕션 환경 설정

1. PM2 또는 systemd로 프로세스 관리
2. Nginx 리버스 프록시 설정
3. SSL/TLS 인증서 설정
4. MQTT 브로커 보안 강화
5. 데이터베이스 백업 설정

### ✔ 모니터링

* 서버 리소스 모니터링 (CPU, 메모리, 디스크)
* MQTT 브로커 연결 수 모니터링
* 데이터베이스 성능 모니터링
* 로그 파일 모니터링

### ✔ 백업 및 복구

* 데이터베이스 정기 백업
* CSV 파일 백업
* 설정 파일 백업
* 재해 복구 계획 수립

---

## 19. 결론

이 시스템은 **웨어러블 생체 데이터 측정 → 허브 BLE 전달 → MQTT 중앙 서버 수집 → 백엔드 처리 → 프론트 실시간 표시** 의 구조로 이루어진다.

병원에서 다수의 동물 상태를 실시간 모니터링하면서 제어까지 수행할 수 있도록 최적화된 IoT 플랫폼이며, 허브 및 기기 등록/제어/모니터링이 모두 중앙 시스템에서 가능해 안정적이고 확장성이 높다.

### 주요 특징

* **확장성**: 허브 1개에서 100개 이상으로 확장 가능
* **실시간성**: WebSocket 기반 실시간 데이터 전송
* **안정성**: Queue 기반 비동기 처리, Worker 패턴
* **보안**: JWT 인증, MQTT 인증, 데이터 접근 제어
* **모니터링**: MQTT 모니터 서버, 상세 로깅
* **데이터 보관**: 데이터베이스 + CSV 파일 이중 저장

---

## 20. 참고 문서

* `back/README.md` - 백엔드 서버 가이드
* `back/LOGGING.md` - 로깅 가이드
* `back/TEST_MQTT.md` - MQTT 테스트 가이드
* `back/mqtt/README.md` - MQTT 서비스 상세 문서
* `back/socket/README.md` - Socket.IO 사용 가이드
* `mqtt-monitor/README.md` - MQTT 모니터 서버 가이드

