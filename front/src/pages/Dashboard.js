import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import { dummyDevices, dummyPatients } from '../data/dummyData'
import './Dashboard.css'

function Dashboard() {
  const navigate = useNavigate()
  const [selectedPatient, setSelectedPatient] = useState(null)
  
  // 연결된 디바이스만 필터링
  const connectedDevices = dummyDevices.filter(device => 
    device.status === 'connected' && device.connectedPatient
  )

  const handleMonitor = (patientId) => {
    navigate(`/monitoring/${patientId}`)
  }

  const handleShowMore = (patientId) => {
    const patient = dummyPatients.find(p => p.id === patientId)
    setSelectedPatient(patient)
  }

  const handleCloseModal = () => {
    setSelectedPatient(null)
  }

  return (
    <div className="dashboard-page">
      <Header />
      <div className="dashboard-container">
        {/* 현황 섹션 */}
        <section className="monitoring-section">
          <h2>현황</h2>
          {connectedDevices.length > 0 ? (
            <div className="monitoring-grid">
              {connectedDevices.map(device => {
                const patient = dummyPatients.find(p => p.id === device.connectedPatient.id)
                return (
                <div key={device.id} className="monitoring-card">
                  <div className="monitoring-header">
                    <div className="patient-info-left">
                      <div className="patient-name-row">
                        <h3>환자명 : {device.connectedPatient.name}</h3>
                        {patient && (
                          <div className="patient-basic-info">
                            <span className="info-text">{patient.weight}kg / {patient.gender}</span>
                            <span className="info-text">주치의: {patient.doctor}</span>
                            <span className="info-text">진단명: {patient.diagnosis}</span>
                            <button 
                              className="more-btn"
                              onClick={() => handleShowMore(device.connectedPatient.id)}
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
                        onClick={() => handleMonitor(device.connectedPatient.id)}
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

export default Dashboard

