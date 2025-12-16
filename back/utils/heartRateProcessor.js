/**
 * 디바이스별 HR 처리 상태 관리 모듈
 * 
 * 각 디바이스의 신호 처리 상태를 관리하고,
 * 5초 윈도우 기반으로 HR 후보를 생성하여 최종 HR을 결정한다.
 */

const {
  calculatePI,
  calculateHRTimeDomain,
  calculateHRFrequencyDomain,
  calculateHRAutocorrelation,
  predictHRFromPrevious,
  calculateSQI,
  calculateWaveformPeriodicity,
  calculateSpO2Variability,
  calculateWeightedMedian,
  calculateMajorityVoting,
  applyEWMA,
  validateTimeContinuity
} = require('./signalProcessor');

/**
 * 디바이스별 HR 처리 상태
 */
class HeartRateProcessor {
  constructor(deviceId, options = {}) {
    this.deviceId = deviceId;
    this.windowSize = options.windowSize || 5; // 5초 윈도우
    this.samplingRate = null; // 샘플링 레이트 (Hz)
    
    // 윈도우 버퍼
    this.windowBuffer = {
      ir: [],
      red: [],
      green: [],
      spo2: [],
      timestamps: []
    };
    
    // HR 상태
    this.stableHR = null; // 안정화된 HR
    this.previousHR = null; // 이전 HR
    this.lastHRTime = null; // 마지막 HR 계산 시간
    
    // EWMA 파라미터
    this.ewmaAlpha = options.ewmaAlpha || 0.3;
    
    // 비정상 상황 추적
    this.lowPICount = 0; // 지속적으로 낮은 PI 카운트
    this.inconsistentHRCount = 0; // HR 후보 불일치 카운트
    this.noValidHRCount = 0; // 정상 HR 미산출 카운트
    
    // 상태 메시지
    this.statusMessage = '정상 측정';
    this.statusType = 'normal'; // 'normal', 'low_quality', 'reposition_needed'
  }

  /**
   * 새로운 데이터 추가 및 처리
   * 
   * @param {Object} data - 원시 데이터
   * @param {number} data.sampling_rate - 샘플링 레이트
   * @param {Array<string>} data.data - IR, RED, GREEN 원시 PPG (문자열 배열)
   * @param {number} data.spo2 - SpO₂ 값
   * @param {number} data.temp - 온도
   * @param {number} data.start_time - 시작 시간
   * @returns {Object|null} 처리 결과 { hr, spo2, temp, sqi, status, message } 또는 null
   */
  processData(data) {
    if (!data || !data.data || !Array.isArray(data.data)) {
      return null;
    }

    // 샘플링 레이트 설정 (처음 한 번만)
    if (!this.samplingRate && data.sampling_rate) {
      this.samplingRate = data.sampling_rate;
    }

    // 원시 데이터 파싱
    const parsedSamples = this.parseRawData(data.data);
    if (parsedSamples.length === 0) {
      return null;
    }

    // 윈도우 버퍼에 추가
    for (const sample of parsedSamples) {
      this.windowBuffer.ir.push(sample.ir);
      this.windowBuffer.red.push(sample.red);
      this.windowBuffer.green.push(sample.green);
      this.windowBuffer.spo2.push(data.spo2 || null);
      this.windowBuffer.timestamps.push(data.start_time || Date.now());
    }

    // 윈도우 크기 확인 (최소 5초)
    const windowDuration = this.windowBuffer.ir.length / (this.samplingRate || 20);
    if (windowDuration < this.windowSize) {
      // 아직 윈도우가 충분하지 않음
      return {
        hr: this.stableHR,
        spo2: data.spo2 || null,
        temp: data.temp || null,
        sqi: 0,
        status: 'collecting',
        message: '데이터 수집 중...',
        windowProgress: windowDuration / this.windowSize
      };
    }

    // 윈도우가 충분하면 HR 계산
    return this.calculateHR();
  }

