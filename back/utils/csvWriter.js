const fs = require('fs');
const path = require('path');

/**
 * CSV 파일 저장 유틸리티
 * Windows-safe + ENOENT 방지 버전
 */
class CSVWriter {
  constructor(baseDir = 'csv_files') {
    this.baseDir = baseDir;
    this.activeSessions = new Map();
    this.csvHeaders = 'time,ir,red,green,hr,spo2,temp\n';
    this.dataCounters = new Map();

    this.ensureDirectoryExists();
  }

  /* =========================
   * 공통 유틸
   * ========================= */

  sanitize(value) {
    // 경로에 사용할 수 없는 문자만 제거 (Windows: < > : " | ? * \)
    // 이메일, MAC 주소, 시간은 그대로 유지
    return String(value)
      .replace(/[<>:"|?*\\]/g, '_')  // Windows 파일 시스템에서 금지된 문자만 제거
      .replace(/\s+/g, '_');          // 공백은 언더스코어로 변환
  }

  // 이메일, MAC 주소, 시간은 sanitize하지 않고 그대로 사용
  sanitizeForPath(value) {
    // 경로에 사용할 수 없는 문자만 제거
    // Windows 파일 시스템에서 @는 폴더명에 사용 가능하지만, 안전을 위해 _at_로 변환
    return String(value)
      .replace(/@/g, '_at_')  // @를 _at_로 변환 (Windows 호환성)
      .replace(/[<>:"|?*\\]/g, '_')
      .replace(/\s+/g, '_');
  }

  ensureDirectoryExists() {
    const fullPath = path.join(process.cwd(), this.baseDir);
    fs.mkdirSync(fullPath, { recursive: true });
  }

  /* =========================
   * 세션 관리
   * ========================= */

  startSession(deviceAddress, userEmail, petName, startTime, samplingRate = 50) {
    const now = new Date();
    const date = now.toISOString().split('T')[0]; // YYYY-MM-DD 형식

    // Windows에서는 폴더명과 파일명에 : 사용 불가하므로 _로 변환
    // 이메일은 @와 .을 그대로 유지 (폴더명에 사용 가능)
    const safeEmail = this.sanitizeForPath(userEmail);
    // MAC 주소의 :를 _로 변환 (예: ec:81:f7:f3:54:6f -> ec_81_f7_f3_54_6f)
    const safeDevice = deviceAddress.replace(/:/g, '_');
    const safePet = this.sanitizeForPath(petName);

    const dirPath = path.join(
      process.cwd(),
      this.baseDir,
      safeEmail,
      date,
      safeDevice,
      safePet
    );

    // 🔥 핵심: 중간 경로 포함 전부 생성
    fs.mkdirSync(dirPath, { recursive: true });

    // ✅ 파일명: device_mac_address_pet_name_YYYY-MM-DD.csv (날짜만 사용, 같은 날짜면 같은 파일)
    const filePath = path.join(
      dirPath,
      `${safeDevice}_${safePet}_${date}.csv`
    );

    // ✅ 기존 세션이 있는지 확인
    const existingSession = this.activeSessions.get(deviceAddress);
    if (existingSession) {
      if (existingSession.date === date && fs.existsSync(existingSession.filePath)) {
        // 같은 날짜의 세션이 있고 파일이 존재하면 기존 파일 사용 (append 모드)
        console.log(`[CSV Writer] Using existing session for ${deviceAddress} on ${date}`);
        return; // 기존 세션 사용
      } else if (existingSession.date !== date) {
        // 날짜가 바뀌었으면 기존 세션 종료
        console.log(`[CSV Writer] Date changed for ${deviceAddress}: ${existingSession.date} -> ${date}, ending previous session`);
        this.endSession(deviceAddress);
      }
    }

    // ✅ 새 세션이거나 날짜가 바뀐 경우: 파일이 없으면 헤더만 작성, 있으면 append
    if (!fs.existsSync(filePath)) {
      // 파일이 없으면 헤더 작성
      fs.writeFileSync(filePath, this.csvHeaders, 'utf8');
      console.log(`[CSV Writer] New CSV file created: ${filePath}`);
    } else {
      // 파일이 이미 있으면 헤더 없이 append (기존 파일에 이어서 작성)
      console.log(`[CSV Writer] Appending to existing CSV file: ${filePath}`);
    }

    this.activeSessions.set(deviceAddress, {
      filePath,
      date, // 날짜 정보 저장 (날짜 변경 감지용)
      baseTimestamp: now.getTime(),
    });

    // 카운터 초기화 (새 세션인 경우만)
    if (!this.dataCounters.has(deviceAddress)) {
      this.dataCounters.set(deviceAddress, {
        total: 0,
      });
    }

    console.log(`[CSV Writer] Session started/updated: ${filePath} (Date: ${date})`);
  }

  endSession(deviceAddress) {
    if (this.activeSessions.has(deviceAddress)) {
      this.activeSessions.delete(deviceAddress);
      this.dataCounters.delete(deviceAddress);
      console.log(`[CSV Writer] Session ended: ${deviceAddress}`);
    }
  }

  hasActiveSession(deviceAddress) {
    return this.activeSessions.has(deviceAddress);
  }

  closeAllSessions() {
    this.activeSessions.clear();
    this.dataCounters.clear();
  }

  /* =========================
   * 데이터 기록
   * ========================= */

  async writeBatch(payload) {
    const deviceAddress = payload.device_mac_address;
    const session = this.activeSessions.get(deviceAddress);
    if (!session) return;

    const counter = this.dataCounters.get(deviceAddress);
    const samplingRate = payload.sampling_rate || 50;

    let buffer = '';

      // dataArr가 있으면 각 샘플의 hr, spo2, temp를 사용
      const hasDataArr = payload.dataArr && Array.isArray(payload.dataArr) && payload.dataArr.length > 0;

      // hr 값을 텍스트로 변환하는 함수 (7: 배터리 부족, 8: 신호 불량, 9: 움직임 감지)
      const formatHrValue = (hrValue) => {
        if (hrValue === 7) {
          return 'Low Battery';
        } else if (hrValue === 8) {
          return 'Poor Signal';
        } else if (hrValue === 9) {
          return 'Movement Detected';
        } else {
          return hrValue !== undefined && hrValue !== null ? hrValue : '';
        }
      };

      for (let i = 0; i < payload.data.length; i++) {
        const [ir, red, green] = payload.data[i].split(',');

        // 현재 시간 기준으로 time 저장 (HH:mm:ss:SSS 형식)
        const now = new Date();
        const timeStr = this.formatTime(now);

        // dataArr가 있으면 각 샘플의 값을 사용, 없으면 첫 번째 샘플에만 값 사용
        let hr = '';
        let spo2 = '';
        let temp = '';
        
        if (hasDataArr && payload.dataArr[i]) {
          // dataArr의 각 샘플에서 값 가져오기 (hr과 spo2가 바뀌어 있음)
          const rawHr = payload.dataArr[i].spo2 !== undefined && payload.dataArr[i].spo2 !== null ? payload.dataArr[i].spo2 : '';
          hr = formatHrValue(rawHr);
          spo2 = payload.dataArr[i].hr !== undefined && payload.dataArr[i].hr !== null ? payload.dataArr[i].hr : '';
          temp = payload.dataArr[i].temp !== undefined && payload.dataArr[i].temp !== null ? payload.dataArr[i].temp : '';
        } else if (i === 0) {
          // 첫 번째 샘플에만 전체 값 사용 (hr과 spo2가 바뀌어 있음)
          const rawHr = payload.spo2 !== undefined && payload.spo2 !== null ? payload.spo2 : '';
          hr = formatHrValue(rawHr);
          spo2 = payload.hr !== undefined && payload.hr !== null ? payload.hr : '';
          temp = payload.temp !== undefined && payload.temp !== null ? payload.temp : '';
        }

        buffer += `${timeStr},${ir},${red},${green},${hr},${spo2},${temp}\n`;
        counter.total++;
      }

    fs.appendFileSync(session.filePath, buffer, 'utf8');
  }

  /* =========================
   * 시간 처리
   * ========================= */

  parseStartTime(startTime) {
    if (!startTime) return [0, 0, 0, 0];

    // HHmmssSSS
    if (!startTime.includes(':') && startTime.length === 9) {
      return [
        Number(startTime.slice(0, 2)),
        Number(startTime.slice(2, 4)),
        Number(startTime.slice(4, 6)),
        Number(startTime.slice(6, 9)),
      ];
    }

    // HH:mm:ss:SSS
    if (startTime.includes(':')) {
      const parts = startTime.split(':').map(Number);
      return [
        parts[0] || 0,
        parts[1] || 0,
        parts[2] || 0,
        parts[3] || 0,
      ];
    }

    return [0, 0, 0, 0];
  }

  formatTime(date) {
    return [
      String(date.getHours()).padStart(2, '0'),
      String(date.getMinutes()).padStart(2, '0'),
      String(date.getSeconds()).padStart(2, '0'),
      String(date.getMilliseconds()).padStart(3, '0'),
    ].join(':');
  }
}

const csvWriterInstance = new CSVWriter();
module.exports = csvWriterInstance;
module.exports.CSVWriter = CSVWriter;
