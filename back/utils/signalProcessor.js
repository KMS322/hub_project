/**
 * 의료용 웨어러블 신호처리 모듈
 * 
 * 강아지 목에 장착된 심박 측정기의 PPG 신호를 처리하여
 * 신뢰 가능한 심박수(HR)를 산출한다.
 * 
 * 핵심 원칙:
 * - CSV에는 원본 데이터만 저장
 * - 프론트엔드에는 안정화된 HR만 전달
 * - 모든 계산 단계는 추적 가능해야 함
 */

/**
 * PI (Perfusion Index) 계산
 * PI = (AC / DC) × 100
 * 
 * @param {Array<number>} irSignal - IR 신호 배열
 * @returns {Object} { pi, dc, ac, isValid }
 */
function calculatePI(irSignal) {
  if (!Array.isArray(irSignal) || irSignal.length === 0) {
    return { pi: 0, dc: 0, ac: 0, isValid: false };
  }

  // DC: 평균값
  const dc = irSignal.reduce((sum, val) => sum + val, 0) / irSignal.length;

  // AC: (max - min) / 2
  const max = Math.max(...irSignal);
  const min = Math.min(...irSignal);
  const ac = (max - min) / 2;

  // PI 계산
  const pi = dc > 0 ? (ac / dc) * 100 : 0;

  // PI 유효성 검사
  const isValid = pi >= 0.3; // PI < 0.3이면 신뢰 불가

  return { pi, dc, ac, isValid };
}

/**
 * 시간영역 피크 검출 기반 HR 계산
 * 
 * @param {Array<number>} irSignal - IR 신호 배열
 * @param {number} samplingRate - 샘플링 레이트 (Hz)
 * @returns {number|null} HR (bpm) 또는 null
 */
function calculateHRTimeDomain(irSignal, samplingRate) {
  if (!Array.isArray(irSignal) || irSignal.length < 10 || !samplingRate || samplingRate <= 0) {
    return null;
  }

  // 신호 정규화
  const mean = irSignal.reduce((sum, val) => sum + val, 0) / irSignal.length;
  const normalized = irSignal.map(val => val - mean);

  // 피크 검출 (간단한 로컬 최대값)
  const peaks = [];
  const threshold = Math.max(...normalized.map(Math.abs)) * 0.3; // 최대값의 30% 이상

  for (let i = 1; i < normalized.length - 1; i++) {
    if (normalized[i] > normalized[i - 1] && 
        normalized[i] > normalized[i + 1] && 
        normalized[i] > threshold) {
      peaks.push(i);
    }
  }

  if (peaks.length < 2) {
    return null;
  }

  // 피크 간격 평균 계산
  const intervals = [];
  for (let i = 1; i < peaks.length; i++) {
    intervals.push(peaks[i] - peaks[i - 1]);
  }

  const avgInterval = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
  const periodSeconds = avgInterval / samplingRate;
  const hr = periodSeconds > 0 ? 60 / periodSeconds : null;

  // 강아지 생리 범위 검증 (40-200 bpm)
  if (hr && hr >= 40 && hr <= 200) {
    return Math.round(hr);
  }

  return null;
}

/**
 * FFT 기반 주파수 영역 HR 계산
 * 
 * @param {Array<number>} irSignal - IR 신호 배열
 * @param {number} samplingRate - 샘플링 레이트 (Hz)
 * @returns {number|null} HR (bpm) 또는 null
 */
