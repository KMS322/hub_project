import React, { useState } from "react";

const StressAnalysis = ({ metrics, hrvData }) => {
  const [showDetails, setShowDetails] = useState(false);

  if (!metrics || !hrvData) return null;

  // 스트레스 관련 지표 계산
  const calculateStressIndices = () => {
    const meanRR = metrics.meanRR;
    const sdnn = metrics.sdnn;
    const rmssd = metrics.rmssd;
    const lfHfRatio = metrics.lfHfRatio;
    
    // 1. 스트레스 지수 (Stress Index)
    const stressIndex = (sdnn > 0) ? (1000 / sdnn) : 0;
    
    // 2. 자율신경계 균형 지수 (ANS Balance Index)
    const ansBalance = lfHfRatio;
    
    // 3. 심박변이도 지수 (HRV Index) - RMSSD 기반
    const hrvIndex = rmssd;
    
    // 4. 스트레스 저항성 지수 (Stress Resistance Index)
    const stressResistance = (rmssd > 0) ? (100 / rmssd) : 0;
    
    // 5. 심박 안정성 지수 (Heart Rate Stability Index)
    const hrStability = (sdnn > 0) ? (meanRR / sdnn) : 0;
    
    // 6. 복구 지수 (Recovery Index) - pNN50 기반
    const recoveryIndex = metrics.pnn50 || 0;
    
    // 7. 활성화 지수 (Activation Index) - LF/HF 비율 기반
    const activationIndex = lfHfRatio;
    
    // 8. 이완 지수 (Relaxation Index) - HF 파워 기반
    const relaxationIndex = (metrics.hf > 0) ? Math.log(metrics.hf) : 0;
    
    // 9. 전체 스트레스 점수 (Overall Stress Score) - 0-100
    const overallStressScore = Math.min(100, Math.max(0, 
      (stressIndex * 0.3) + 
      (ansBalance * 10 * 0.2) + 
      (stressResistance * 0.2) + 
      ((100 - recoveryIndex) * 0.3)
    ));
    
    // 10. 스트레스 레벨 (Stress Level) - 1-5
    let stressLevel = 1;
    if (overallStressScore < 20) stressLevel = 1; // 매우 낮음
    else if (overallStressScore < 40) stressLevel = 2; // 낮음
    else if (overallStressScore < 60) stressLevel = 3; // 보통
    else if (overallStressScore < 80) stressLevel = 4; // 높음
    else stressLevel = 5; // 매우 높음

    return {
      stressIndex,
      ansBalance,
      hrvIndex,
      stressResistance,
      hrStability,
      recoveryIndex,
      activationIndex,
      relaxationIndex,
      overallStressScore,
      stressLevel
    };
  };

  const stressIndices = calculateStressIndices();

  // 스트레스 지표별 정상 범위와 설명
  const stressRanges = {
    stressIndex: {
      normal: { min: 5, max: 20 },
      caution: { min: 3, max: 30 },
      unit: "",
      description: "스트레스 지수로 낮을수록 스트레스가 적음을 의미합니다."
    },
    ansBalance: {
      normal: { min: 0.5, max: 3.0 },
      caution: { min: 0.2, max: 5.0 },
      unit: "",
      description: "자율신경계 균형 지수로 1에 가까울수록 균형이 좋습니다."
    },
    hrvIndex: {
      normal: { min: 15, max: 80 },
      caution: { min: 10, max: 120 },
      unit: "ms",
      description: "심박변이도 지수로 높을수록 건강한 심박 리듬을 의미합니다."
    },
    stressResistance: {
      normal: { min: 1, max: 5 },
      caution: { min: 0.5, max: 8 },
      unit: "",
      description: "스트레스 저항성 지수로 낮을수록 스트레스에 잘 견딥니다."
    },
    hrStability: {
      normal: { min: 5, max: 20 },
      caution: { min: 3, max: 30 },
      unit: "",
      description: "심박 안정성 지수로 높을수록 안정적인 심박을 의미합니다."
    },
    recoveryIndex: {
      normal: { min: 3, max: 30 },
      caution: { min: 1, max: 50 },
      unit: "%",
      description: "복구 지수로 높을수록 빠른 회복력을 의미합니다."
    },
    activationIndex: {
      normal: { min: 0.5, max: 3.0 },
      caution: { min: 0.2, max: 5.0 },
      unit: "",
      description: "활성화 지수로 적절한 수준의 활성화를 나타냅니다."
    },
    relaxationIndex: {
      normal: { min: 5, max: 15 },
      caution: { min: 3, max: 20 },
      unit: "",
      description: "이완 지수로 높을수록 이완 상태가 좋음을 의미합니다."
    },
    overallStressScore: {
      normal: { min: 0, max: 40 },
      caution: { min: 0, max: 60 },
      unit: "점",
      description: "전체 스트레스 점수로 낮을수록 스트레스가 적습니다."
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

  const getStressLevelText = (level) => {
    const levels = {
      1: { text: '매우 낮음', color: '#4CAF50' },
      2: { text: '낮음', color: '#8BC34A' },
      3: { text: '보통', color: '#FF9800' },
      4: { text: '높음', color: '#FF5722' },
      5: { text: '매우 높음', color: '#F44336' }
    };
    return levels[level] || levels[3];
  };

  const stressLevelInfo = getStressLevelText(stressIndices.stressLevel);

  return (
    <div className="hrv-metrics">
      <div className="metrics-header">
        <h3>스트레스 분석 지표</h3>
        <button 
          className="toggle-button"
          onClick={() => setShowDetails(!showDetails)}
        >
          {showDetails ? '간단히 보기' : '상세 정보 보기'}
        </button>
      </div>
      
      {/* 전체 스트레스 점수와 레벨 */}
      <div className="stress-summary">
        <div className="stress-score-card">
          <h4>전체 스트레스 점수</h4>
          <div className="stress-score" style={{ color: stressLevelInfo.color }}>
            {stressIndices.overallStressScore.toFixed(1)}점
          </div>
          <div className="stress-level" style={{ color: stressLevelInfo.color }}>
            레벨 {stressIndices.stressLevel}: {stressLevelInfo.text}
          </div>
        </div>
      </div>
      
      <div className="metrics-grid">
        {Object.entries(stressRanges).map(([key, ranges]) => {
          const value = stressIndices[key];
          const status = getStatus(value, ranges);
          
          return (
            <div key={key} className="metric-item">
              <div className="metric-header">
                <strong>{key === 'stressIndex' ? '스트레스 지수' :
                        key === 'ansBalance' ? '자율신경계 균형' :
                        key === 'hrvIndex' ? '심박변이도 지수' :
                        key === 'stressResistance' ? '스트레스 저항성' :
                        key === 'hrStability' ? '심박 안정성' :
                        key === 'recoveryIndex' ? '복구 지수' :
                        key === 'activationIndex' ? '활성화 지수' :
                        key === 'relaxationIndex' ? '이완 지수' : '전체 스트레스 점수'}:</strong>
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

export default StressAnalysis;

