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
    return String(value)
      .replace(/:/g, '_')          // ❌ Windows 폴더 불가
      .replace(/@/g, '_at_')       // 이메일 안전화
      .replace(/[^\w\-가-힣]/g, ''); // 기타 특수문자 제거
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

    const safeEmail = this.sanitize(userEmail);
    const safeDevice = this.sanitize(deviceAddress);
    const safePet = this.sanitize(petName);

    const safeTime = this.sanitize(startTime);

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

    for (let i = 0; i < payload.data.length; i++) {
      const [ir, red, green] = payload.data[i].split(',');

      const elapsedMs = counter.total * intervalMs;
      const time = new Date(baseMs + elapsedMs);
      const timeStr = this.formatTime(time);

      const hr = i === 0 ? payload.hr ?? '' : '';
      const spo2 = i === 0 ? payload.spo2 ?? '' : '';
      const temp = i === 0 ? payload.temp ?? '' : '';

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
