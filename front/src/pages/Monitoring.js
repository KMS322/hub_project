import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import { dummyPatients, dummyDevices } from '../data/dummyData'
import './Monitoring.css'

function Monitoring() {
  const { patientId } = useParams()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('ir') // ir, heartRate, spo2, temperature
  const [chartData, setChartData] = useState([])
  const [selectedPatient, setSelectedPatient] = useState(null)

  // 환자 정보 찾기
  const patient = dummyPatients.find(p => p.id === patientId)
  const device = dummyDevices.find(d => d.connectedPatient?.id === patientId)

  // 더미 시계열 데이터 생성
  useEffect(() => {
    if (!device) return

    const generateDummyData = () => {
      const data = []
      const now = Date.now()
      const interval = 1000 // 1초 간격
      const count = 60 // 최근 60개 데이터

      for (let i = count - 1; i >= 0; i--) {
        const timestamp = now - (i * interval)
        const baseValue = {
          ir: 50000 + Math.random() * 10000,
          heartRate: device.currentData.heartRate + (Math.random() - 0.5) * 20,
          spo2: device.currentData.spo2 + (Math.random() - 0.5) * 2,
          temperature: device.currentData.temperature + (Math.random() - 0.5) * 0.5
        }

        data.push({
          timestamp,
          time: new Date(timestamp).toLocaleTimeString('ko-KR'),
          ...baseValue
        })
      }
      setChartData(data)
    }

    generateDummyData()
    // 실시간 업데이트 시뮬레이션 (1초마다)
    const interval = setInterval(() => {
      generateDummyData()
    }, 1000)

    return () => clearInterval(interval)
  }, [device])

  if (!patient || !device) {
    return (
      <div className="monitoring-page">
        <Header />
        <div className="monitoring-container">
          <div className="error-message">환자 정보를 찾을 수 없습니다.</div>
          <button onClick={() => navigate('/dashboard')} className="btn-primary">
            대시보드로 돌아가기
          </button>
        </div>
      </div>
    )
  }

  const getChartData = () => {
    return chartData.map(d => ({
      time: d.time,
      value: d[activeTab]
    }))
  }

  const handleShowMore = () => {
    setSelectedPatient(patient)
  }

  const handleCloseModal = () => {
    setSelectedPatient(null)
  }

  return (
    <div className="monitoring-page">
      <Header />
      <div className="monitoring-container">
        {/* 환자 정보 */}
        <section className="patient-info-section">
          <div className="patient-info-row">
            <div className="patient-info-left">
              <h3 className="patient-name">환자명: {patient.name}</h3>
              <div className="patient-info-items">
                <span className="info-text">{patient.species} ({patient.breed})</span>
                <span className="info-text">{patient.weight}kg / {patient.gender}</span>
                <span className="info-text">주치의: {patient.doctor}</span>
                <span className="info-text">진단명: {patient.diagnosis}</span>
                <button 
                  className="more-btn"
                  onClick={handleShowMore}
                >
                  더보기
                </button>
              </div>
            </div>
            <div className="device-name-right">
              {device.name}
            </div>
          </div>
          <div className="current-values-row">
            <div className="current-values-left">
              <span className="current-value-item-inline">
                <span className="current-value-label-inline">심박수:</span>
                <span className="current-value-value-inline">
                  {chartData.length > 0 ? Math.round(chartData[chartData.length - 1].heartRate) : 0} bpm
                </span>
              </span>
              <span className="current-value-item-inline">
                <span className="current-value-label-inline">산포도:</span>
                <span className="current-value-value-inline">
                  {chartData.length > 0 ? Math.round(chartData[chartData.length - 1].spo2) : 0}%
                </span>
              </span>
              <span className="current-value-item-inline">
                <span className="current-value-label-inline">온도:</span>
                <span className="current-value-value-inline">
                  {chartData.length > 0 ? chartData[chartData.length - 1].temperature.toFixed(1) : 0}°C
                </span>
              </span>
            </div>
            <div className="battery-right">
              <span className="current-value-label-inline">배터리:</span>
              <span className="current-value-value-inline">
                {device.currentData.battery}%
              </span>
            </div>
          </div>
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
              {/* 간단한 차트 시각화 (나중에 차트 라이브러리로 교체 가능) */}
              <svg className="chart-svg" viewBox="0 0 800 300" preserveAspectRatio="none">
                {getChartData().length > 1 && (
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
                )}
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
                <div className="detail-item">
                  <span className="detail-label">이름:</span>
                  <span className="detail-value">{selectedPatient.name}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">종류:</span>
                  <span className="detail-value">{selectedPatient.species} ({selectedPatient.breed})</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">생년월일:</span>
                  <span className="detail-value">{selectedPatient.birthDate}</span>
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
                  <span className="detail-label">중성화 여부:</span>
                  <span className="detail-value">{selectedPatient.neutered ? '예' : '아니오'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">보호자:</span>
                  <span className="detail-value">{selectedPatient.ownerName} ({selectedPatient.ownerPhone})</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">담당주치의:</span>
                  <span className="detail-value">{selectedPatient.doctor}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">진단명:</span>
                  <span className="detail-value">{selectedPatient.diagnosis}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">입원일:</span>
                  <span className="detail-value">{selectedPatient.admissionDate}</span>
                </div>
                {selectedPatient.dischargeDate && (
                  <div className="detail-item">
                    <span className="detail-label">퇴원일:</span>
                    <span className="detail-value">{selectedPatient.dischargeDate}</span>
                  </div>
                )}
                <div className="detail-item">
                  <span className="detail-label">연결된 디바이스:</span>
                  <span className="detail-value">{selectedPatient.connectedDevice ? selectedPatient.connectedDevice.name : '없음'}</span>
                </div>
                <div className="detail-item full-width">
                  <span className="detail-label">과거병력:</span>
                  <span className="detail-value">{selectedPatient.medicalHistory || '없음'}</span>
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

export default Monitoring

