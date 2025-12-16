import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import HardwareAlertBar from '../components/HardwareAlertBar'
import petService from '../api/petService'
import deviceService from '../api/deviceService'
import { useSocket } from '../hooks/useSocket'
import { detectDeviceErrors } from '../utils/hardwareErrorDetector'
import './Dashboard.css'

function Dashboard() {
  const navigate = useNavigate()
  const { isConnected, on, off } = useSocket()
  const [selectedPatient, setSelectedPatient] = useState(null)
  const [connectedDevices, setConnectedDevices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [hardwareAlerts, setHardwareAlerts] = useState([])

  // 데이터 로드
  useEffect(() => {
    loadData()
  }, [])

    // Socket.IO로 실시간 데이터 업데이트
  useEffect(() => {
    if (!isConnected) return

    const handleTelemetry = (data) => {
      if (data.type === 'sensor_data' && data.deviceId) {
        // 디바이스의 현재 데이터 업데이트
        setConnectedDevices(prev => prev.map(device => {
          if (device.address === data.deviceId) {
            const latest = data.data?.dataArr?.[data.data.dataArr.length - 1] || data.data
            return {
              ...device,
              currentData: {
                heartRate: latest.hr || device.currentData?.heartRate || 0,
                spo2: latest.spo2 || device.currentData?.spo2 || 0,
                temperature: latest.temp || device.currentData?.temperature || 0,
                battery: latest.battery || device.currentData?.battery || 0
              }
            }
          }
          return device
        }))
      }
    }

    on('TELEMETRY', handleTelemetry)

    return () => {
      off('TELEMETRY', handleTelemetry)
    }
  }, [isConnected, on, off])

  // 하드웨어 오류 감지 및 알림 업데이트
  useEffect(() => {
    const alerts = detectDeviceErrors(connectedDevices)
    setHardwareAlerts(alerts)
  }, [connectedDevices])

  const handleDismissAlert = (alertId) => {
    setHardwareAlerts(prev => prev.filter(alert => alert.id !== alertId))
  }

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      // 디바이스 목록 조회
      const devices = await deviceService.getDevices()
      
      // 환자 목록 조회
      const pets = await petService.getPets()

      // 디바이스와 환자 연결
      const devicesWithPatients = devices
        .filter(device => device.status === 'connected' && device.connectedPatient)
        .map(device => {
          const patient = pets.find(p => p.id === device.connectedPatient?.id)
          return {
            id: device.id,
            address: device.address,
            name: device.name,
            hub_address: device.hub_address,
            hubName: device.hubName,
            status: device.status,
            connectedPatient: patient ? {
              id: patient.id,
              name: patient.name,
              species: patient.species,
              breed: patient.breed,
              weight: patient.weight,
              gender: patient.gender,
              doctor: patient.veterinarian,
              diagnosis: patient.diagnosis
            } : null,
            currentData: {
              heartRate: 0,
              spo2: 0,
              temperature: 0,
              battery: 0
            }
          }
        })

      setConnectedDevices(devicesWithPatients)
    } catch (err) {
      console.error('Failed to load data:', err)
      setError(err.message || '데이터를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleMonitor = (patientId) => {
    navigate(`/monitoring/${patientId}`)
  }

  const handleShowMore = (patientId) => {
    const device = connectedDevices.find(d => d.connectedPatient?.id === patientId)
    if (device && device.connectedPatient) {
      setSelectedPatient(device.connectedPatient)
    }
  }

  const handleCloseModal = () => {
    setSelectedPatient(null)
  }

  if (loading) {
    return (
      <div className="dashboard-page">
        <Header />
        <div className="dashboard-container">
          <div className="loading">데이터를 불러오는 중...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="dashboard-page">
        <Header />
        <div className="dashboard-container">
          <div className="error-message">{error}</div>
          <button onClick={loadData} className="btn-primary">다시 시도</button>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard-page">
      <Header />
      <HardwareAlertBar alerts={hardwareAlerts} onDismiss={handleDismissAlert} />
      <div className="dashboard-container">
        {/* 현황 섹션 */}
        <section className="monitoring-section">
          <h2>현황</h2>
          {connectedDevices.length > 0 ? (
            <div className="monitoring-grid">
              {connectedDevices.map(device => {
                const patient = device.connectedPatient
                return (
                  <div key={device.id} className="monitoring-card">
                    <div className="monitoring-header">
                      <div className="patient-info-left">
                        <div className="patient-name-row">
                          <h3>
                            환자명 : {patient?.name || '알 수 없음'}
                            {hardwareAlerts.some(alert => alert.deviceId === device.id || alert.deviceAddress === device.address) && (
                              <span className="device-warning-badge" title="하드웨어 오류 감지됨">⚠️</span>
                            )}
                          </h3>
                          {patient && (
                            <div className="patient-basic-info">
                              <span className="info-text">{patient.weight}kg / {patient.gender}</span>
                              <span className="info-text">주치의: {patient.doctor}</span>
                              <span className="info-text">진단명: {patient.diagnosis}</span>
                              <button 
                                className="more-btn"
                                onClick={() => handleShowMore(patient.id)}
                              >
                                더보기
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="header-right">
                        <span className="device-name">{device.name}</span>
                        <button 
                          className="monitor-btn"
                          onClick={() => handleMonitor(patient?.id)}
                        >
                          모니터링하기
                        </button>
                      </div>
                    </div>
                    <div className="monitoring-data">
                      <div className="data-item">
                        <span className="data-label">심박수</span>
                        <span className="data-value">{device.currentData.heartRate} bpm</span>
                      </div>
                      <div className="data-item">
                        <span className="data-label">산포도</span>
                        <span className="data-value">{device.currentData.spo2}%</span>
                      </div>
                      <div className="data-item">
                        <span className="data-label">온도</span>
                        <span className="data-value">{device.currentData.temperature}°C</span>
                      </div>
                      <div className="data-item">
                        <span className="data-label">배터리</span>
                        <span className="data-value">{device.currentData.battery}%</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="no-data">연결된 디바이스가 없습니다.</div>
          )}
        </section>
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
                <div className="detail-item">
                  <span className="detail-label">이름:</span>
                  <span className="detail-value">{selectedPatient.name}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">종류:</span>
                  <span className="detail-value">{selectedPatient.species} ({selectedPatient.breed})</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">체중:</span>
                  <span className="detail-value">{selectedPatient.weight} kg</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">성별:</span>
                  <span className="detail-value">{selectedPatient.gender}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">담당주치의:</span>
                  <span className="detail-value">{selectedPatient.doctor}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">진단명:</span>
                  <span className="detail-value">{selectedPatient.diagnosis}</span>
                </div>
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

export default Dashboard
