import React, { useState } from "react";

const BasicHrvMetrics = ({ metrics }) => {
  const [showDetails, setShowDetails] = useState(false);

  if (!metrics) return null;

  // HRV 지표별 정상 범위와 해석
  const hrvRanges = {
    meanRR: {
      normal: { min: 600, max: 1200 },
      caution: { min: 500, max: 1400 },
      unit: "ms",
      description: "RR 간격의 평균값으로 심박수와 반비례 관계입니다.",
    },
    bpm: {
      normal: { min: 60, max: 100 },
      caution: { min: 50, max: 120 },
      unit: "BPM",
      description: "분당 심박수로 심장의 전반적인 활동 수준을 나타냅니다.",
    },
    sdnn: {
      normal: { min: 20, max: 100 },
      caution: { min: 15, max: 150 },
      unit: "ms",
      description: "RR 간격의 표준편차로 전체적인 심박변이도를 나타냅니다.",
    },
    rmssd: {
      normal: { min: 15, max: 80 },
      caution: { min: 10, max: 120 },
      unit: "ms",
      description: "연속된 RR 간격 차이의 제곱근 평균으로 부교감신경계 활성도를 나타냅니다.",
    },
    pnn50: {
      normal: { min: 3, max: 30 },
      caution: { min: 1, max: 50 },
      unit: "%",
      description: "50ms 이상 차이나는 연속 RR 간격의 비율로 부교감신경계 활성도를 나타냅니다.",
    }
  };

  const getStatus = (value, ranges) => {
    if (value >= ranges.normal.min && value <= ranges.normal.max) {
      return { status: 'normal', color: '#4CAF50', text: '정상' };
    } else if (value >= ranges.caution.min && value <= ranges.caution.max) {
      return { status: 'caution', color: '#FF9800', text: '주의' };
    } else {
      return { status: 'abnormal', color: '#F44336', text: '위험' };
    }
  };

  return (
    <div className="hrv-metrics">
      <div className="metrics-header">
        <h3>기본 HRV 지표</h3>
        <button 
          className="toggle-button"
          onClick={() => setShowDetails(!showDetails)}
        >
          {showDetails ? '간단히 보기' : '상세 정보 보기'}
        </button>
      </div>
      
      <div className="metrics-grid">
        {Object.entries(hrvRanges).map(([key, ranges]) => {
          const value = metrics[key];
          if (value === undefined || value === null) return null;
          
          const status = getStatus(value, ranges);
          
          return (
            <div key={key} className="metric-item">
              <div className="metric-header">
                <strong>{key === 'meanRR' ? '평균 RR 간격' : 
                        key === 'bpm' ? '평균 심박수' :
                        key === 'sdnn' ? 'SDNN' :
                        key === 'rmssd' ? 'RMSSD' : 'pNN50'}:</strong>
                <span className="metric-value" style={{ color: status.color }}>
                  {value.toFixed(2)} {ranges.unit}
                </span>
                <span className="status-badge" style={{ backgroundColor: status.color }}>
                  {status.text}
                </span>
              </div>
              
              {showDetails && (
                <div className="metric-details">
                  <div className="normal-range">
                    <strong>정상 범위:</strong> {ranges.normal.min}-{ranges.normal.max} {ranges.unit}
                  </div>
                  <div className="description">
                    <strong>설명:</strong> {ranges.description}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BasicHrvMetrics;

