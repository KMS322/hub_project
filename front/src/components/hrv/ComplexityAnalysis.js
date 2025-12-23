import React, { useState } from "react";

const ComplexityAnalysis = ({ metrics }) => {
  const [showDetails, setShowDetails] = useState(false);

  if (!metrics) return null;

  // 복잡도 분석 지표별 정상 범위와 설명
  const complexityRanges = {
    sampleEntropy: {
      normal: { min: 0.8, max: 2.0 },
      caution: { min: 0.5, max: 2.5 },
      unit: "",
      description: "신호의 복잡도와 예측 불가능성을 나타내며, 높을수록 건강한 심박 리듬을 의미합니다."
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
        <h3>복잡도 분석</h3>
        <button 
          className="toggle-button"
          onClick={() => setShowDetails(!showDetails)}
        >
          {showDetails ? '간단히 보기' : '상세 정보 보기'}
        </button>
      </div>
      
      <div className="metrics-grid">
        {Object.entries(complexityRanges).map(([key, ranges]) => {
          const value = metrics[key];
          if (value === undefined || value === null) return null;
          
          const status = getStatus(value, ranges);
          
          return (
            <div key={key} className="metric-item">
              <div className="metric-header">
                <strong>Sample Entropy:</strong>
                <span className="metric-value" style={{ color: status.color }}>
                  {value.toFixed(3)} {ranges.unit}
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

export default ComplexityAnalysis;

