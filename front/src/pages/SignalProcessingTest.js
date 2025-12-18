import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import HardwareAlertBar from '../components/HardwareAlertBar'
import { useSocket } from '../hooks/useSocket'
import { detectHardwareError } from '../utils/hardwareErrorDetector'
import { API_URL } from '../constants'
import './SignalProcessingTest.css'

function SignalProcessingTest() {
  const navigate = useNavigate()
  const { isConnected, on, off } = useSocket()
  const [testData, setTestData] = useState({
    deviceId: 'TEST:00:00:00:00:00',
    samplingRate: 20,
    spo2: 98,
    hr: 0, // 장치 HR (사용하지 않음)
    temp: 38.5,
    data: [] // 원시 PPG 데이터
  })
  const [processedHR, setProcessedHR] = useState(null)
  const [signalStatus, setSignalStatus] = useState({
    status: 'idle',
    message: '테스트 대기 중',
    sqi: 0,
    pi: 0
  })
  const [chartData, setChartData] = useState([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [hardwareAlerts, setHardwareAlerts] = useState([])
  const generationIntervalRef = useRef(null)
  const chartDataRef = useRef([])

  // Socket.IO로 실제 신호처리 결과 수신
  useEffect(() => {
    if (!isConnected) return

    const handleTelemetry = (data) => {
      if (data.type === 'sensor_data' && data.deviceId === testData.deviceId) {
        // 신호처리된 데이터 수신
        if (data.data?.processedHR !== undefined) {
          setProcessedHR(data.data.processedHR)
          setSignalStatus({
            status: data.data.status || 'normal',
            message: data.data.statusMessage || '정상 측정',
            sqi: data.data.sqi || 0,
            pi: data.data.pi || 0
          })

          // 차트 데이터 추가
          if (data.data.processedHR !== null) {
            setChartData(prev => {
              const newData = {
                time: new Date().toLocaleTimeString('ko-KR'),
                hr: data.data.processedHR,
                originalHR: data.data.originalHR,
                sqi: data.data.sqi,
                timestamp: Date.now()
              }
              const updated = [...prev, newData]
              return updated.slice(-60) // 최근 60개만 유지
            })
          }

          // 하드웨어 오류 감지
          const error = detectHardwareError(data.data.processedHR)
          if (error) {
            setHardwareAlerts([{
              id: `test-alert-${Date.now()}`,
              deviceId: testData.deviceId,
              deviceName: '테스트 디바이스',
              deviceAddress: testData.deviceId,
              ...error,
              timestamp: Date.now()
            }])
          } else {
            setHardwareAlerts([])
          }
        }
      }
    }

    on('TELEMETRY', handleTelemetry)

    return () => {
      off('TELEMETRY', handleTelemetry)
    }
  }, [isConnected, on, off, testData.deviceId])

  // 테스트 데이터 생성 (정상/비정상 시나리오)
  const generateTestData = (scenario = 'normal') => {
    const samples = []
    const samplingRate = testData.samplingRate
    const duration = 1 // 1초
    const sampleCount = samplingRate * duration

    let baseHR = 80 // 기본 HR
    let noiseLevel = 0.05 // 노이즈 레벨

    if (scenario === 'low_pi') {
      // 낮은 PI 시나리오 (신호 약함)
      noiseLevel = 0.3
      baseHR = 75
    } else if (scenario === 'high_noise') {
      // 높은 노이즈 시나리오
      noiseLevel = 0.2
      baseHR = 85
    } else if (scenario === 'irregular') {
      // 불규칙한 심박 시나리오
      noiseLevel = 0.15
      baseHR = 90
    }

    // PPG 신호 생성 (간단한 사인파 + 노이즈)
    for (let i = 0; i < sampleCount; i++) {
      const t = i / samplingRate
      const frequency = baseHR / 60 // Hz
      
      // 기본 사인파
      let signal = Math.sin(2 * Math.PI * frequency * t)
      
      // 노이즈 추가
      signal += (Math.random() - 0.5) * noiseLevel * 2
      
      // DC 성분 추가
      const dc = 50000
      const ir = Math.round(dc + signal * 5000)
      const red = Math.round(dc * 0.8 + signal * 4000)
      const green = Math.round(dc * 0.6 + signal * 3000)

      samples.push(`${ir},${red},${green}`)
    }

    return {
      ...testData,
      data: samples,
      hr: baseHR + Math.floor(Math.random() * 10) - 5, // 장치 HR (신뢰 불가)
      spo2: scenario === 'low_pi' ? 95 : 98,
      temp: 38.5
    }
  }

  const handleStartTest = (scenario) => {
    if (isGenerating) {
      handleStopTest()
      return
    }

    setIsGenerating(true)
    setChartData([])
    setProcessedHR(null)
    setSignalStatus({
      status: 'collecting',
      message: '데이터 수집 중...',
      sqi: 0,
      pi: 0
    })

    // 1초마다 테스트 데이터 생성 및 전송
    generationIntervalRef.current = setInterval(() => {
      const testDataPacket = generateTestData(scenario)
      
      // 백엔드로 테스트 데이터 전송
      // Telemetry Worker 큐에 직접 추가하여 신호처리 수행
      fetch(`${API_URL}/telemetry/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          hubId: 'TEST:HUB:01',
          deviceId: testData.deviceId,
          data: {
            sampling_rate: testDataPacket.samplingRate,
            spo2: testDataPacket.spo2,
            hr: testDataPacket.hr,
            temp: testDataPacket.temp,
            data: testDataPacket.data,
            start_time: Date.now(),
            timestamp: Date.now()
          }
        })
      })
      .then(response => response.json())
      .then(result => {
        if (result.success) {
          console.log('[Signal Processing Test] Test data sent successfully, queue length:', result.queueLength)
        } else {
          console.error('[Signal Processing Test] Failed to send test data:', result.message)
        }
      })
      .catch(err => {
        console.error('[Signal Processing Test] Failed to send test data:', err)
      })
    }, 1000)
  }

  const handleStopTest = () => {
    if (generationIntervalRef.current) {
      clearInterval(generationIntervalRef.current)
      generationIntervalRef.current = null
    }
    setIsGenerating(false)
    setSignalStatus({
      status: 'idle',
      message: '테스트 중지됨',
      sqi: 0,
      pi: 0
    })
  }

  const handleDismissAlert = (alertId) => {
    setHardwareAlerts(prev => prev.filter(alert => alert.id !== alertId))
  }

  useEffect(() => {
    return () => {
      handleStopTest()
    }
  }, [])

  return (
    <div className="signal-processing-test-page">
      <Header />
      <HardwareAlertBar alerts={hardwareAlerts} onDismiss={handleDismissAlert} />
      <div className="test-container">
        <div className="test-header">
          <h1>신호처리 테스트</h1>
          <p className="test-description">
            강아지 심박 측정기의 신호처리 시스템을 테스트합니다.
            정상/비정상 데이터 시나리오를 선택하여 신호처리 결과를 확인할 수 있습니다.
          </p>
        </div>

        <div className="test-controls-section">
          <h2>테스트 시나리오</h2>
          <div className="scenario-buttons">
            <button
              className={`scenario-btn normal ${isGenerating ? 'disabled' : ''}`}
              onClick={() => handleStartTest('normal')}
              disabled={isGenerating}
            >
              정상 데이터 테스트
            </button>
            <button
              className={`scenario-btn low-pi ${isGenerating ? 'disabled' : ''}`}
              onClick={() => handleStartTest('low_pi')}
              disabled={isGenerating}
            >
              낮은 PI 테스트<br/>(신호 약함)
            </button>
            <button
              className={`scenario-btn high-noise ${isGenerating ? 'disabled' : ''}`}
              onClick={() => handleStartTest('high_noise')}
              disabled={isGenerating}
            >
              높은 노이즈 테스트
            </button>
            <button
              className={`scenario-btn irregular ${isGenerating ? 'disabled' : ''}`}
              onClick={() => handleStartTest('irregular')}
              disabled={isGenerating}
            >
              불규칙 심박 테스트
            </button>
            {isGenerating && (
              <button
                className="scenario-btn stop"
                onClick={handleStopTest}
              >
                테스트 중지
              </button>
            )}
          </div>
        </div>

        <div className="status-section">
          <h2>신호처리 상태</h2>
          <div className={`status-card ${signalStatus.status}`}>
            <div className="status-header">
              <span className="status-label">상태:</span>
              <span className={`status-badge ${signalStatus.status}`}>
                {signalStatus.status === 'normal' && '✅ 정상'}
                {signalStatus.status === 'low_quality' && '⚠️ 신뢰도 낮음'}
                {signalStatus.status === 'reposition_needed' && '❌ 재부착 필요'}
                {signalStatus.status === 'collecting' && '📊 수집 중'}
                {signalStatus.status === 'idle' && '⏸ 대기'}
              </span>
            </div>
            <div className="status-message">{signalStatus.message}</div>
            <div className="status-metrics">
              <div className="metric">
                <span className="metric-label">SQI:</span>
                <span className="metric-value">{signalStatus.sqi.toFixed(2)}</span>
              </div>
              <div className="metric">
                <span className="metric-label">PI:</span>
                <span className="metric-value">{signalStatus.pi.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="results-section">
          <h2>처리 결과</h2>
          <div className="results-grid">
            <div className="result-card">
              <h3>안정화된 HR</h3>
              <div className="result-value">
                {processedHR !== null ? `${Math.round(processedHR)} bpm` : '계산 중...'}
              </div>
              <div className="result-note">
                신호처리를 통해 계산된 안정화된 심박수
              </div>
            </div>
            <div className="result-card">
              <h3>원본 HR (참고용)</h3>
              <div className="result-value">
                {testData.hr > 0 ? `${testData.hr} bpm` : 'N/A'}
              </div>
              <div className="result-note">
                장치에서 전달된 원본 HR (신뢰 불가)
              </div>
            </div>
          </div>
        </div>

        {chartData.length > 0 && (
          <div className="chart-section">
            <h2>HR 그래프</h2>
            <div className="chart-container">
              <svg className="chart-svg" viewBox="0 0 800 300" preserveAspectRatio="none">
                {chartData.length > 1 && (
                  <polyline
                    fill="none"
                    stroke="#3498db"
                    strokeWidth="2"
                    points={chartData.map((d, i) => {
                      const x = (i / (chartData.length - 1)) * 800
                      const maxHR = Math.max(...chartData.map(d => d.hr || 0), 100)
                      const minHR = Math.min(...chartData.map(d => d.hr || 0), 40)
                      const range = maxHR - minHR || 1
                      const y = 300 - ((d.hr - minHR) / range) * 280 - 10
                      return `${x},${y}`
                    }).join(' ')}
                  />
                )}
              </svg>
              <div className="chart-labels">
                {chartData.filter((_, i) => i % 10 === 0).map((d, i) => (
                  <div key={i} className="chart-label">{d.time}</div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="info-section">
          <h2>신호처리 시스템 정보</h2>
          <div className="info-grid">
            <div className="info-card">
              <h3>CSV 저장</h3>
              <p>원본 데이터만 저장됩니다. 어떠한 필터링이나 보정도 적용되지 않습니다.</p>
            </div>
            <div className="info-card">
              <h3>HR 계산</h3>
              <p>4가지 방법으로 HR 후보를 생성하고 Weighted Median으로 최종 결정합니다.</p>
              <ul>
                <li>시간영역 피크 검출</li>
                <li>주파수 영역 (FFT)</li>
                <li>Autocorrelation</li>
                <li>이전 HR 기반 예측</li>
              </ul>
            </div>
            <div className="info-card">
              <h3>안정화</h3>
              <p>EWMA 필터를 사용하여 시간 연속성을 보장하고 급격한 변화를 방지합니다.</p>
            </div>
            <div className="info-card">
              <h3>신뢰도</h3>
              <p>SQI (Signal Quality Index)를 계산하여 신호 품질을 평가합니다.</p>
              <ul>
                <li>PI 크기</li>
                <li>HR 생리 범위 적합성</li>
                <li>HR 후보 간 일관성</li>
                <li>파형 주기성</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="test-actions">
          <button className="btn-secondary" onClick={() => navigate('/dashboard')}>
            대시보드로 돌아가기
          </button>
          <button className="btn-secondary" onClick={() => navigate('/monitoring/test')}>
            모니터링 페이지로 이동
          </button>
        </div>
      </div>
    </div>
  )
}

export default SignalProcessingTest