  /**
   * 원시 데이터 파싱
   * 
   * @param {Array<string>} rawData - "ir,red,green" 형식의 문자열 배열
   * @returns {Array<Object>} 파싱된 샘플 배열
   */
  parseRawData(rawData) {
    const samples = [];

    for (const dataStr of rawData) {
      if (!dataStr || typeof dataStr !== 'string') continue;

      const values = dataStr.split(',');
      if (values.length !== 3) continue;

      const ir = parseFloat(values[0].trim());
      const red = parseFloat(values[1].trim());
      const green = parseFloat(values[2].trim());

      if (isNaN(ir) || isNaN(red) || isNaN(green)) continue;

      samples.push({ ir, red, green });
    }

    return samples;
  }

  /**
   * HR 계산 (5초 윈도우 기반)
   * 
   * @returns {Object} { hr, spo2, temp, sqi, status, message }
   */
  calculateHR() {
    const irSignal = this.windowBuffer.ir;
    const spo2Values = this.windowBuffer.spo2.filter(v => v !== null);

    if (irSignal.length === 0 || !this.samplingRate) {
      return {
        hr: this.stableHR,
        spo2: spo2Values.length > 0 ? spo2Values[spo2Values.length - 1] : null,
        temp: null,
        sqi: 0,
        status: 'error',
        message: '데이터 부족'
      };
    }

    // 1. PI 계산
    const piResult = calculatePI(irSignal);
    
    // PI가 너무 낮으면 HR 계산 불가
    if (!piResult.isValid || piResult.pi < 0.3) {
      this.lowPICount++;
      this.updateStatusForLowPI();
      
      // 윈도우 버퍼 초기화 (다음 윈도우 준비)
      this.clearWindowBuffer();
      
      return {
        hr: this.stableHR, // 마지막 정상값 유지
        spo2: spo2Values.length > 0 ? spo2Values[spo2Values.length - 1] : null,
        temp: null,
        sqi: 0,
        status: 'low_pi',
        message: '신호 품질이 낮습니다. 디바이스를 다시 부착해주세요.',
        pi: piResult.pi
      };
    }

    this.lowPICount = 0; // 정상 PI 복귀

    // 2. HR 후보 생성
    const hrCandidates = [];

    // 2-1. 시간영역 기반 HR
    const hrTimeDomain = calculateHRTimeDomain(irSignal, this.samplingRate);
    if (hrTimeDomain !== null) {
      hrCandidates.push({
        method: 'time_domain',
        value: hrTimeDomain,
        weight: 0
      });
    }

    // 2-2. 주파수 영역 기반 HR
    const hrFrequency = calculateHRFrequencyDomain(irSignal, this.samplingRate);
    if (hrFrequency !== null) {
      hrCandidates.push({
        method: 'frequency_domain',
        value: hrFrequency,
        weight: 0
      });
    }

    // 2-3. Autocorrelation 기반 HR
    const hrAutocorr = calculateHRAutocorrelation(irSignal, this.samplingRate);
    if (hrAutocorr !== null) {
      hrCandidates.push({
        method: 'autocorrelation',
        value: hrAutocorr,
        weight: 0
      });
    }

    // 2-4. 이전 HR 기반 예측
    const timeSinceLastHR = this.lastHRTime ? (Date.now() - this.lastHRTime) / 1000 : 0;
    const hrPredicted = predictHRFromPrevious(this.previousHR, timeSinceLastHR);
    if (hrPredicted !== null) {
      hrCandidates.push({
        method: 'prediction',
        value: hrPredicted,
        weight: 0
      });
    }

    if (hrCandidates.length === 0) {
      this.noValidHRCount++;
      this.updateStatusForNoHR();
      
      this.clearWindowBuffer();
      
      return {
        hr: this.stableHR,
        spo2: spo2Values.length > 0 ? spo2Values[spo2Values.length - 1] : null,
        temp: null,
        sqi: 0,
        status: 'no_hr',
        message: '심박수를 계산할 수 없습니다. 디바이스 위치를 확인해주세요.',
        candidates: []
      };
    }

    // 3. 각 후보에 대한 SQI 계산
    const waveformPeriodicity = calculateWaveformPeriodicity(irSignal, this.samplingRate);
    const spo2Variability = calculateSpO2Variability(spo2Values);

    for (const candidate of hrCandidates) {
      const sqi = calculateSQI({
        pi: piResult.pi,
        hrCandidate: candidate.value,
        allCandidates: hrCandidates.map(c => c.value),
        previousHR: this.previousHR,
        spo2Variability,
        waveformPeriodicity
      });
      
      candidate.sqi = sqi;
      candidate.weight = sqi; // SQI를 가중치로 사용
    }

    // 4. HR 결정 (Weighted Median 사용)
    const finalHR = calculateWeightedMedian(hrCandidates);
    
    if (finalHR === null) {
      this.noValidHRCount++;
      this.updateStatusForNoHR();
      
      this.clearWindowBuffer();
      
      return {
        hr: this.stableHR,
        spo2: spo2Values.length > 0 ? spo2Values[spo2Values.length - 1] : null,
        temp: null,
        sqi: 0,
        status: 'no_hr',
        message: '심박수를 계산할 수 없습니다.',
        candidates: hrCandidates
      };
    }

    // 5. 시간 연속성 검증
    if (!validateTimeContinuity(finalHR, this.previousHR)) {
      this.inconsistentHRCount++;
      
      // 급변하는 값은 거부하고 이전 값 유지
      this.clearWindowBuffer();
      
      return {
        hr: this.stableHR,
        spo2: spo2Values.length > 0 ? spo2Values[spo2Values.length - 1] : null,
        temp: null,
        sqi: 0,
        status: 'inconsistent',
        message: '심박수 변화가 비정상적입니다. 측정을 확인해주세요.',
        rejectedHR: finalHR,
        candidates: hrCandidates
      };
    }

    this.inconsistentHRCount = 0; // 정상 복귀

    // 6. EWMA로 안정화
    const stabilizedHR = applyEWMA(finalHR, this.stableHR, this.ewmaAlpha);

    // 7. 상태 업데이트
    this.previousHR = finalHR;
    this.stableHR = Math.round(stabilizedHR);
    this.lastHRTime = Date.now();
    this.noValidHRCount = 0;

    // 평균 SQI 계산
    const avgSQI = hrCandidates.reduce((sum, c) => sum + c.sqi, 0) / hrCandidates.length;

    // 상태 메시지 업데이트
    this.updateStatusMessage(avgSQI, piResult.pi);

    // 윈도우 버퍼 초기화 (다음 윈도우 준비)
    this.clearWindowBuffer();

    return {
      hr: this.stableHR,
      spo2: spo2Values.length > 0 ? spo2Values[spo2Values.length - 1] : null,
      temp: null,
      sqi: avgSQI,
      status: this.statusType,
      message: this.statusMessage,
      pi: piResult.pi,
      candidates: hrCandidates.map(c => ({
        method: c.method,
        value: c.value,
        sqi: c.sqi
      }))
    };
  }

