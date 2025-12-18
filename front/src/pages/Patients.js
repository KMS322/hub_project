import { useState, useEffect } from 'react'
import Header from '../components/Header'
import petService from '../api/petService'
import deviceService from '../api/deviceService'
import AlertModal from '../components/AlertModal'
import ConfirmModal from '../components/ConfirmModal'
import './Patients.css'

function Patients() {
  const [patients, setPatients] = useState([])
  const [devices, setDevices] = useState([])
  const [filter, setFilter] = useState('admitted') // all, admitted, discharged
  const [showAddModal, setShowAddModal] = useState(false)
  const [alertModal, setAlertModal] = useState({ isOpen: false, title: '', message: '' })
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null })
  const [deviceSelectModal, setDeviceSelectModal] = useState({ isOpen: false, patientId: null })
  const [loading, setLoading] = useState(true)
  const [formData, setFormData] = useState({
    name: '',
    species: '',
    breed: '',
    weight: '',
    gender: '',
    neutering: '',
    birthDate: '',
    admissionDate: '',
    veterinarian: '',
    diagnosis: '',
    medicalHistory: '',
    device_address: ''
  })

  // 데이터 로드
  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [petsData, devicesData] = await Promise.all([
        petService.getPets(),
        deviceService.getDevices()
      ])
      
      setPatients(petsData)
      setDevices(devicesData)
    } catch (error) {
      console.error('Failed to load data:', error)
      setAlertModal({
        isOpen: true,
        title: '오류',
        message: '데이터를 불러오는데 실패했습니다.'
      })
    } finally {
      setLoading(false)
    }
  }

  const filteredPatients = filter === 'all' 
    ? patients 
    : patients.filter(p => p.status === filter)

  const handleDischarge = async (patientId) => {
    setConfirmModal({
      isOpen: true,
      title: '퇴원 처리',
      message: '이 환자를 퇴원 처리하시겠습니까?',
      onConfirm: async () => {
        try {
          await petService.updatePet(patientId, { device_address: null })
          setAlertModal({ isOpen: true, title: '처리 완료', message: '퇴원 처리가 완료되었습니다.' })
          loadData()
        } catch (error) {
          setAlertModal({ isOpen: true, title: '오류', message: error.message || '퇴원 처리에 실패했습니다.' })
        }
      }
    })
  }

  const handleDeviceDisconnect = async (patientId) => {
    setConfirmModal({
      isOpen: true,
      title: '디바이스 연결 해제',
      message: '이 환자와 연결된 디바이스를 해제하시겠습니까?',
      onConfirm: async () => {
        try {
          await petService.updatePet(patientId, { device_address: null })
          setAlertModal({ isOpen: true, title: '처리 완료', message: '디바이스 연결이 해제되었습니다.' })
          loadData()
        } catch (error) {
          setAlertModal({ isOpen: true, title: '오류', message: error.message || '연결 해제에 실패했습니다.' })
        }
      }
    })
  }

  const handleDeviceChange = async (patientId, deviceAddress) => {
    try {
      await petService.updatePet(patientId, { device_address: deviceAddress })
      setAlertModal({ isOpen: true, title: '처리 완료', message: '디바이스가 변경되었습니다.' })
      loadData()
    } catch (error) {
      setAlertModal({ isOpen: true, title: '오류', message: error.message || '디바이스 변경에 실패했습니다.' })
    }
  }

  const handleDeviceConnect = async (patientId, deviceAddress) => {
    try {
      await petService.updatePet(patientId, { device_address: deviceAddress })
      setAlertModal({ isOpen: true, title: '처리 완료', message: '디바이스가 연결되었습니다.' })
      loadData()
    } catch (error) {
      setAlertModal({ isOpen: true, title: '오류', message: error.message || '디바이스 연결에 실패했습니다.' })
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await petService.createPet(formData)
      setAlertModal({ isOpen: true, title: '등록 완료', message: '환자가 등록되었습니다.' })
      setShowAddModal(false)
      setFormData({
        name: '',
        species: '',
        breed: '',
        weight: '',
        gender: '',
        neutering: '',
        birthDate: '',
        admissionDate: '',
        veterinarian: '',
        diagnosis: '',
        medicalHistory: '',
        device_address: ''
      })
      loadData()
    } catch (error) {
      setAlertModal({ isOpen: true, title: '오류', message: error.message || '환자 등록에 실패했습니다.' })
    }
  }

  // 가용 디바이스 목록
  const availableDevices = devices.filter(d => 
    d.status === 'connected' && !d.connectedPatient
  )

  if (loading) {
    return (
      <div className="patients-page">
        <Header />
        <div className="patients-container">
          <div className="loading">데이터를 불러오는 중...</div>
        </div>
      </div>
    )
  }

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
                    <span>{patient.neutering}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">담당주치의:</span>
                    <span>{patient.veterinarian}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">진단명:</span>
                    <span>{patient.diagnosis}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">입원일:</span>
                    <span>{patient.admissionDate}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">연결된 디바이스:</span>
                    <span>{patient.connectedDevice ? patient.connectedDevice.name : '없음'}</span>
                  </div>
                </div>
              </div>
              <div className="patient-actions">
                {patient.connectedDevice && (
                  <>
                    <button 
                      className="btn-secondary"
                      onClick={() => {
                        const newDevice = availableDevices[0]
                        if (newDevice) {
                          handleDeviceChange(patient.id, newDevice.address)
                        } else {
                          setAlertModal({ isOpen: true, title: '알림', message: '가용한 디바이스가 없습니다.' })
                        }
                      }}
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
                  <button 
                    className="btn-primary"
                    onClick={() => setDeviceSelectModal({ isOpen: true, patientId: patient.id })}
                  >
                    디바이스 연결
                  </button>
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

      {/* 환자 등록 모달 */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>환자 등록</h3>
              <button onClick={() => setShowAddModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleSubmit}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                  {/* 왼쪽 열 */}
                  <div>
                    <div className="form-group">
                      <label>이름 *</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>종류 *</label>
                      <input
                        type="text"
                        value={formData.species}
                        onChange={(e) => setFormData({ ...formData, species: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>품종 *</label>
                      <input
                        type="text"
                        value={formData.breed}
                        onChange={(e) => setFormData({ ...formData, breed: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>체중 *</label>
                      <input
                        type="text"
                        value={formData.weight}
                        onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>성별 *</label>
                      <select
                        value={formData.gender}
                        onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                        required
                      >
                        <option value="">선택</option>
                        <option value="수컷">수컷</option>
                        <option value="암컷">암컷</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>중성화 여부 *</label>
                      <select
                        value={formData.neutering}
                        onChange={(e) => setFormData({ ...formData, neutering: e.target.value })}
                        required
                      >
                        <option value="">선택</option>
                        <option value="완료">완료</option>
                        <option value="미완료">미완료</option>
                      </select>
                    </div>
                  </div>

                  {/* 오른쪽 열 */}
                  <div>
                    <div className="form-group">
                      <label>생년월일 *</label>
                      <input
                        type="date"
                        value={formData.birthDate}
                        onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>입원일 *</label>
                      <input
                        type="date"
                        value={formData.admissionDate}
                        onChange={(e) => setFormData({ ...formData, admissionDate: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>담당수의사 *</label>
                      <input
                        type="text"
                        value={formData.veterinarian}
                        onChange={(e) => setFormData({ ...formData, veterinarian: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>진단명 *</label>
                      <input
                        type="text"
                        value={formData.diagnosis}
                        onChange={(e) => setFormData({ ...formData, diagnosis: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>과거병력 *</label>
                      <textarea
                        value={formData.medicalHistory}
                        onChange={(e) => setFormData({ ...formData, medicalHistory: e.target.value })}
                        required
                        style={{ minHeight: '80px' }}
                      />
                    </div>
                    <div className="form-group">
                      <label>연결할 디바이스 (선택사항)</label>
                      <select
                        value={formData.device_address}
                        onChange={(e) => setFormData({ ...formData, device_address: e.target.value })}
                      >
                        <option value="">없음</option>
                        {availableDevices.map(device => (
                          <option key={device.address} value={device.address}>
                            {device.name} ({device.address})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* 버튼 하단 중앙 배치 */}
                <div className="form-actions" style={{ marginTop: '2rem', display: 'flex', justifyContent: 'center', gap: '1rem' }}>
                  <button type="button" className="btn-secondary" onClick={() => setShowAddModal(false)}>
                    취소
                  </button>
                  <button type="submit" className="btn-primary">등록</button>
                </div>
              </form>
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

      {/* 디바이스 선택 모달 */}
      {deviceSelectModal.isOpen && (
        <div className="modal-overlay" onClick={() => setDeviceSelectModal({ isOpen: false, patientId: null })}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>디바이스 선택</h3>
              <button onClick={() => setDeviceSelectModal({ isOpen: false, patientId: null })}>×</button>
            </div>
            <div className="modal-body">
              {availableDevices.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {availableDevices.map(device => (
                    <button
                      key={device.address}
                      className="btn-secondary"
                      style={{ width: '100%', textAlign: 'left', padding: '0.75rem' }}
                      onClick={() => {
                        handleDeviceConnect(deviceSelectModal.patientId, device.address);
                        setDeviceSelectModal({ isOpen: false, patientId: null });
                      }}
                    >
                      {device.name} ({device.address})
                    </button>
                  ))}
                </div>
              ) : (
                <div>연결 가능한 디바이스가 없습니다.</div>
              )}
            </div>
            <div className="modal-footer">
              <button 
                className="btn-secondary" 
                onClick={() => setDeviceSelectModal({ isOpen: false, patientId: null })}
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Patients