function calculateHRFrequencyDomain(irSignal, samplingRate) {
  if (!Array.isArray(irSignal) || irSignal.length < 32 || !samplingRate || samplingRate <= 0) {
    return null;
  }

  // 간단한 FFT 구현 (실제로는 더 정교한 라이브러리 사용 권장)
  // 여기서는 간단한 주파수 분석 사용
  const n = irSignal.length;
  const fftSize = Math.pow(2, Math.ceil(Math.log2(n)));

  // 윈도우 함수 적용 (Hamming)
  const windowed = irSignal.map((val, i) => {
    const window = 0.54 - 0.46 * Math.cos(2 * Math.PI * i / (n - 1));
    return val * window;
  });

  // 제로 패딩
  const padded = [...windowed];
  while (padded.length < fftSize) {
    padded.push(0);
  }

  // 간단한 주파수 분석 (실제 FFT 대신 주파수 범위 검색)
  // 강아지 HR 범위: 40-200 bpm = 0.67-3.33 Hz
  const minFreq = 0.67; // 40 bpm
  const maxFreq = 3.33; // 200 bpm
  const freqResolution = samplingRate / fftSize;

  let maxPower = 0;
  let dominantFreq = null;

  // 주파수 범위 내에서 최대 파워 찾기
  for (let k = 0; k < fftSize / 2; k++) {
    const freq = k * freqResolution;
    if (freq >= minFreq && freq <= maxFreq) {
      // 간단한 파워 계산 (실제로는 FFT 결과 사용)
      let power = 0;
      for (let i = 0; i < padded.length; i++) {
        power += padded[i] * Math.cos(2 * Math.PI * k * i / fftSize);
      }
      power = Math.abs(power);

      if (power > maxPower) {
        maxPower = power;
        dominantFreq = freq;
      }
    }
  }

  if (dominantFreq && dominantFreq > 0) {
    const hr = Math.round(dominantFreq * 60);
    if (hr >= 40 && hr <= 200) {
      return hr;
    }
  }

  return null;
}

/**
 * Autocorrelation 기반 HR 계산
 * 
 * @param {Array<number>} irSignal - IR 신호 배열
 * @param {number} samplingRate - 샘플링 레이트 (Hz)
 * @returns {number|null} HR (bpm) 또는 null
 */
function calculateHRAutocorrelation(irSignal, samplingRate) {
  if (!Array.isArray(irSignal) || irSignal.length < 20 || !samplingRate || samplingRate <= 0) {
    return null;
  }

  // 신호 정규화
  const mean = irSignal.reduce((sum, val) => sum + val, 0) / irSignal.length;
  const normalized = irSignal.map(val => val - mean);

  // Autocorrelation 계산
  const maxLag = Math.min(normalized.length / 2, Math.floor(samplingRate * 2)); // 최대 2초
  let maxCorr = -Infinity;
  let bestLag = null;

  for (let lag = Math.floor(samplingRate * 0.3); lag < maxLag; lag++) {
    let corr = 0;
    for (let i = 0; i < normalized.length - lag; i++) {
      corr += normalized[i] * normalized[i + lag];
    }
    corr = corr / (normalized.length - lag);

    if (corr > maxCorr) {
      maxCorr = corr;
      bestLag = lag;
    }
  }

  if (bestLag && bestLag > 0) {
    const periodSeconds = bestLag / samplingRate;
    const hr = 60 / periodSeconds;
    
    if (hr >= 40 && hr <= 200) {
      return Math.round(hr);
    }
  }

  return null;
}

/**
 * 이전 HR 기반 예측 후보 생성
 * 
 * @param {number|null} previousHR - 이전 HR 값
 * @param {number} timeSinceLastHR - 마지막 HR 이후 경과 시간 (초)
 * @returns {number|null} 예측 HR 또는 null
 */
function predictHRFromPrevious(previousHR, timeSinceLastHR) {
  if (!previousHR || previousHR < 40 || previousHR > 200) {
    return null;
  }

  // 시간이 너무 오래 지나면 예측 불가
  if (timeSinceLastHR > 10) {
    return null;
  }

  // 이전 HR을 그대로 사용 (변화율이 크지 않다고 가정)
  // 실제로는 더 정교한 예측 모델 사용 가능
  return previousHR;
}

/**
 * SQI (Signal Quality Index) 계산
 * 
 * @param {Object} params - SQI 계산 파라미터
 * @param {number} params.pi - PI 값
 * @param {number|null} params.hrCandidate - HR 후보 값
 * @param {Array<number|null>} params.allCandidates - 모든 HR 후보 배열
 * @param {number|null} params.previousHR - 이전 HR 값
 * @param {number} params.spo2Variability - SpO₂ 변동성
 * @param {number} params.waveformPeriodicity - 파형 주기성 점수 (0-1)
 * @returns {number} SQI (0-1)
 */