  /**
   * 윈도우 버퍼 초기화
   */
  clearWindowBuffer() {
    // 최근 1초 데이터는 유지 (연속성 보장)
    const keepSamples = Math.floor((this.samplingRate || 20) * 1);
    
    if (this.windowBuffer.ir.length > keepSamples) {
      this.windowBuffer.ir = this.windowBuffer.ir.slice(-keepSamples);
      this.windowBuffer.red = this.windowBuffer.red.slice(-keepSamples);
      this.windowBuffer.green = this.windowBuffer.green.slice(-keepSamples);
      this.windowBuffer.spo2 = this.windowBuffer.spo2.slice(-keepSamples);
      this.windowBuffer.timestamps = this.windowBuffer.timestamps.slice(-keepSamples);
    } else {
      // 버퍼가 작으면 완전 초기화
      this.windowBuffer.ir = [];
      this.windowBuffer.red = [];
      this.windowBuffer.green = [];
      this.windowBuffer.spo2 = [];
      this.windowBuffer.timestamps = [];
    }
  }

  /**
   * 낮은 PI 상황에 대한 상태 업데이트
   */
  updateStatusForLowPI() {
    if (this.lowPICount >= 3) {
      this.statusType = 'reposition_needed';
      this.statusMessage = '신호 품질이 지속적으로 낮습니다. 디바이스를 다시 부착해주세요.';
    } else {
      this.statusType = 'low_quality';
      this.statusMessage = '신호 품질이 낮습니다. 디바이스 위치를 확인해주세요.';
    }
  }

