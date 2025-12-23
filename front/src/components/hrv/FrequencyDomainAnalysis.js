import React, { useState } from "react";

const FrequencyDomainAnalysis = ({ metrics }) => {
  const [showDetails, setShowDetails] = useState(false);

  if (!metrics) return null;

  // 주파수 도메인 지표별 정상 범위와 설명
  const frequencyRanges = {
    lf: {
      normal: { min: 1000, max: 10000000 },
      caution: { min: 500, max: 50000000 },
      unit: "ms²",
      description: "저주파 대역 파워로 교감신경계와 부교감신경계의 복합적 활성도를 나타냅니다."
    },
    hf: {
      normal: { min: 500, max: 5000000 },
      caution: { min: 250, max: 25000000 },
      unit: "ms²",
      description: "고주파 대역 파워로 부교감신경계(미주신경)의 활성도를 나타냅니다."
    },
    lfHfRatio: {
      normal: { min: 0.5, max: 3.0 },
      caution: { min: 0.2, max: 5.0 },
      unit: "",
      description: "LF와 HF의 비율로 자율신경계 균형을 나타내며, 스트레스 지표로 활용됩니다."
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
        <h3>주파수 도메인 분석</h3>
        <button 
          className="toggle-button"
          onClick={() => setShowDetails(!showDetails)}
        >
          {showDetails ? '간단히 보기' : '상세 정보 보기'}
        </button>
      </div>
      
      <div className="metrics-grid">
        {Object.entries(frequencyRanges).map(([key, ranges]) => {
          const value = metrics[key];
          if (value === undefined || value === null) return null;
          
          const status = getStatus(value, ranges);
          
          return (
            <div key={key} className="metric-item">
              <div className="metric-header">
                <strong>{key === 'lf' ? 'LF Power' : 
                        key === 'hf' ? 'HF Power' : 'LF/HF Ratio'}:</strong>
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

export default FrequencyDomainAnalysis;

