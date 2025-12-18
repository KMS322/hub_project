import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import HardwareAlertBar from '../components/HardwareAlertBar'
import { detectHardwareError } from '../utils/hardwareErrorDetector'
import './HardwareErrorTest.css'

function HardwareErrorTest() {
  const navigate = useNavigate()
  const [testHeartRate, setTestHeartRate] = useState('')
  const [testDeviceName, setTestDeviceName] = useState('테스트 디바이스')
  const [hardwareAlerts, setHardwareAlerts] = useState([])
  const [testHistory, setTestHistory] = useState([])

  const handleTest = () => {
    if (!testHeartRate) {
      alert('심박수 값을 입력해주세요.')
      return
    }

    const hrValue = testHeartRate.trim().toLowerCase()
    const error = detectHardwareError(hrValue)

    if (error) {
      const alert = {
        id: `test-alert-${Date.now()}`,
        deviceId: 'test-device',
        deviceName: testDeviceName,
        deviceAddress: 'TEST:00:00:00:00:00',
        ...error,
        timestamp: Date.now()
      }
      setHardwareAlerts([alert])
      
      // 테스트 히스토리에 추가
      setTestHistory(prev => [{
        ...alert,
        testTime: new Date().toLocaleTimeString('ko-KR'),
        inputValue: testHeartRate
      }, ...prev].slice(0, 10)) // 최근 10개만 유지
    } else {
      setHardwareAlerts([])
      setTestHistory(prev => [{
        id: `test-normal-${Date.now()}`,
        deviceName: testDeviceName,
        message: '정상 심박수입니다.',
        testTime: new Date().toLocaleTimeString('ko-KR'),
        inputValue: testHeartRate,
        type: 'success'
      }, ...prev].slice(0, 10))
    }
  }

  const handleQuickTest = (hrValue) => {
    setTestHeartRate(hrValue)
    const error = detectHardwareError(hrValue)
    
    if (error) {
      const alert = {
        id: `test-alert-${Date.now()}`,
        deviceId: 'test-device',
        deviceName: testDeviceName,
        deviceAddress: 'TEST:00:00:00:00:00',
        ...error,
        timestamp: Date.now()
      }
      setHardwareAlerts([alert])
      
      setTestHistory(prev => [{
        ...alert,
        testTime: new Date().toLocaleTimeString('ko-KR'),
        inputValue: hrValue
      }, ...prev].slice(0, 10))
    } else {
      setHardwareAlerts([])
    }
  }

  const handleDismissAlert = (alertId) => {
    setHardwareAlerts(prev => prev.filter(alert => alert.id !== alertId))
  }

  const handleClearHistory = () => {
    setTestHistory([])
  }

  return (
    <div className="hardware-error-test-page">
      <Header />
      <HardwareAlertBar alerts={hardwareAlerts} onDismiss={handleDismissAlert} />
      <div className="test-container">
        <div className="test-header">
          <h1>하드웨어 오류 알림 테스트</h1>
          <p className="test-description">
            심박수(hr) 값을 입력하여 하드웨어 오류 알림이 올바르게 표시되는지 테스트할 수 있습니다.
          </p>
        </div>

        <div className="test-section">
          <h2>테스트 입력</h2>
          <div className="test-form">
            <div className="form-group">
              <label htmlFor="device-name">디바이스 이름</label>
              <input
                id="device-name"
                type="text"
                value={testDeviceName}
                onChange={(e) => setTestDeviceName(e.target.value)}
                placeholder="디바이스 이름"
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label htmlFor="heart-rate">심박수 (hr) 값</label>
              <input
                id="heart-rate"
                type="text"
                value={testHeartRate}
                onChange={(e) => setTestHeartRate(e.target.value)}
                placeholder="hr:7, hr:8, hr:9 또는 7, 8, 9"
                className="form-input"
              />
              <div className="input-hint">
                <p>오류 코드:</p>
                <ul>
                  <li><strong>hr:7</strong> 또는 <strong>7</strong> → 배터리 부족</li>
                  <li><strong>hr:8</strong> 또는 <strong>8</strong> → 신호 불량</li>
                  <li><strong>hr:9</strong> 또는 <strong>9</strong> → 움직임 감지</li>
                  <li>기타 값 → 정상 심박수</li>
                </ul>
              </div>
            </div>
            <button className="btn-primary test-btn" onClick={handleTest}>
              테스트 실행
            </button>
          </div>
        </div>

        <div className="quick-test-section">
          <h2>빠른 테스트</h2>
          <div className="quick-test-buttons">
            <button 
              className="quick-test-btn warning"
              onClick={() => handleQuickTest('hr:7')}
            >
              hr:7 테스트<br/>(배터리 부족)
            </button>
            <button 
              className="quick-test-btn error"
              onClick={() => handleQuickTest('hr:8')}
            >
              hr:8 테스트<br/>(신호 불량)
            </button>
            <button 
              className="quick-test-btn info"
              onClick={() => handleQuickTest('hr:9')}
            >
              hr:9 테스트<br/>(움직임 감지)
            </button>
            <button 
              className="quick-test-btn normal"
              onClick={() => handleQuickTest('75')}
            >
              정상 테스트<br/>(심박수 75)
            </button>
          </div>
        </div>

        {testHistory.length > 0 && (
          <div className="test-history-section">
            <div className="history-header">
              <h2>테스트 히스토리</h2>
              <button className="btn-secondary clear-btn" onClick={handleClearHistory}>
                히스토리 지우기
              </button>
            </div>
            <div className="history-list">
              {testHistory.map((item, index) => (
                <div key={item.id || index} className={`history-item ${item.type || 'error'}`}>
                  <div className="history-time">{item.testTime}</div>
                  <div className="history-content">
                    <div className="history-device">{item.deviceName}</div>
                    <div className="history-message">{item.message}</div>
                    <div className="history-input">입력값: <strong>{item.inputValue}</strong></div>
                  </div>
                  <div className="history-type-badge">
                    {item.type === 'warning' && '⚠️ 경고'}
                    {item.type === 'error' && '❌ 오류'}
                    {item.type === 'info' && 'ℹ️ 정보'}
                    {item.type === 'success' && '✅ 정상'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="test-info-section">
          <h2>테스트 가이드</h2>
          <div className="info-grid">
            <div className="info-card">
              <h3>hr:7 (배터리 부족)</h3>
              <p>배터리가 부족할 때 나타나는 오류입니다. 경고 타입의 알림이 표시됩니다.</p>
              <div className="info-message">메시지: "배터리가 부족하니 충전을 해주세요."</div>
            </div>
            <div className="info-card">
              <h3>hr:8 (신호 불량)</h3>
              <p>디바이스와 허브 간 신호가 불량할 때 나타나는 오류입니다. 오류 타입의 알림이 표시됩니다.</p>
              <div className="info-message">메시지: "신호가 불량하니 다시 측정 해주세요."</div>
            </div>
            <div className="info-card">
              <h3>hr:9 (움직임 감지)</h3>
              <p>환자가 움직여서 신호가 불안정할 때 나타나는 정보입니다. 정보 타입의 알림이 표시됩니다.</p>
              <div className="info-message">메시지: "환자가 움직여서 신호가 불안정합니다. 다시 측정 해주세요."</div>
            </div>
          </div>
        </div>

        <div className="test-actions">
          <button className="btn-secondary" onClick={() => navigate('/dashboard')}>
            대시보드로 돌아가기
          </button>
          <button className="btn-secondary" onClick={() => navigate('/hardware')}>
            하드웨어 관리로 이동
          </button>
        </div>
      </div>
    </div>
  )
}

export default HardwareErrorTest

