# Hub Project 종합 요약

## 프로젝트 개요

**프로젝트명**: Hub Project - 동물 웨어러블 모니터링 시스템  
**목적**: 동물 병원에서 입원 중인 환자(반려동물)의 생체 신호를 실시간으로 모니터링하고 HRV 분석을 제공  
**개발 기간**: 2024년  
**기술 스택**: Node.js, Express.js, React, MySQL, MQTT, Socket.IO

---

## 핵심 기능

### 1. 실시간 모니터링
- ✅ MQTT를 통한 허브-백엔드 통신
- ✅ Socket.IO를 통한 백엔드-프론트엔드 실시간 통신
- ✅ 초당 300-1000 샘플 처리
- ✅ 실시간 심박수, 산소포화도, 체온 표시

### 2. 하드웨어 관리
- ✅ 허브 등록 및 관리
- ✅ 디바이스 등록 및 관리
- ✅ 허브/디바이스 상태 모니터링 (온라인/오프라인)
- ✅ LED 제어 기능

### 3. 환자 관리
- ✅ 환자 정보 등록 및 관리
- ✅ 디바이스-환자 연결/해제
- ✅ 입원/퇴원 상태 관리

### 4. 기록 관리
- ✅ CSV 파일 목록 조회
- ✅ CSV 파일 다운로드
- ✅ CSV 파일 삭제
- ✅ 파일명 형식: "디바이스 이름 - 환자 이름"

### 5. HRV 분석
- ✅ CSV 파일 기반 HRV 분석
- ✅ 시간 영역 지표 (SDNN, RMSSD, pNN50)
- ✅ 주파수 영역 지표 (LF, HF, LF/HF)
- ✅ 복잡도 분석 (Sample Entropy, DFA)
- ✅ Poincaré Plot 시각화

### 6. 데이터 처리
- ✅ 신호 처리 (HR, SpO2 계산)
- ✅ 에러 처리 (SpO2 7, 8, 9)
- ✅ 신호 품질 평가 (SQI)
- ✅ 배치 처리 시스템

---

## 기술적 특징

### 백엔드
- **고속 데이터 처리**: Telemetry Worker를 통한 배치 처리
- **큐 시스템**: 메모리 사용량 제한 (최대 10,000개)
- **실시간 통신**: Socket.IO를 통한 양방향 통신
- **MQTT 통신**: 허브와의 양방향 MQTT 통신
- **보안**: JWT 인증, 입력 검증, 경로 조작 방지

### 프론트엔드
- **반응형 디자인**: 모바일, 태블릿, 데스크톱 지원
- **UX/UI 개선**: Toast 알림, Skeleton UI, 에러 처리
- **실시간 업데이트**: Socket.IO를 통한 실시간 데이터 수신
- **접근성**: ARIA 속성, 키보드 네비게이션

---

## 주요 개선 사항

### 보안
- ✅ JWT_SECRET 환경변수 검증
- ✅ 경로 조작 (Path Traversal) 취약점 강화
- ✅ 전역 에러 핸들러 추가
- ✅ 입력 검증 강화 (MAC 주소, 이메일, 비밀번호)

### 성능
- ✅ Telemetry 큐 크기 제한
- ✅ Socket.IO 리스너 중복 방지
- ✅ 타이머 정리 개선
- ✅ 데이터베이스 인덱스 최적화

### UX/UI
- ✅ Toast 알림 시스템
- ✅ Skeleton UI
- ✅ 반응형 디자인 개선
- ✅ 접근성 개선
- ✅ 에러 처리 및 빈 상태 개선
- ✅ 폼 검증 피드백
- ✅ 데이터 테이블 UX 개선 (정렬, 페이지네이션)

---

## 프로젝트 구조

```
hub_project/
├── back/          # 백엔드 서버 (Node.js + Express)
├── front/        # 프론트엔드 (React + Vite)
└── 문서/         # 프로젝트 문서
```

### 주요 디렉토리
- `back/routes/`: API 라우트
- `back/models/`: 데이터베이스 모델
- `back/mqtt/`: MQTT 클라이언트 및 서비스
- `back/socket/`: Socket.IO 핸들러
- `back/workers/`: 백그라운드 워커
- `front/src/pages/`: 페이지 컴포넌트
- `front/src/components/`: 재사용 컴포넌트
- `front/src/api/`: API 서비스

---

## 데이터베이스 모델

### 주요 테이블
1. **Users**: 사용자 (병원) 정보
2. **Hubs**: 허브 정보
3. **Devices**: 디바이스 정보
4. **Pets**: 환자 (펫) 정보
5. **Telemetry**: 텔레메트리 데이터

### 관계
- User → Hub (1:N)
- User → Pet (1:N)
- Hub → Device (1:N)
- Device → Pet (1:1)
- Hub → Telemetry (1:N)
- Device → Telemetry (1:N)

---

## API 엔드포인트

### 주요 API
- **인증**: `/api/auth/*`
- **허브 관리**: `/api/hub/*`
- **디바이스 관리**: `/api/device/*`
- **환자 관리**: `/api/pet/*`
- **기록 관리**: `/api/records/*`
- **HRV 분석**: `/api/hrv/*`
- **텔레메트리**: `/api/telemetry/*`

### Socket.IO 이벤트
- **TELEMETRY**: 실시간 텔레메트리 데이터
- **CONNECTED_DEVICES**: 연결된 디바이스 목록
- **CONTROL_REQUEST**: 디바이스 제어 명령
- **CONTROL_ACK**: 명령 수신 확인
- **CONTROL_RESULT**: 명령 실행 결과

---

## 배포

### 환경 요구사항
- Node.js (v16 이상)
- MySQL (v8.0 이상)
- MQTT Broker (Mosquitto 등)

### 배포 방법
1. 환경 변수 설정
2. 데이터베이스 생성
3. 의존성 설치
4. 빌드 (프론트엔드)
5. 서버 실행 (백엔드)
6. Nginx 설정 (프론트엔드)

---

## 문서

### 주요 문서
1. **README.md**: 프로젝트 개요 및 설치 가이드
2. **API_DOCUMENTATION.md**: API 엔드포인트 상세 문서
3. **TECHNICAL_DOCUMENTATION.md**: 기술 상세 문서
4. **DEPLOYMENT_GUIDE.md**: 배포 가이드
5. **CHANGELOG.md**: 변경 이력
6. **PROJECT_SUMMARY.md**: 프로젝트 종합 요약 (이 문서)

---

## 향후 개선 사항

### 단기
- [ ] 테스트 코드 작성
- [ ] API 문서 자동화 (Swagger)
- [ ] 로깅 시스템 개선
- [ ] 모니터링 대시보드

### 중기
- [ ] 사용자 권한 관리 (관리자/일반 사용자)
- [ ] 알림 시스템 (이메일, SMS)
- [ ] 데이터 분석 대시보드
- [ ] 리포트 생성 기능

### 장기
- [ ] 모바일 앱 개발
- [ ] AI 기반 이상 징후 감지
- [ ] 클라우드 배포
- [ ] 다국어 지원

---

## 라이선스

비공개 프로젝트

---

## 작성일

2024년 12월 23일


