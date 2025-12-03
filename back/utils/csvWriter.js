const fs = require('fs');
const path = require('path');

/**
 * CSV 파일 저장 유틸리티
 * Telemetry 데이터를 CSV 형식으로 저장
 */
class CSVWriter {
  constructor(baseDir = 'data/csv') {
    this.baseDir = baseDir;
    this.fileHandles = new Map(); // 디바이스별 파일 핸들
    this.csvHeaders = 'device_mac_address,timestamp,starttime,ir,red,green,spo2,hr,temp,battery\n';
    
    // CSV 디렉토리 생성
    this.ensureDirectoryExists();
  }

  /**
   * CSV 디렉토리 생성
   */
  ensureDirectoryExists() {
    const fullPath = path.join(process.cwd(), this.baseDir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
      console.log(`[CSV Writer] Created directory: ${fullPath}`);
    }
  }

  /**
   * 디바이스별 CSV 파일 경로 생성
   * @param {string} deviceAddress - 디바이스 MAC 주소
   * @returns {string} 파일 경로
   */
  getFilePath(deviceAddress) {
    // 파일명: device_mac_address_YYYY-MM-DD.csv
    const today = new Date().toISOString().split('T')[0];
    const sanitizedAddress = deviceAddress.replace(/:/g, '-');
    const fileName = `${sanitizedAddress}_${today}.csv`;
    return path.join(process.cwd(), this.baseDir, fileName);
  }

  /**
   * CSV 파일 초기화 (헤더 작성)
   * @param {string} filePath - 파일 경로
   */
  initializeFile(filePath) {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, this.csvHeaders, 'utf8');
    }
  }

  /**
   * 데이터를 CSV 형식으로 변환
   * @param {Object} data - Telemetry 데이터
   * @returns {string} CSV 행
   */
  formatCSVRow(data) {
    const {
      device_mac_address,
      timestamp,
      starttime,
      ir,
      red,
      green,
      spo2,
      hr,
      temp,
      battery
    } = data;

    // CSV 이스케이프 처리 (쉼표, 따옴표 등)
    const escapeCSV = (value) => {
      if (value === null || value === undefined) return '';
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    return [
      escapeCSV(device_mac_address),
      escapeCSV(timestamp),
      escapeCSV(starttime || ''),
      escapeCSV(ir),
      escapeCSV(red),
      escapeCSV(green),
      escapeCSV(spo2),
      escapeCSV(hr),
      escapeCSV(temp),
      escapeCSV(battery)
    ].join(',') + '\n';
  }

  /**
   * 단일 데이터를 CSV 파일에 추가
   * @param {Object} data - 저장할 데이터
   */
  appendData(data) {
    const { device_mac_address } = data;
    if (!device_mac_address) {
      console.warn('[CSV Writer] device_mac_address is required');
      return;
    }

    const filePath = this.getFilePath(device_mac_address);
    
    // 파일이 없으면 헤더 작성
    this.initializeFile(filePath);

    // CSV 행 생성
    const csvRow = this.formatCSVRow(data);

    // 파일에 append (비동기)
    fs.appendFile(filePath, csvRow, 'utf8', (err) => {
      if (err) {
        console.error(`[CSV Writer] Failed to write to ${filePath}:`, err);
      }
    });
  }

  /**
   * 배치 데이터를 CSV 파일에 추가
   * @param {Array} dataArray - 저장할 데이터 배열
   */
  appendBatch(dataArray) {
    if (!Array.isArray(dataArray) || dataArray.length === 0) {
      return;
    }

    // 디바이스별로 그룹화
    const deviceGroups = new Map();
    
    for (const data of dataArray) {
      const { device_mac_address } = data;
      if (!device_mac_address) continue;

      if (!deviceGroups.has(device_mac_address)) {
        deviceGroups.set(device_mac_address, []);
      }
      deviceGroups.get(device_mac_address).push(data);
    }

    // 디바이스별로 파일에 저장
    for (const [deviceAddress, records] of deviceGroups.entries()) {
      const filePath = this.getFilePath(deviceAddress);
      
      // 파일이 없으면 헤더 작성
      this.initializeFile(filePath);

      // 모든 행을 하나의 문자열로 결합
      const csvRows = records.map(record => this.formatCSVRow(record)).join('');
      
      // 파일에 append (비동기)
      fs.appendFile(filePath, csvRows, 'utf8', (err) => {
        if (err) {
          console.error(`[CSV Writer] Failed to write batch to ${filePath}:`, err);
        }
      });
    }
  }

  /**
   * 최근 데이터 읽기
   * @param {string} deviceAddress - 디바이스 MAC 주소
   * @param {number} limit - 읽을 최대 행 수 (기본 100)
   * @returns {Array} CSV 데이터 배열
   */
  readRecentData(deviceAddress, limit = 100) {
    const filePath = this.getFilePath(deviceAddress);
    
    if (!fs.existsSync(filePath)) {
      return [];
    }

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.trim().split('\n');
      
      if (lines.length <= 1) { // 헤더만 있거나 비어있음
        return [];
      }

      // 헤더 제외하고 최근 limit개만 가져오기
      const dataLines = lines.slice(1).slice(-limit);
      
      return dataLines.map(line => {
        const values = this.parseCSVLine(line);
        return {
          device_mac_address: values[0],
          timestamp: values[1] ? parseInt(values[1]) : null,
          starttime: values[2] ? parseInt(values[2]) : null,
          ir: values[3] ? parseInt(values[3]) : null,
          red: values[4] ? parseInt(values[4]) : null,
          green: values[5] ? parseInt(values[5]) : null,
          spo2: values[6] ? parseFloat(values[6]) : null,
          hr: values[7] ? parseInt(values[7]) : null,
          temp: values[8] ? parseFloat(values[8]) : null,
          battery: values[9] ? parseInt(values[9]) : null
        };
      });
    } catch (error) {
      console.error(`[CSV Writer] Failed to read ${filePath}:`, error);
      return [];
    }
  }

  /**
   * CSV 라인 파싱 (간단한 버전)
   * @param {string} line - CSV 라인
   * @returns {Array} 파싱된 값 배열
   */
  parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++; // 다음 따옴표 건너뛰기
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current); // 마지막 값
    
    return values;
  }

  /**
   * 모든 디바이스의 최근 데이터 읽기
   * @param {number} limit - 디바이스당 최대 행 수
   * @returns {Object} 디바이스별 데이터 맵
   */
  readAllRecentData(limit = 100) {
    const result = {};
    const fullPath = path.join(process.cwd(), this.baseDir);
    
    if (!fs.existsSync(fullPath)) {
      return result;
    }

    try {
      const files = fs.readdirSync(fullPath);
      const csvFiles = files.filter(f => f.endsWith('.csv'));
      
      for (const file of csvFiles) {
        // 파일명에서 디바이스 주소 추출: device_mac_address_YYYY-MM-DD.csv
        const match = file.match(/^(.+)_\d{4}-\d{2}-\d{2}\.csv$/);
        if (match) {
          const deviceAddress = match[1].replace(/-/g, ':');
          result[deviceAddress] = this.readRecentData(deviceAddress, limit);
        }
      }
    } catch (error) {
      console.error('[CSV Writer] Failed to read directory:', error);
    }

    return result;
  }
}

module.exports = CSVWriter;

