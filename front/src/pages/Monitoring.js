import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import HardwareAlertBar from '../components/HardwareAlertBar'
import { useSocket } from '../hooks/useSocket'
import { API_URL } from '../constants'
import { detectHardwareError } from '../utils/hardwareErrorDetector'
import deviceService from '../api/deviceService'
import petService from '../api/petService'
import './Monitoring.css'

function Monitoring() {
  const { patientId } = useParams()
  const navigate = useNavigate()
  const { isConnected, on, emit, off } = useSocket()
  const [activeTab, setActiveTab] = useState('heartRate') // ir, heartRate, spo2, temperature
  const [chartData, setChartData] = useState([])
  const [selectedPatient, setSelectedPatient] = useState(null)
  const [currentValues, setCurrentValues] = useState({
    heartRate: 0,
    spo2: 0,
    temperature: 0,
    battery: 0
  })
  const [deviceInfo, setDeviceInfo] = useState(null)
  const [isMeasurementRunning, setIsMeasurementRunning] = useState(false)
  const [hardwareAlerts, setHardwareAlerts] = useState([])
  const [signalProcessingStatus, setSignalProcessingStatus] = useState({
    processedHR: null,
    originalHR: null,
    sqi: 0,
    pi: 0,
    status: 'idle',
    message: '신호처리 대기 중'
  })
  const [isErrorSimulationActive, setIsErrorSimulationActive] = useState(false)
  const [simulatedError, setSimulatedError] = useState(null) // null 또는 { code, type, message }
  const chartDataRef = useRef([])
  const simulationIntervalRef = useRef(null)
  const errorDurationRef = useRef(null)

  // Socket.IO 이벤트 리스너 설정
  useEffect(() => {
    if (!isConnected) {
      console.log('[Monitoring] Socket not connected yet');
      return;
    }

    console.log('[Monitoring] Setting up Socket.IO listeners');

    // TELEMETRY 데이터 수신
    const handleTelemetry = (data) => {
      console.log('[Monitoring] Received TELEMETRY:', data);
      
      if (data.type === 'sensor_data' && data.deviceId) {
        // 신호처리 결과 확인
        if (data.data?.processedHR !== undefined) {
          // 신호처리된 HR 사용
          setSignalProcessingStatus({
            processedHR: data.data.processedHR,
            originalHR: data.data.originalHR || null,
            sqi: data.data.sqi || 0,
            pi: data.data.pi || 0,
            status: data.data.status || 'normal',
            message: data.data.statusMessage || '정상 측정'
          });
        }

        // dataArr가 있는 경우 (배치 데이터)
        if (data.data?.dataArr && Array.isArray(data.data.dataArr)) {
          const timestamp = data.timestamp || Date.now();
          const newData = data.data.dataArr.map((sample, index) => {
            // 신호처리된 HR 우선 사용
            const hr = data.data.processedHR !== undefined && data.data.processedHR !== null 
              ? data.data.processedHR 
              : (sample.hr || 0);
            
            return {
              timestamp: timestamp + index, // 각 샘플마다 고유한 타임스탬프
              time: new Date(timestamp + index).toLocaleTimeString('ko-KR'),
              ir: sample.ir || 0,
              heartRate: hr,
              spo2: sample.spo2 !== null && sample.spo2 !== undefined ? sample.spo2 : (data.data.spo2 || 0),
              temperature: sample.temp !== null && sample.temp !== undefined ? sample.temp : (data.data.temp || 0),
              battery: sample.battery || 0
            };
          });

          // 최신 데이터로 현재 값 업데이트
          if (newData.length > 0) {
            const latest = newData[newData.length - 1];
          setCurrentValues({
            heartRate: latest.heartRate,
            spo2: latest.spo2,
            temperature: latest.temperature,
            battery: latest.battery
          });

          // 시뮬레이션된 오류가 있으면 그것을 우선 사용, 없으면 실제 데이터에서 감지
          // 신호처리된 HR이 있으면 그것을 사용
          const hrForErrorDetection = data.data.processedHR !== undefined && data.data.processedHR !== null
            ? data.data.processedHR
            : latest.heartRate;
          const error = simulatedError || detectHardwareError(hrForErrorDetection);
          if (error) {
            setHardwareAlerts([{
              id: `alert-${data.deviceId}-${error.code}`,
              deviceId: data.deviceId,
              deviceName: deviceInfo?.name || data.deviceId,
              deviceAddress: data.deviceId,
              ...error,
              timestamp: Date.now()
            }]);
          } else {
            setHardwareAlerts([]);
          }
          }

          // 차트 데이터에 추가 (최근 60개만 유지)
          setChartData(prev => {
            const updated = [...prev, ...newData];
            return updated.slice(-60); // 최근 60개만 유지
          });
        } else {
          // 단일 샘플인 경우 또는 신호처리된 데이터
          const hr = data.data?.processedHR !== undefined && data.data.processedHR !== null
            ? data.data.processedHR
            : (data.data?.hr || 0);
          
          const sample = {
            timestamp: data.timestamp || data.data?.timestamp || Date.now(),
            time: new Date(data.timestamp || data.data?.timestamp || Date.now()).toLocaleTimeString('ko-KR'),
            ir: data.data?.ir || 0,
            heartRate: hr,
            spo2: data.data?.spo2 || 0,
            temperature: data.data?.temp || 0,
            battery: data.data?.battery || 0
          };

          setCurrentValues({
            heartRate: sample.heartRate,
            spo2: sample.spo2,
            temperature: sample.temperature,
            battery: sample.battery
          });

          // 시뮬레이션된 오류가 있으면 그것을 우선 사용, 없으면 실제 데이터에서 감지
          const error = simulatedError || detectHardwareError(sample.heartRate);
          if (error) {
            setHardwareAlerts([{
              id: `alert-${data.deviceId}-${error.code}`,
              deviceId: data.deviceId,
              deviceName: deviceInfo?.name || data.deviceId,
              deviceAddress: data.deviceId,
              ...error,
              timestamp: Date.now()
            }]);
          } else {
            setHardwareAlerts([]);
          }

          setChartData(prev => {
            const updated = [...prev, sample];
            return updated.slice(-60);
          });
        }
      }
    };

    // DEVICE_STATUS 수신
    const handleDeviceStatus = (data) => {
      console.log('[Monitoring] Received DEVICE_STATUS:', data);
      setDeviceInfo(data);
    };

    // CONTROL_RESULT 수신 (명령 실행 결과)
    const handleControlResult = (data) => {
      console.log('[Monitoring] Received CONTROL_RESULT:', data);
      
      // 현재 경로가 Monitoring 페이지인지 확인
      const currentPath = window.location.pathname;
      if (!currentPath.includes('/monitoring/')) {
        // Monitoring 페이지가 아니면 무시
        console.log('[Monitoring] Ignoring CONTROL_RESULT (not on monitoring page)');
        return;
      }
      
      if (data.success) {
        const command = data.data?.command || data.command || {};
        console.log('[Monitoring] Command result success, command:', command);
        
        if (command.action === 'start_measurement') {
          setIsMeasurementRunning(true);
          console.log('[Monitoring] 측정이 시작되었습니다.');
        } else if (command.action === 'stop_measurement') {
          setIsMeasurementRunning(false);
          console.log('[Monitoring] 측정이 정지되었습니다.');
        } else {
          console.log('[Monitoring] 명령이 성공적으로 실행되었습니다.');
        }
      } else {
        // 에러 메시지에서 타임아웃 관련 메시지 필터링
        const errorMsg = data.error || '알 수 없는 오류';
        if (errorMsg.includes('timeout') || errorMsg.includes('타임아웃')) {
          console.error('[Monitoring] Command timeout error:', errorMsg);
          alert(`명령 실행 실패: ${errorMsg}\n\nmqtt-monitor 서버가 실행 중인지 확인해주세요.`);
        } else {
          alert(`명령 실행 실패: ${errorMsg}`);
        }
      }
    };

    // 이벤트 리스너 등록
    on('TELEMETRY', handleTelemetry);
    on('DEVICE_STATUS', handleDeviceStatus);
    on('CONTROL_RESULT', handleControlResult);

    // 디바이스 상태 조회 요청
    if (patientId) {
      // TODO: patientId로 deviceId를 찾아야 함
      // 임시로 더미 deviceId 사용
      emit('GET_DEVICE_STATUS', { deviceId: patientId });
    }

    // 측정 상태는 Socket.IO 이벤트로 관리 (localhost:3001 호출 제거)

    // 정리 함수
    return () => {
      off('TELEMETRY', handleTelemetry);
      off('DEVICE_STATUS', handleDeviceStatus);
      off('CONTROL_RESULT', handleControlResult);
    };
  }, [isConnected, patientId, on, emit, off, simulatedError, deviceInfo]);

  // 랜덤 오류 시뮬레이션
  useEffect(() => {
    if (!isErrorSimulationActive) {
      // 시뮬레이션이 비활성화되면 정리
      if (simulationIntervalRef.current) {
        clearInterval(simulationIntervalRef.current);
        simulationIntervalRef.current = null;
      }
      if (errorDurationRef.current) {
        clearTimeout(errorDurationRef.current);
        errorDurationRef.current = null;
      }
      setSimulatedError(null);
      setHardwareAlerts([]);
      return;
    }

    // 랜덤 오류 발생 함수
    const triggerRandomError = () => {
      // 랜덤하게 오류 발생 (30% 확률)
      if (Math.random() < 0.3) {
        const errorCodes = [
          { code: 'hr:7', type: 'warning', message: '배터리가 부족하니 충전을 해라.' },
          { code: 'hr:8', type: 'error', message: '신호가 불량하니 다시 해라' },
          { code: 'hr:9', type: 'info', message: '날뛰고 있어 신호가 안나오니 참고해라' }
        ];
        
        const randomError = errorCodes[Math.floor(Math.random() * errorCodes.length)];
        setSimulatedError(randomError);

        // 오류 알림 생성
        setHardwareAlerts([{
          id: `simulated-alert-${Date.now()}`,
          deviceId: patientId || 'test-device',
          deviceName: deviceInfo?.name || '테스트 디바이스',
          deviceAddress: patientId || 'TEST:00:00:00:00:00',
          ...randomError,
          timestamp: Date.now()
        }]);

        // 5-15초 후 자동으로 정상 복귀
        const errorDuration = 5000 + Math.random() * 10000; // 5-15초
        errorDurationRef.current = setTimeout(() => {
          setSimulatedError(null);
          setHardwareAlerts([]);
        }, errorDuration);
      }
    };

    // 처음 한 번 실행
    triggerRandomError();

    // 10-30초마다 랜덤 오류 발생 시도
    const interval = 10000 + Math.random() * 20000; // 10-30초
    simulationIntervalRef.current = setInterval(triggerRandomError, interval);

    return () => {
      if (simulationIntervalRef.current) {
        clearInterval(simulationIntervalRef.current);
        simulationIntervalRef.current = null;
      }
      if (errorDurationRef.current) {
        clearTimeout(errorDurationRef.current);
        errorDurationRef.current = null;
      }
    };
  }, [isErrorSimulationActive, patientId, deviceInfo]);

  const handleToggleErrorSimulation = () => {
    setIsErrorSimulationActive(prev => !prev);
  };

  // 초기 더미 데이터 생성 (Socket 연결 전까지)
  useEffect(() => {
    if (chartData.length === 0 && !isConnected) {
      const generateInitialData = () => {
        const data = []
        const now = Date.now()
        const interval = 1000
        const count = 60

        for (let i = count - 1; i >= 0; i--) {
          const timestamp = now - (i * interval)
          data.push({
            timestamp,
            time: new Date(timestamp).toLocaleTimeString('ko-KR'),
            ir: 50000 + Math.random() * 10000,
            heartRate: 80 + (Math.random() - 0.5) * 20,
            spo2: 98 + (Math.random() - 0.5) * 2,
            temperature: 38.0 + (Math.random() - 0.5) * 0.5,
            battery: 85
          })
        }
        setChartData(data)
        if (data.length > 0) {
          const latest = data[data.length - 1]
          setCurrentValues({
            heartRate: latest.heartRate,
            spo2: latest.spo2,
            temperature: latest.temperature,
            battery: latest.battery
          })
        }
      }

      generateInitialData()
    }
  }, [isConnected, chartData.length])

  // 디바이스 제어 함수
  const sendControlCommand = async (command) => {
    if (!isConnected) {
      alert('Socket이 연결되지 않았습니다.');
      return;
    }

    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 측정 시작/정지 명령
    if (command.action === 'start_measurement' || command.action === 'stop_measurement') {
      // 디바이스 정보 가져오기
      let deviceMacAddress = null;
      let hubId = null;
      
      // deviceInfo가 있으면 사용
      if (deviceInfo && deviceInfo.hub_address) {
        hubId = deviceInfo.hub_address;
        deviceMacAddress = deviceInfo.address;
      } else if (patientId) {
        // patientId는 pet의 ID이므로, pet 테이블에서 device_address를 가져온 다음 device 조회
        try {
          // 1. pet 정보 조회
          const pet = await petService.getPet(patientId);
          if (!pet || !pet.device_address) {
            alert('환자에 연결된 디바이스를 찾을 수 없습니다.');
            return;
          }
          
          // 2. device 정보 조회 (사용자 email 확인 포함)
          const device = await deviceService.getDevice(pet.device_address);
          if (!device || !device.hub_address) {
            alert('디바이스 정보를 찾을 수 없습니다.');
            return;
          }
          
          hubId = device.hub_address;
          deviceMacAddress = device.address;
          
          // deviceInfo 업데이트
          setDeviceInfo(device);
        } catch (error) {
          console.error('[Monitoring] Failed to get device info:', error);
          alert('디바이스 정보를 가져오는데 실패했습니다.');
          return;
        }
      }
      
      if (!hubId) {
        alert('디바이스의 허브 정보를 찾을 수 없습니다.');
        return;
      }
      
      const measurementCommand = command.action === 'start_measurement' 
        ? `start:${deviceMacAddress}`
        : `stop:${deviceMacAddress}`;
      
      console.log(`[Monitoring] 📤 Sending ${command.action} command:`, {
        hubId,
        deviceId: deviceMacAddress,
        command: measurementCommand
      });
      
      // CSV 세션 시작/종료
      try {
        const now = new Date();
        const startTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}:${String(now.getMilliseconds()).padStart(3, '0')}`;
        
        if (command.action === 'start_measurement') {
          const response = await fetch('http://localhost:5000/api/measurement/start', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              deviceAddress: deviceMacAddress,
              userEmail: 'test@example.com', // TODO: 실제 사용자 이메일로 변경
              petName: '테스트펫', // TODO: 실제 펫 이름으로 변경
              startTime
            })
          });
          const result = await response.json();
          if (!result.success) {
            console.error('[Monitoring] Failed to start CSV session:', result.message);
          }
        } else {
          const response = await fetch('http://localhost:5000/api/measurement/stop', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              deviceAddress: deviceMacAddress
            })
          });
          const result = await response.json();
          if (!result.success) {
            console.error('[Monitoring] Failed to stop CSV session:', result.message);
          }
        }
      } catch (error) {
        console.error(`[Monitoring] Error ${command.action} CSV session:`, error);
      }
      
      // Socket.IO로 제어 명령 전송
      emit('CONTROL_REQUEST', {
        hubId,
        deviceId: deviceMacAddress,
        command: {
          action: command.action,
          raw_command: measurementCommand
        },
        requestId
      });
    } else {
      // 기타 명령은 그대로 전송
      console.log('[Monitoring] 📤 Sending MQTT command:', command);
      emit('CONTROL_REQUEST', {
        hubId: 'AA:BB:CC:DD:EE:01', // 임시 값
        deviceId: patientId || 'AA:BB:CC:DD:EE:FF', // 임시 값
        command,
        requestId
      });
    }
  };

  const getChartData = () => {
    return chartData.map(d => ({
      time: d.time,
      value: d[activeTab] || 0
    }))
  }

  const handleShowMore = () => {
    // TODO: 실제 환자 데이터 가져오기
    setSelectedPatient({
      name: '환자명',
      species: '강아지',
      breed: '포메라니안',
      weight: '3.5kg',
      gender: '수컷',
      neutered: true,
      doctor: '김수의사',
      diagnosis: '건강함'
    })
  }

  const handleCloseModal = () => {
    setSelectedPatient(null)
  }

  const handleDismissAlert = (alertId) => {
    setHardwareAlerts(prev => prev.filter(alert => alert.id !== alertId))
  }

  return (
    <div className="monitoring-page">
      <Header />
      <HardwareAlertBar alerts={hardwareAlerts} onDismiss={handleDismissAlert} />
      <div className="monitoring-container">
        {/* 연결 상태 표시 */}
        <div className="connection-status" style={{ 
          padding: '10px', 
          marginBottom: '10px',
          backgroundColor: isConnected ? '#d4edda' : '#f8d7da',
          color: isConnected ? '#155724' : '#721c24',
          borderRadius: '4px',
          textAlign: 'center'
        }}>
          {isConnected ? '🟢 실시간 연결됨' : '🔴 연결 안 됨'}
        </div>

        {/* 환자 정보 */}
        <section className="patient-info-section">
          <div className="patient-info-row">
            <div className="patient-info-left">
              <h3 className="patient-name">환자 ID: {patientId}</h3>
              <div className="patient-info-items">
                <button 
                  className="more-btn"
                  onClick={handleShowMore}
                >
                  더보기
                </button>
              </div>
            </div>
            <div className="device-name-right">
              {deviceInfo?.name || '디바이스 연결 중...'}
            </div>
          </div>
          {/* 신호처리 상태 표시 */}
          {signalProcessingStatus.processedHR !== null && (
            <div className={`signal-processing-status ${signalProcessingStatus.status}`}>
              <div className="signal-status-header">
                <span className="signal-status-label">신호처리 상태:</span>
                <span className={`signal-status-badge ${signalProcessingStatus.status}`}>
                  {signalProcessingStatus.status === 'normal' && '✅ 정상'}
                  {signalProcessingStatus.status === 'low_quality' && '⚠️ 신뢰도 낮음'}
                  {signalProcessingStatus.status === 'reposition_needed' && '❌ 재부착 필요'}
                  {signalProcessingStatus.status === 'collecting' && '📊 수집 중'}
                </span>
              </div>
              <div className="signal-status-message">{signalProcessingStatus.message}</div>
              <div className="signal-status-metrics">
                <span className="signal-metric">
                  SQI: <strong>{signalProcessingStatus.sqi.toFixed(2)}</strong>
                </span>
                <span className="signal-metric">
                  PI: <strong>{signalProcessingStatus.pi.toFixed(2)}</strong>
                </span>
                {signalProcessingStatus.originalHR && (
                  <span className="signal-metric">
                    원본 HR: <strong>{signalProcessingStatus.originalHR} bpm</strong>
                  </span>
                )}
              </div>
            </div>
          )}
          <div className="current-values-row">
            <div className="current-values-left">
              <span className="current-value-item-inline">
                <span className="current-value-label-inline">심박수:</span>
                <span className="current-value-value-inline">
                  {signalProcessingStatus.processedHR !== null 
                    ? `${Math.round(signalProcessingStatus.processedHR)} bpm` 
                    : `${Math.round(currentValues.heartRate)} bpm`}
                  {hardwareAlerts.length > 0 && (
                    <span className="device-warning-badge" title={hardwareAlerts[0].message}>⚠️</span>
                  )}
                </span>
              </span>
              <span className="current-value-item-inline">
                <span className="current-value-label-inline">산포도:</span>
                <span className="current-value-value-inline">
                  {Math.round(currentValues.spo2)}%
                </span>
              </span>
              <span className="current-value-item-inline">
                <span className="current-value-label-inline">온도:</span>
                <span className="current-value-value-inline">
                  {currentValues.temperature.toFixed(1)}°C
                </span>
              </span>
            </div>
            <div className="battery-right">
              <span className="current-value-label-inline">배터리:</span>
              <span className="current-value-value-inline">
                {currentValues.battery}%
              </span>
            </div>
          </div>
        </section>

        {/* 제어 버튼 */}
        <section style={{ marginBottom: '20px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ 
            padding: '8px 16px', 
            backgroundColor: isMeasurementRunning ? '#d4edda' : '#f8d7da',
            color: isMeasurementRunning ? '#155724' : '#721c24',
            borderRadius: '4px',
            fontWeight: 'bold',
            fontSize: '14px'
          }}>
            {isMeasurementRunning ? '🟢 측정 실행 중' : '🔴 측정 중지됨'}
          </div>
          <button 
            className="btn-primary"
            onClick={() => sendControlCommand({ action: 'start_measurement' })}
            disabled={!isConnected || isMeasurementRunning}
          >
            측정 시작
          </button>
          <button 
            className="btn-secondary"
            onClick={() => sendControlCommand({ action: 'stop_measurement' })}
            disabled={!isConnected || !isMeasurementRunning}
          >
            측정 정지
          </button>
        </section>

        {/* 차트 섹션 */}
        <section className="chart-section">
          <div className="chart-tabs">
            <button
              className={activeTab === 'heartRate' ? 'chart-tab active' : 'chart-tab'}
              onClick={() => setActiveTab('heartRate')}
            >
              심박수
            </button>
            <button
              className={activeTab === 'spo2' ? 'chart-tab active' : 'chart-tab'}
              onClick={() => setActiveTab('spo2')}
            >
              산포도
            </button>
            <button
              className={activeTab === 'temperature' ? 'chart-tab active' : 'chart-tab'}
              onClick={() => setActiveTab('temperature')}
            >
              온도
            </button>
          </div>

          <div className="chart-container">
            <div className="chart-header">
              <h3>
                {activeTab === 'heartRate' && '심박수'}
                {activeTab === 'spo2' && '산포도'}
                {activeTab === 'temperature' && '온도'}
              </h3>
            </div>
            <div className="chart-area">
              <svg className="chart-svg" viewBox="0 0 800 300" preserveAspectRatio="none">
                {getChartData().length > 1 && ((
                  <polyline
                    fill="none"
                    stroke="#3498db"
                    strokeWidth="2"
                    points={getChartData().map((d, i) => {
                      const x = (i / (getChartData().length - 1)) * 800
                      const maxValue = Math.max(...getChartData().map(d => d.value))
                      const minValue = Math.min(...getChartData().map(d => d.value))
                      const range = maxValue - minValue || 1
                      const y = 300 - ((d.value - minValue) / range) * 280 - 10
                      return `${x},${y}`
                    }).join(' ')}
                  />
                ))}
              </svg>
              <div className="chart-labels">
                {getChartData().filter((_, i) => i % 10 === 0).map((d, i) => (
                  <div key={i} className="chart-label">{d.time}</div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <div className="back-button">
          <button onClick={() => navigate('/dashboard')} className="btn-secondary">
            대시보드로 돌아가기
          </button>
        </div>
      </div>

      {/* 환자 상세 정보 모달 */}
      {selectedPatient && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content patient-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>환자 상세 정보</h3>
              <button onClick={handleCloseModal} className="close-btn">×</button>
            </div>
            <div className="modal-body">
              <div className="patient-detail-grid">
                {Object.entries(selectedPatient).map(([key, value]) => (
                  <div key={key} className="detail-item">
                    <span className="detail-label">{key}:</span>
                    <span className="detail-value">{String(value)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={handleCloseModal} className="btn-primary">닫기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Monitoring
