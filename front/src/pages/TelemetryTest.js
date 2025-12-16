import { useState, useEffect, useRef } from 'react'
import { useSocket } from '../hooks/useSocket'
import { io } from 'socket.io-client'
import Header from '../components/Header'
import './TelemetryTest.css'

function TelemetryTest() {
  const { isConnected, on, off, emit } = useSocket()
  const [isTestRunning, setIsTestRunning] = useState(false)
  const [monitorConnected, setMonitorConnected] = useState(false)
  const monitorSocketRef = useRef(null)
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
  const [testMessages, setTestMessages] = useState([]) // test/ 토픽 메시지

  // mqtt-monitor Socket.IO 연결 (실시간 상태 수신)
  useEffect(() => {
    const MONITOR_URL = 'http://localhost:3001'
    
    // mqtt-monitor Socket.IO 연결
    monitorSocketRef.current = io(MONITOR_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity
    })

    monitorSocketRef.current.on('connect', () => {
      setMonitorConnected(true)
      console.log('[Telemetry Test] ✅ Connected to mqtt-monitor Socket.IO')
    })

    monitorSocketRef.current.on('disconnect', () => {
      setMonitorConnected(false)
      console.log('[Telemetry Test] ❌ Disconnected from mqtt-monitor Socket.IO')
    })

    // 실시간 테스트 상태 수신
    monitorSocketRef.current.on('telemetry_test_status', (status) => {
      console.log('[Telemetry Test] 📊 Real-time status from mqtt-monitor:', status)
      
      // 테스트 실행 상태 동기화
      if (status.isRunning !== isTestRunning) {
        setIsTestRunning(status.isRunning)
        if (status.isRunning && !startTimeRef.current) {
          startTimeRef.current = Date.now() - (status.duration || 0)
        } else if (!status.isRunning) {
          startTimeRef.current = null
        }
      }

      // 상태 업데이트
      setTestStatus(prev => ({
        ...prev,
        messageCount: status.messageCount || prev.messageCount,
        duration: status.duration || prev.duration,
        lastMessageTime: status.lastMessageTime || prev.lastMessageTime
      }))
    })

    return () => {
      if (monitorSocketRef.current) {
        monitorSocketRef.current.disconnect()
        monitorSocketRef.current = null
      }
    }
  }, [isTestRunning])

  // CONTROL_RESULT 이벤트 처리 (측정 시작/정지 결과)
  useEffect(() => {
    if (!isConnected) return

    const handleControlResult = (data) => {
      console.log('[Telemetry Test] Received CONTROL_RESULT:', data)
      
      // 현재 경로가 TelemetryTest 페이지인지 확인
      const currentPath = window.location.pathname
      if (!currentPath.includes('/telemetry-test')) {
        // TelemetryTest 페이지가 아니면 무시
        return
      }

      // 명령이 성공했는지 확인
      if (data.success) {
        const command = data.data?.command || data.command || {}
        
        if (command.action === 'start_telemetry_test') {
          // 측정 시작 성공
          setIsTestRunning(true)
          startTimeRef.current = Date.now()
          setTestStatus({
            messageCount: 0,
            duration: 0,
            lastMessageTime: null
          })
          setPerformanceStats([])
          setTelemetryData(new Map())
          alert(`테스트 시작: ${command.deviceIds?.length || 1}개 디바이스`)
        } else if (command.action === 'stop_telemetry_test') {
          // 측정 정지 성공
          setIsTestRunning(false)
          startTimeRef.current = null
          const resultData = data.data?.result || {}
          alert(
            `테스트 중지\n` +
            `총 메시지: ${resultData.totalMessages || 0}개\n` +
            `평균 속도: ${resultData.averageRate || 0} msg/s`
          )
        }
      } else {
        // 명령 실패
        alert(`명령 실행 실패: ${data.error || '알 수 없는 오류'}`)
      }
    }

    on('CONTROL_RESULT', handleControlResult)

    return () => {
      off('CONTROL_RESULT', handleControlResult)
    }
  }, [isConnected, on, off])

  // Telemetry 데이터 수신
  useEffect(() => {
    if (!isConnected) return

    const handleTelemetry = (data) => {
      if (data.type === 'sensor_data' && data.deviceId) {
        const receiveTime = Date.now()
        const endToEndTime = data.performance?.endToEndTime || 0
        const totalProcessingTime = data.performance?.totalProcessingTime || null
        
        // 전체 처리 시간 콘솔 출력 (CSV 저장부터 프론트 수신까지)
        if (totalProcessingTime !== null) {
          const deviceId = data.deviceId
          const sampleCount = data.data?.dataArr?.length || 1
          console.log(
            `[Telemetry Test] ✅ 전체 처리 완료 - Device: ${deviceId}, ` +
            `샘플 수: ${sampleCount}개, ` +
            `전체 처리 시간: ${totalProcessingTime}ms ` +
            `(발행 → MQTT 수신 → CSV 저장 → DB 저장 → 프론트 수신)`
          )
          
          // 성능 경고
          if (totalProcessingTime > 1000) {
            console.warn(
              `[Telemetry Test] ⚠️ 처리 시간이 1초를 초과했습니다: ${totalProcessingTime}ms`
            )
          } else if (totalProcessingTime < 100) {
            console.log(
              `[Telemetry Test] ⚡ 매우 빠른 처리: ${totalProcessingTime}ms`
            )
          }
        }
        
        // 성능 통계 추가
        if (endToEndTime > 0) {
          setPerformanceStats(prev => {
            const newStats = [...prev, {
              deviceId: data.deviceId,
              endToEndTime,
              totalProcessingTime: totalProcessingTime || endToEndTime,
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

  // 테스트 시작 (MQTT를 통해 백엔드로 요청)
  const handleStartTest = async () => {
    const deviceList = deviceIds.split(',').map(id => id.trim()).filter(id => id)
    
    if (deviceList.length === 0) {
      alert('디바이스 ID를 입력해주세요.')
      return
    }

    if (!isConnected) {
      alert('Socket이 연결되지 않았습니다.')
      return
    }

    try {
      const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      // MQTT를 통해 백엔드로 측정 시작 요청 전송
      emit('CONTROL_REQUEST', {
        hubId: hubId.trim(),
        deviceId: deviceList[0], // 첫 번째 디바이스 ID 사용 (백엔드에서 deviceIds 배열 처리)
        command: {
          action: 'start_telemetry_test',
          deviceIds: deviceList,
          interval: 1000 // 1초마다
        },
        requestId
      })

      // CONTROL_RESULT를 기다림 (별도 핸들러에서 처리)
      console.log('[Telemetry Test] 측정 시작 요청 전송:', requestId)
    } catch (error) {
      alert('테스트 시작 중 오류: ' + error.message)
      console.error('Start test error:', error)
    }
  }

  // 테스트 중지 (MQTT를 통해 백엔드로 요청)
  const handleStopTest = async () => {
    if (!isConnected) {
      alert('Socket이 연결되지 않았습니다.')
      return
    }

    try {
      const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      // MQTT를 통해 백엔드로 측정 정지 요청 전송
      emit('CONTROL_REQUEST', {
        hubId: hubId.trim(),
        deviceId: deviceIds.split(',')[0]?.trim() || 'AA:BB:CC:DD:EE:02', // 첫 번째 디바이스 ID 사용
        command: {
          action: 'stop_telemetry_test'
        },
        requestId
      })

      console.log('[Telemetry Test] 측정 정지 요청 전송:', requestId)
    } catch (error) {
      alert('테스트 중지 중 오류: ' + error.message)
      console.error('Stop test error:', error)
    }
  }

  // test/ 토픽으로 메시지 전송 (ESP32 테스트용)
  const handleSendTestMessage = async () => {
    try {
      const response = await fetch('http://localhost:5000/mqtt-test/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: 'test/receive',
          message: {
            requestId: `test_${Date.now()}`,
            message: 'Hello from frontend!',
            needResponse: true,
            responseTopic: 'test/response'
          },
          needResponse: true
        })
      })

      const result = await response.json()
      if (result.success) {
        alert('테스트 메시지가 전송되었습니다!')
        console.log('[Telemetry Test] Test message sent:', result)
      } else {
        alert('테스트 메시지 전송 실패: ' + result.message)
      }
    } catch (error) {
      alert('테스트 메시지 전송 중 오류: ' + error.message)
      console.error('Send test message error:', error)
    }
  }

  // 성능 통계 계산
  const getPerformanceStats = () => {
    if (performanceStats.length === 0) return null

    const endToEndTimes = performanceStats.map(s => s.endToEndTime)
    const totalTimes = performanceStats.map(s => s.totalProcessingTime || s.endToEndTime)
    
    const avg = endToEndTimes.reduce((a, b) => a + b, 0) / endToEndTimes.length
    const avgTotal = totalTimes.reduce((a, b) => a + b, 0) / totalTimes.length
    const min = Math.min(...totalTimes)
    const max = Math.max(...totalTimes)
    const under1s = totalTimes.filter(t => t < 1000).length
    const over1s = totalTimes.filter(t => t >= 1000).length

    return {
      avg: avg.toFixed(2),
      avgTotal: avgTotal.toFixed(2), // 전체 처리 시간 평균
      min,
      max,
      under1s,
      over1s,
      total: totalTimes.length,
      successRate: ((under1s / totalTimes.length) * 100).toFixed(1)
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
            <span className="status-label">백엔드 Socket:</span>
            <span className={`status-value ${isConnected ? 'connected' : 'disconnected'}`}>
              {isConnected ? '연결됨' : '연결 안 됨'}
            </span>
          </div>
          <div className="status-item">
            <span className="status-label">Monitor Socket:</span>
            <span className={`status-value ${monitorConnected ? 'connected' : 'disconnected'}`}>
              {monitorConnected ? '연결됨' : '연결 안 됨'}
            </span>
          </div>
        </div>

        {/* 성능 통계 */}
        {perfStats && (
          <div className="performance-stats">
            <h3>성능 통계 (전체 처리 시간: 발행 → CSV 저장 → 프론트 수신)</h3>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-label">평균 (전체)</div>
                <div className={`stat-value ${perfStats.avgTotal < 1000 ? 'good' : 'bad'}`}>
                  {perfStats.avgTotal}ms
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-label">평균 (수신~전송)</div>
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

        {/* test/ 토픽 테스트 */}
        <div className="test-section">
          <h3>🧪 test/ 토픽 통신 테스트 (ESP32)</h3>
          <div className="test-controls">
            <button 
              className="btn-primary"
              onClick={handleSendTestMessage}
              disabled={!isConnected}
            >
              테스트 메시지 전송
            </button>
          </div>
          <div className="test-messages">
            <h4>수신된 테스트 메시지 (최근 10개)</h4>
            {testMessages.length === 0 ? (
              <div className="no-data">메시지를 기다리는 중...</div>
            ) : (
              <div className="message-list">
                {testMessages.map((msg, idx) => (
                  <div key={idx} className="message-item">
                    <div className="message-header">
                      <span className="message-topic">{msg.topic}</span>
                      <span className="message-time">
                        {new Date(msg.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="message-body">
                      <pre>{JSON.stringify(msg.data, null, 2)}</pre>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

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

