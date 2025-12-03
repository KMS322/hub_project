import { useState, useEffect, useRef } from 'react'
import { useSocket } from '../hooks/useSocket'
import Header from '../components/Header'
import './TelemetryTest.css'

function TelemetryTest() {
  const { isConnected, on, off } = useSocket()
  const [isTestRunning, setIsTestRunning] = useState(false)
  const [testStatus, setTestStatus] = useState({
    messageCount: 0,
    duration: 0,
    lastMessageTime: null
  })
  const [telemetryData, setTelemetryData] = useState(new Map()) // deviceId -> latest data
  const [performanceStats, setPerformanceStats] = useState([]) // 성능 통계
  const [hubId, setHubId] = useState('AA:BB:CC:DD:EE:01')
  const [deviceIds, setDeviceIds] = useState('AA:BB:CC:DD:EE:02,AA:BB:CC:DD:EE:03,AA:BB:CC:DD:EE:04')
  const intervalRef = useRef(null)
  const startTimeRef = useRef(null)

  // Telemetry 데이터 수신
  useEffect(() => {
    if (!isConnected) return

    const handleTelemetry = (data) => {
      if (data.type === 'sensor_data' && data.deviceId) {
        const receiveTime = Date.now()
        const endToEndTime = data.performance?.endToEndTime || 0
        
        // 성능 통계 추가
        if (endToEndTime > 0) {
          setPerformanceStats(prev => {
            const newStats = [...prev, {
              deviceId: data.deviceId,
              endToEndTime,
              timestamp: receiveTime
            }].slice(-100) // 최근 100개만 유지
            return newStats
          })
        }

        // 최신 데이터 업데이트
        setTelemetryData(prev => {
          const newMap = new Map(prev)
          const latest = data.data?.dataArr?.[data.data.dataArr.length - 1] || data.data
          newMap.set(data.deviceId, {
            ...latest,
            hubId: data.hubId,
            deviceId: data.deviceId,
            timestamp: data.timestamp,
            endToEndTime: endToEndTime
          })
          return newMap
        })

        // 테스트 상태 업데이트
        setTestStatus(prev => ({
          ...prev,
          messageCount: prev.messageCount + 1,
          lastMessageTime: receiveTime
        }))
      }
    }

    on('TELEMETRY', handleTelemetry)

    return () => {
      off('TELEMETRY', handleTelemetry)
    }
  }, [isConnected, on, off])

  // 테스트 시간 업데이트
  useEffect(() => {
    if (isTestRunning && startTimeRef.current) {
      intervalRef.current = setInterval(() => {
        setTestStatus(prev => ({
          ...prev,
          duration: Date.now() - startTimeRef.current
        }))
      }, 100)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [isTestRunning])

  // 테스트 시작
  const handleStartTest = async () => {
    const deviceList = deviceIds.split(',').map(id => id.trim()).filter(id => id)
    
    if (deviceList.length === 0) {
      alert('디바이스 ID를 입력해주세요.')
      return
    }

    try {
      const response = await fetch('http://localhost:3001/api/telemetry-test/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hubId: hubId.trim(),
          deviceIds: deviceList,
          interval: 1000 // 1초마다
        })
      })

      const result = await response.json()
      
      if (result.success) {
        setIsTestRunning(true)
        startTimeRef.current = Date.now()
        setTestStatus({
          messageCount: 0,
          duration: 0,
          lastMessageTime: null
        })
        setPerformanceStats([])
        setTelemetryData(new Map())
        alert(`테스트 시작: ${deviceList.length}개 디바이스`)
      } else {
        alert('테스트 시작 실패: ' + result.message)
      }
    } catch (error) {
      alert('테스트 시작 중 오류: ' + error.message)
      console.error('Start test error:', error)
    }
  }

  // 테스트 중지
  const handleStopTest = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/telemetry-test/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      const result = await response.json()
      
      if (result.success) {
        setIsTestRunning(false)
        startTimeRef.current = null
        alert(`테스트 중지\n총 메시지: ${result.data.totalMessages}개\n평균 속도: ${result.data.averageRate} msg/s`)
      } else {
        alert('테스트 중지 실패: ' + result.message)
      }
    } catch (error) {
      alert('테스트 중지 중 오류: ' + error.message)
      console.error('Stop test error:', error)
    }
  }

  // 성능 통계 계산
  const getPerformanceStats = () => {
    if (performanceStats.length === 0) return null

    const times = performanceStats.map(s => s.endToEndTime)
    const avg = times.reduce((a, b) => a + b, 0) / times.length
    const min = Math.min(...times)
    const max = Math.max(...times)
    const under1s = times.filter(t => t < 1000).length
    const over1s = times.filter(t => t >= 1000).length

    return {
      avg: avg.toFixed(2),
      min,
      max,
      under1s,
      over1s,
      total: times.length,
      successRate: ((under1s / times.length) * 100).toFixed(1)
    }
  }

  const perfStats = getPerformanceStats()

  return (
    <div className="telemetry-test-page">
      <Header />
      <div className="telemetry-test-container">
        <h2>Telemetry 양방향 통신 테스트</h2>

        {/* 테스트 설정 */}
        <div className="test-config">
          <div className="config-row">
            <label>허브 ID:</label>
            <input
              type="text"
              value={hubId}
              onChange={(e) => setHubId(e.target.value)}
              disabled={isTestRunning}
              placeholder="AA:BB:CC:DD:EE:01"
            />
          </div>
          <div className="config-row">
            <label>디바이스 ID (쉼표로 구분):</label>
            <input
              type="text"
              value={deviceIds}
              onChange={(e) => setDeviceIds(e.target.value)}
              disabled={isTestRunning}
              placeholder="AA:BB:CC:DD:EE:02,AA:BB:CC:DD:EE:03"
            />
          </div>
          <div className="test-controls">
            {!isTestRunning ? (
              <button className="btn-start" onClick={handleStartTest}>
                테스트 시작
              </button>
            ) : (
              <button className="btn-stop" onClick={handleStopTest}>
                테스트 중지
              </button>
            )}
          </div>
        </div>

        {/* 테스트 상태 */}
        <div className="test-status">
          <div className="status-item">
            <span className="status-label">상태:</span>
            <span className={`status-value ${isTestRunning ? 'running' : 'stopped'}`}>
              {isTestRunning ? '실행 중' : '중지됨'}
            </span>
          </div>
          <div className="status-item">
            <span className="status-label">수신된 메시지:</span>
            <span className="status-value">{testStatus.messageCount}</span>
          </div>
          <div className="status-item">
            <span className="status-label">실행 시간:</span>
            <span className="status-value">{(testStatus.duration / 1000).toFixed(1)}초</span>
          </div>
          <div className="status-item">
            <span className="status-label">Socket 연결:</span>
            <span className={`status-value ${isConnected ? 'connected' : 'disconnected'}`}>
              {isConnected ? '연결됨' : '연결 안 됨'}
            </span>
          </div>
        </div>

        {/* 성능 통계 */}
        {perfStats && (
          <div className="performance-stats">
            <h3>성능 통계 (End-to-End 시간)</h3>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-label">평균</div>
                <div className={`stat-value ${perfStats.avg < 1000 ? 'good' : 'bad'}`}>
                  {perfStats.avg}ms
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-label">최소</div>
                <div className="stat-value">{perfStats.min}ms</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">최대</div>
                <div className={`stat-value ${perfStats.max < 1000 ? 'good' : 'bad'}`}>
                  {perfStats.max}ms
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-label">1초 이내</div>
                <div className="stat-value good">{perfStats.under1s}개</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">1초 초과</div>
                <div className="stat-value bad">{perfStats.over1s}개</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">성공률</div>
                <div className={`stat-value ${perfStats.successRate >= 95 ? 'good' : 'bad'}`}>
                  {perfStats.successRate}%
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 실시간 데이터 */}
        <div className="realtime-data">
          <h3>실시간 Telemetry 데이터</h3>
          <div className="data-grid">
            {Array.from(telemetryData.entries()).map(([deviceId, data]) => (
              <div key={deviceId} className="device-card">
                <div className="device-header">
                  <h4>{deviceId}</h4>
                  <span className={`end-to-end-time ${data.endToEndTime < 1000 ? 'good' : 'bad'}`}>
                    {data.endToEndTime ? `${data.endToEndTime}ms` : '-'}
                  </span>
                </div>
                <div className="device-data">
                  <div className="data-row">
                    <span className="data-label">심박수:</span>
                    <span className="data-value">{data.hr || '-'} bpm</span>
                  </div>
                  <div className="data-row">
                    <span className="data-label">산포도:</span>
                    <span className="data-value">{data.spo2 || '-'}%</span>
                  </div>
                  <div className="data-row">
                    <span className="data-label">온도:</span>
                    <span className="data-value">{data.temp || '-'}°C</span>
                  </div>
                  <div className="data-row">
                    <span className="data-label">배터리:</span>
                    <span className="data-value">{data.battery || '-'}%</span>
                  </div>
                  <div className="data-row">
                    <span className="data-label">샘플 수:</span>
                    <span className="data-value">{data.dataArr?.length || 1}개</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {telemetryData.size === 0 && (
            <div className="no-data">데이터를 기다리는 중...</div>
          )}
        </div>
      </div>
    </div>
  )
}

export default TelemetryTest