function calculateSQI(params) {
  const {
    pi,
    hrCandidate,
    allCandidates,
    previousHR,
    spo2Variability,
    waveformPeriodicity
  } = params;

  let sqi = 0;
  let factors = 0;

  // 1. PI 기반 신뢰도 (0-0.3)
  if (pi >= 0.6) {
    sqi += 0.3;
  } else if (pi >= 0.3) {
    sqi += 0.15;
  }
  factors += 0.3;

  // 2. HR 생리 범위 적합성 (0-0.2)
  if (hrCandidate && hrCandidate >= 40 && hrCandidate <= 200) {
    sqi += 0.2;
  }
  factors += 0.2;

  // 3. HR 후보 간 일관성 (0-0.2)
  if (allCandidates && allCandidates.length > 1) {
    const validCandidates = allCandidates.filter(c => c !== null && c >= 40 && c <= 200);
    if (validCandidates.length > 0) {
      const mean = validCandidates.reduce((sum, c) => sum + c, 0) / validCandidates.length;
      const variance = validCandidates.reduce((sum, c) => sum + Math.pow(c - mean, 2), 0) / validCandidates.length;
      const stdDev = Math.sqrt(variance);
      const consistency = stdDev < 10 ? 0.2 : (stdDev < 20 ? 0.1 : 0);
      sqi += consistency;
    }
  }
  factors += 0.2;

  // 4. 파형 주기성 (0-0.15)
  if (waveformPeriodicity !== undefined) {
    sqi += waveformPeriodicity * 0.15;
  }
  factors += 0.15;

  // 5. 이전 HR과의 연속성 (0-0.1)
  if (previousHR && hrCandidate) {
    const change = Math.abs(hrCandidate - previousHR) / previousHR;
    if (change < 0.25) { // 25% 이내 변화
      sqi += 0.1;
    } else if (change < 0.5) {
      sqi += 0.05;
    }
  }
  factors += 0.1;

  // 6. SpO₂ 변동성 (0-0.05)
  if (spo2Variability !== undefined) {
    const spo2Score = spo2Variability < 2 ? 0.05 : (spo2Variability < 5 ? 0.025 : 0);
    sqi += spo2Score;
  }
  factors += 0.05;

  // 정규화 (0-1 범위)
  return Math.min(1, sqi / factors);
}

/**
 * 파형 주기성 점수 계산
 * 
 * @param {Array<number>} irSignal - IR 신호 배열
 * @param {number} samplingRate - 샘플링 레이트 (Hz)
 * @returns {number} 주기성 점수 (0-1)
 */
function calculateWaveformPeriodicity(irSignal, samplingRate) {
  if (!Array.isArray(irSignal) || irSignal.length < 20 || !samplingRate) {
    return 0;
  }

  // Autocorrelation의 피크 간 일관성으로 주기성 측정
  const mean = irSignal.reduce((sum, val) => sum + val, 0) / irSignal.length;
  const normalized = irSignal.map(val => val - mean);

  const maxLag = Math.min(normalized.length / 2, Math.floor(samplingRate * 2));
  const correlations = [];

  for (let lag = Math.floor(samplingRate * 0.3); lag < maxLag; lag++) {
    let corr = 0;
    for (let i = 0; i < normalized.length - lag; i++) {
      corr += normalized[i] * normalized[i + lag];
    }
    correlations.push({ lag, corr: corr / (normalized.length - lag) });
  }

  // 피크 찾기
  const peaks = [];
  for (let i = 1; i < correlations.length - 1; i++) {
    if (correlations[i].corr > correlations[i - 1].corr &&
        correlations[i].corr > correlations[i + 1].corr &&
        correlations[i].corr > 0) {
      peaks.push(correlations[i]);
    }
  }

  if (peaks.length < 2) {
    return 0;
  }

  // 피크 간격의 일관성 계산
  const intervals = [];
  for (let i = 1; i < peaks.length; i++) {
    intervals.push(peaks[i].lag - peaks[i - 1].lag);
  }

  const meanInterval = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
  const variance = intervals.reduce((sum, val) => sum + Math.pow(val - meanInterval, 2), 0) / intervals.length;
  const cv = meanInterval > 0 ? Math.sqrt(variance) / meanInterval : 1; // 변동계수

  // 변동계수가 낮을수록 주기성이 높음
  return Math.max(0, 1 - cv);
}