  /**
   * HR 미산출 상황에 대한 상태 업데이트
   */
  updateStatusForNoHR() {
    if (this.noValidHRCount >= 5) {
      this.statusType = 'reposition_needed';
      this.statusMessage = '심박수를 계산할 수 없습니다. 디바이스를 다시 부착해주세요.';
    } else {
      this.statusType = 'low_quality';
      this.statusMessage = '심박수 계산 중...';
    }
  }

  /**
   * 상태 메시지 업데이트
   */
  updateStatusMessage(sqi, pi) {
    if (sqi >= 0.7 && pi >= 0.6) {
      this.statusType = 'normal';
      this.statusMessage = '정상 측정';
    } else if (sqi >= 0.5 || pi >= 0.3) {
      this.statusType = 'low_quality';
      this.statusMessage = '신뢰도 낮음';
    } else {
      this.statusType = 'reposition_needed';
      this.statusMessage = '재부착 필요';
    }
  }

  /**
   * 현재 상태 조회
   */
  getStatus() {
    return {
      stableHR: this.stableHR,
      previousHR: this.previousHR,
      statusType: this.statusType,
      statusMessage: this.statusMessage,
      windowSize: this.windowBuffer.ir.length,
      samplingRate: this.samplingRate
    };
  }

  /**
   * 리셋
   */
  reset() {
    this.windowBuffer = {
      ir: [],
      red: [],
      green: [],
      spo2: [],
      timestamps: []
    };
    this.stableHR = null;
    this.previousHR = null;
    this.lastHRTime = null;
    this.lowPICount = 0;
    this.inconsistentHRCount = 0;
    this.noValidHRCount = 0;
    this.statusMessage = '정상 측정';
    this.statusType = 'normal';
  }
}

/**
 * 디바이스별 HR 프로세서 관리
 */
class HeartRateProcessorManager {
  constructor() {
    this.processors = new Map(); // deviceId -> HeartRateProcessor
  }

  /**
   * 디바이스 프로세서 가져오기 또는 생성
   */
  getProcessor(deviceId) {
    if (!this.processors.has(deviceId)) {
      this.processors.set(deviceId, new HeartRateProcessor(deviceId));
    }
    return this.processors.get(deviceId);
  }

  /**
   * 데이터 처리
   */
  processData(deviceId, data) {
    const processor = this.getProcessor(deviceId);
    return processor.processData(data);
  }

  /**
   * 프로세서 제거
   */
  removeProcessor(deviceId) {
    this.processors.delete(deviceId);
  }

  /**
   * 모든 프로세서 상태 조회
   */
  getAllStatus() {
    const status = {};
    for (const [deviceId, processor] of this.processors.entries()) {
      status[deviceId] = processor.getStatus();
    }
    return status;
  }
}

// 싱글톤 인스턴스
const manager = new HeartRateProcessorManager();

module.exports = {
  HeartRateProcessor,
  HeartRateProcessorManager,
  getProcessor: (deviceId) => manager.getProcessor(deviceId),
  processData: (deviceId, data) => manager.processData(deviceId, data),
  removeProcessor: (deviceId) => manager.removeProcessor(deviceId),
  getAllStatus: () => manager.getAllStatus()
};

