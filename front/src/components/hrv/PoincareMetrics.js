import React, { useState } from "react";

const PoincareMetrics = ({ metrics }) => {
  const [showDetails, setShowDetails] = useState(false);

  if (!metrics) return null;

  // Poincare Plot 지표별 정상 범위와 설명
  const poincareRanges = {
    sd1: {
      normal: { min: 10, max: 60 },
      caution: { min: 5, max: 100 },
      unit: "ms",
      description: "단기 변이성을 나타내며, 부교감신경계의 활성도를 반영합니다."
    },
    sd2: {
      normal: { min: 20, max: 100 },
      caution: { min: 10, max: 150 },
      unit: "ms",
      description: "장기 변이성을 나타내며, 교감신경계와 부교감신경계의 복합적 활성도를 반영합니다."
    },
    ellipseArea: {
      normal: { min: 200, max: 10000 },
      caution: { min: 100, max: 50000 },
      unit: "ms²",
      description: "Poincare 타원의 면적으로 전체적인 심박변이도의 크기를 나타냅니다."
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
        <h3>Poincare Plot 지표</h3>
        <button 
          className="toggle-button"
          onClick={() => setShowDetails(!showDetails)}
        >
          {showDetails ? '간단히 보기' : '상세 정보 보기'}
        </button>
      </div>
      
      <div className="metrics-grid">
        {Object.entries(poincareRanges).map(([key, ranges]) => {
          const value = metrics[key];
          if (value === undefined || value === null) return null;
          
          const status = getStatus(value, ranges);
          
          return (
            <div key={key} className="metric-item">
              <div className="metric-header">
                <strong>{key === 'sd1' ? 'SD1' : 
                        key === 'sd2' ? 'SD2' : 'Ellipse Area'}:</strong>
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

export default PoincareMetrics;

