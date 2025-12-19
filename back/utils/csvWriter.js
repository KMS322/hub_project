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
    return String(value)
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

  startSession(deviceAddress, userEmail, petName, startTime) {
    const now = new Date();
    const date = now.toISOString().split('T')[0];

    // Windows에서는 폴더명과 파일명에 : 사용 불가하므로 _로 변환
    // 이메일은 @와 .을 그대로 유지 (폴더명에 사용 가능)
    const safeEmail = this.sanitizeForPath(userEmail);
    // MAC 주소의 :를 _로 변환 (예: ec:81:f7:f3:54:6f -> ec_81_f7_f3_54_6f)
    const safeDevice = deviceAddress.replace(/:/g, '_');
    const safePet = this.sanitizeForPath(petName);

    // 시간 형식 변환: HHmmssSSS -> HH_mm_ss_SSS (Windows 호환)
    let safeTime = startTime;
    if (startTime && !startTime.includes(':') && !startTime.includes('_') && startTime.length === 9) {
      // HHmmssSSS 형식을 HH_mm_ss_SSS로 변환
      safeTime = `${startTime.slice(0, 2)}_${startTime.slice(2, 4)}_${startTime.slice(4, 6)}_${startTime.slice(6, 9)}`;
    } else if (startTime && startTime.includes(':')) {
      // HH:mm:ss:SSS 형식을 HH_mm_ss_SSS로 변환
      safeTime = startTime.replace(/:/g, '_');
    }

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

    // 파일명: device_mac_address-HH_mm_ss_SSS.csv (Windows 호환)
    const filePath = path.join(
      dirPath,
      `${safeDevice}-${safeTime}.csv`
    );

    fs.writeFileSync(filePath, this.csvHeaders, 'utf8');

    this.activeSessions.set(deviceAddress, {
      filePath,
      startTime,
      baseTimestamp: now.getTime(),
    });

    this.dataCounters.set(deviceAddress, {
      total: 0,
    });

    console.log(`[CSV Writer] Session started: ${filePath}`);
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
    const intervalMs = 1000 / samplingRate;

    const startTimeStr = payload.start_time || session.startTime;
    const [h, m, s, ms] = this.parseStartTime(startTimeStr);

    const baseMs =
      h * 3600000 +
      m * 60000 +
      s * 1000 +
      ms;

    let buffer = '';

    // dataArr가 있으면 각 샘플의 hr, spo2, temp를 사용
    const hasDataArr = payload.dataArr && Array.isArray(payload.dataArr) && payload.dataArr.length > 0;

    for (let i = 0; i < payload.data.length; i++) {
      const [ir, red, green] = payload.data[i].split(',');

      const elapsedMs = counter.total * intervalMs;
      const time = new Date(baseMs + elapsedMs);
      const timeStr = this.formatTime(time);

      // dataArr가 있으면 각 샘플의 값을 사용, 없으면 첫 번째 샘플에만 값 사용
      let hr = '';
      let spo2 = '';
      let temp = '';
      
      if (hasDataArr && payload.dataArr[i]) {
        // dataArr의 각 샘플에서 값 가져오기 (hr과 spo2가 바뀌어 있음)
        hr = payload.dataArr[i].spo2 !== undefined && payload.dataArr[i].spo2 !== null ? payload.dataArr[i].spo2 : '';
        spo2 = payload.dataArr[i].hr !== undefined && payload.dataArr[i].hr !== null ? payload.dataArr[i].hr : '';
        temp = payload.dataArr[i].temp !== undefined && payload.dataArr[i].temp !== null ? payload.dataArr[i].temp : '';
      } else if (i === 0) {
        // 첫 번째 샘플에만 전체 값 사용 (hr과 spo2가 바뀌어 있음)
        hr = payload.spo2 !== undefined && payload.spo2 !== null ? payload.spo2 : '';
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
