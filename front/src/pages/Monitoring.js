import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import { useSocket } from '../hooks/useSocket'
import { API_URL } from '../constants'
import './Monitoring.css'

function Monitoring() {
  const { patientId } = useParams()
  const navigate = useNavigate()
  const { isConnected, on, emit, off } = useSocket()
  const [activeTab, setActiveTab] = useState('ir') // ir, heartRate, spo2, temperature
  const [chartData, setChartData] = useState([])
  const [selectedPatient, setSelectedPatient] = useState(null)
  const [currentValues, setCurrentValues] = useState({
    heartRate: 0,
    spo2: 0,
    temperature: 0,
    battery: 0
  })
  const [deviceInfo, setDeviceInfo] = useState(null)
  const chartDataRef = useRef([])

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
        // dataArr가 있는 경우 (배치 데이터)
        if (data.data?.dataArr && Array.isArray(data.data.dataArr)) {
          const newData = data.data.dataArr.map(sample => ({
            timestamp: data.data.timestamp || Date.now(),
            time: new Date(data.data.timestamp || Date.now()).toLocaleTimeString('ko-KR'),
            ir: sample.ir || 0,
            heartRate: sample.hr || 0,
            spo2: sample.spo2 || 0,
            temperature: sample.temp || 0,
            battery: sample.battery || 0
          }));

          // 최신 데이터로 현재 값 업데이트
          if (newData.length > 0) {
            const latest = newData[newData.length - 1];
            setCurrentValues({
              heartRate: latest.heartRate,
              spo2: latest.spo2,
              temperature: latest.temperature,
              battery: latest.battery
            });
          }

          // 차트 데이터에 추가 (최근 60개만 유지)
          setChartData(prev => {
            const updated = [...prev, ...newData];
            return updated.slice(-60); // 최근 60개만 유지
          });
        } else {
          // 단일 샘플인 경우
          const sample = {
            timestamp: data.data?.timestamp || Date.now(),
            time: new Date(data.data?.timestamp || Date.now()).toLocaleTimeString('ko-KR'),
            ir: data.data?.ir || 0,
            heartRate: data.data?.hr || 0,
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
      if (data.success) {
        alert('명령이 성공적으로 실행되었습니다.');
      } else {
        alert(`명령 실행 실패: ${data.error || '알 수 없는 오류'}`);
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

    // 정리 함수
    return () => {
      off('TELEMETRY', handleTelemetry);
      off('DEVICE_STATUS', handleDeviceStatus);
      off('CONTROL_RESULT', handleControlResult);
    };
  }, [isConnected, patientId, on, emit, off]);

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
  const sendControlCommand = (command) => {
    if (!isConnected) {
      alert('Socket이 연결되지 않았습니다.');
      return;
    }

    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // TODO: 실제 hubId와 deviceId를 가져와야 함
    emit('CONTROL_REQUEST', {
      hubId: 'AA:BB:CC:DD:EE:01', // 임시 값
      deviceId: patientId || 'AA:BB:CC:DD:EE:FF', // 임시 값
      command,
      requestId
    });
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

  return (
    <div className="monitoring-page">
      <Header />
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
          <div className="current-values-row">
            <div className="current-values-left">
              <span className="current-value-item-inline">
                <span className="current-value-label-inline">심박수:</span>
                <span className="current-value-value-inline">
                  {Math.round(currentValues.heartRate)} bpm
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
        <section style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
          <button 
            className="btn-primary"
            onClick={() => sendControlCommand({ action: 'start_measurement' })}
            disabled={!isConnected}
          >
            측정 시작
          </button>
          <button 
            className="btn-secondary"
            onClick={() => sendControlCommand({ action: 'stop_measurement' })}
            disabled={!isConnected}
          >
            측정 정지
          </button>
          <button 
            className="btn-secondary"
            onClick={() => sendControlCommand({ action: 'led_blink' })}
            disabled={!isConnected}
          >
            LED 깜빡임
          </button>
        </section>

        {/* 차트 섹션 */}
        <section className="chart-section">
          <div className="chart-tabs">
            <button
              className={activeTab === 'ir' ? 'chart-tab active' : 'chart-tab'}
              onClick={() => setActiveTab('ir')}
            >
              IR
            </button>
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
                {activeTab === 'ir' && 'IR 데이터'}
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