/**
 * SpO₂ 변동성 계산
 * 
 * @param {Array<number>} spo2Values - SpO₂ 값 배열
 * @returns {number} 변동성 (표준편차)
 */
function calculateSpO2Variability(spo2Values) {
  if (!Array.isArray(spo2Values) || spo2Values.length < 2) {
    return 0;
  }

  const validValues = spo2Values.filter(v => v !== null && v !== undefined && v > 0);
  if (validValues.length < 2) {
    return 0;
  }

  const mean = validValues.reduce((sum, val) => sum + val, 0) / validValues.length;
  const variance = validValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / validValues.length;
  return Math.sqrt(variance);
}

/**
 * Weighted Median 계산
 * 
 * @param {Array<Object>} candidates - { value, weight } 배열
 * @returns {number|null} Weighted Median 값
 */
function calculateWeightedMedian(candidates) {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return null;
  }

  // 유효한 후보만 필터링
  const validCandidates = candidates.filter(c => 
    c.value !== null && 
    c.value !== undefined && 
    c.weight > 0 &&
    c.value >= 40 && 
    c.value <= 200
  );

  if (validCandidates.length === 0) {
    return null;
  }

  // 값으로 정렬
  validCandidates.sort((a, b) => a.value - b.value);

  // 총 가중치 계산
  const totalWeight = validCandidates.reduce((sum, c) => sum + c.weight, 0);
  const medianWeight = totalWeight / 2;

  // 중간 가중치 위치 찾기
  let cumulativeWeight = 0;
  for (const candidate of validCandidates) {
    cumulativeWeight += candidate.weight;
    if (cumulativeWeight >= medianWeight) {
      return Math.round(candidate.value);
    }
  }

  return Math.round(validCandidates[validCandidates.length - 1].value);
}

/**
 * Majority Voting with SQI weights
 * 
 * @param {Array<Object>} candidates - { value, weight } 배열
 * @returns {number|null} Majority 값
 */
function calculateMajorityVoting(candidates) {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return null;
  }

  // 유효한 후보만 필터링
  const validCandidates = candidates.filter(c => 
    c.value !== null && 
    c.value !== undefined && 
    c.weight > 0 &&
    c.value >= 40 && 
    c.value <= 200
  );

  if (validCandidates.length === 0) {
    return null;
  }

  // 값별로 그룹화하고 가중치 합산
  const groups = new Map();
  for (const candidate of validCandidates) {
    const rounded = Math.round(candidate.value);
    if (!groups.has(rounded)) {
      groups.set(rounded, 0);
    }
    groups.set(rounded, groups.get(rounded) + candidate.weight);
  }

  // 최대 가중치를 가진 값 찾기
  let maxWeight = 0;
  let majorityValue = null;

  for (const [value, weight] of groups.entries()) {
    if (weight > maxWeight) {
      maxWeight = weight;
      majorityValue = value;
    }
  }

  return majorityValue;
}

/**
 * EWMA (Exponentially Weighted Moving Average) 필터
 * 
 * @param {number} currentValue - 현재 값
 * @param {number|null} previousValue - 이전 필터링된 값
 * @param {number} alpha - 평활화 계수 (0-1, 기본 0.3)
 * @returns {number} 필터링된 값
 */
function applyEWMA(currentValue, previousValue, alpha = 0.3) {
  if (previousValue === null || previousValue === undefined) {
    return currentValue;
  }

  return alpha * currentValue + (1 - alpha) * previousValue;
}

/**
 * 시간 연속성 검증
 * 이전 HR 대비 25% 이상 급변하는 값은 거부
 * 
 * @param {number} newHR - 새로운 HR 값
 * @param {number|null} previousHR - 이전 HR 값
 * @returns {boolean} 유효 여부
 */
function validateTimeContinuity(newHR, previousHR) {
  if (previousHR === null || previousHR === undefined) {
    return true; // 첫 값은 항상 허용
  }

  const change = Math.abs(newHR - previousHR) / previousHR;
  return change < 0.25; // 25% 이내 변화만 허용
}

module.exports = {
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
};

