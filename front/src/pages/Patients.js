import { useState } from 'react'
import Header from '../components/Header'
import { dummyPatients, dummyDevices } from '../data/dummyData'
import AlertModal from '../components/AlertModal'
import ConfirmModal from '../components/ConfirmModal'
import './Patients.css'

function Patients() {
  const [patients] = useState(dummyPatients)
  const [devices] = useState(dummyDevices)
  const [filter, setFilter] = useState('admitted') // all, admitted, discharged
  const [showAddModal, setShowAddModal] = useState(false)
  const [alertModal, setAlertModal] = useState({ isOpen: false, title: '', message: '' })
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null })

  const filteredPatients = filter === 'all' 
    ? patients 
    : patients.filter(p => p.status === filter)

  const handleDischarge = (patientId) => {
    setConfirmModal({
      isOpen: true,
      title: '퇴원 처리',
      message: '이 환자를 퇴원 처리하시겠습니까?',
      onConfirm: () => {
        setAlertModal({ isOpen: true, title: '처리 완료', message: '퇴원 처리가 완료되었습니다.' })
      }
    })
  }

  const handleDeviceDisconnect = (patientId) => {
    setConfirmModal({
      isOpen: true,
      title: '디바이스 연결 해제',
      message: '이 환자와 연결된 디바이스를 해제하시겠습니까?',
      onConfirm: () => {
        setAlertModal({ isOpen: true, title: '처리 완료', message: '디바이스 연결이 해제되었습니다.' })
      }
    })
  }

  const handleDeviceChange = (patientId) => {
    setAlertModal({ isOpen: true, title: '디바이스 변경', message: '디바이스 변경 기능은 추후 구현됩니다.' })
  }

  // 가용 디바이스 목록
  const availableDevices = devices.filter(d => 
    d.status === 'connected' && !d.connectedPatient
  )

  return (
    <div className="patients-page">
      <Header />
      <div className="patients-container">
        <div className="patients-header">
          <button className="btn-primary" onClick={() => setShowAddModal(true)}>
            환자 등록
          </button>
        </div>

        <div className="filter-tabs">
          <button 
            className={filter === 'all' ? 'filter-tab active' : 'filter-tab'}
            onClick={() => setFilter('all')}
          >
            전체 ({patients.length})
          </button>
          <button 
            className={filter === 'admitted' ? 'filter-tab active' : 'filter-tab'}
            onClick={() => setFilter('admitted')}
          >
            입원중 ({patients.filter(p => p.status === 'admitted').length})
          </button>
          <button 
            className={filter === 'discharged' ? 'filter-tab active' : 'filter-tab'}
            onClick={() => setFilter('discharged')}
          >
            퇴원 ({patients.filter(p => p.status === 'discharged').length})
          </button>
        </div>

        <div className="patients-list">
          {filteredPatients.map(patient => (
            <div key={patient.id} className="patient-card">
              <div className="patient-info">
                <div className="patient-header">
                  <h3>{patient.name}</h3>
                  <span className={`status-badge ${patient.status}`}>
                    {patient.status === 'admitted' ? '입원중' : '퇴원'}
                  </span>
                </div>
                <div className="patient-details">
                  <div className="detail-row">
                    <span className="label">종류:</span>
                    <span>{patient.species} ({patient.breed})</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">생년월일:</span>
                    <span>{patient.birthDate}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">체중:</span>
                    <span>{patient.weight} kg</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">성별:</span>
                    <span>{patient.gender}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">중성화 여부:</span>
                    <span>{patient.neutered ? '예' : '아니오'}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">보호자:</span>
                    <span>{patient.ownerName} ({patient.ownerPhone})</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">담당주치의:</span>
                    <span>{patient.doctor}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">진단명:</span>
                    <span>{patient.diagnosis}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">입원일:</span>
                    <span>{patient.admissionDate}</span>
                  </div>
                  {patient.dischargeDate && (
                    <div className="detail-row">
                      <span className="label">퇴원일:</span>
                      <span>{patient.dischargeDate}</span>
                    </div>
                  )}
                  <div className="detail-row">
                    <span className="label">연결된 디바이스:</span>
                    <span>{patient.connectedDevice ? patient.connectedDevice.name : '없음'}</span>
                  </div>
                  <div className="detail-row full-width">
                    <span className="label">과거병력:</span>
                    <span>{patient.medicalHistory || '없음'}</span>
                  </div>
                </div>
              </div>
              <div className="patient-actions">
                <button className="btn-secondary">수정</button>
                {patient.connectedDevice && (
                  <>
                    <button 
                      className="btn-secondary"
                      onClick={() => handleDeviceChange(patient.id)}
                    >
                      디바이스 변경
                    </button>
                    <button 
                      className="btn-secondary"
                      onClick={() => handleDeviceDisconnect(patient.id)}
                    >
                      디바이스 해제
                    </button>
                  </>
                )}
                {!patient.connectedDevice && availableDevices.length > 0 && (
                  <button className="btn-primary">디바이스 연결</button>
                )}
                {patient.status === 'admitted' && (
                  <button 
                    className="btn-danger"
                    onClick={() => handleDischarge(patient.id)}
                  >
                    퇴원 처리
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {filteredPatients.length === 0 && (
          <div className="no-data">등록된 환자가 없습니다.</div>
        )}
      </div>

      {/* 환자 등록 모달 (간단한 형태) */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>환자 등록</h3>
              <button onClick={() => setShowAddModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <p>환자 등록 폼은 추후 구현됩니다.</p>
            </div>
          </div>
        </div>
      )}

      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={() => setAlertModal({ isOpen: false, title: '', message: '' })}
        title={alertModal.title}
        message={alertModal.message}
      />
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: null })}
        onConfirm={confirmModal.onConfirm || (() => {})}
        title={confirmModal.title}
        message={confirmModal.message}
      />
    </div>
  )
}

export default Patients

