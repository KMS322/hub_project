import { useState, useEffect } from 'react'
import Header from '../components/Header'
import petService from '../api/petService'
import deviceService from '../api/deviceService'
import AlertModal from '../components/AlertModal'
import ConfirmModal from '../components/ConfirmModal'
import './Patients.css'

// PatientForm 컴포넌트를 외부로 분리
const PatientForm = ({
  formData,
  setFormData,
  onSubmit,
  isEdit,
  today,
  availableDevices,
  onCancel
}) => (
  <form onSubmit={onSubmit}>
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
            placeholder="개 or 고양이"
            required
          />
        </div>
        <div className="form-group">
          <label>품종 *</label>
          <input
            type="text"
            value={formData.breed}
            onChange={(e) => setFormData({ ...formData, breed: e.target.value })}
            placeholder="ex) 말티즈, 푸들"
            required
          />
        </div>
        <div className="form-group">
          <label>체중 *</label>
          <input
            type="text"
            value={formData.weight}
            onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
            placeholder="체중 (kg)"
            required
          />
        </div>
        <div className="form-group">
          <label>성별 *</label>
          <div style={{ display: 'flex', gap: '1rem', paddingTop: '0.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="radio"
                name={`gender-${isEdit ? 'edit' : 'add'}`}
                value="수컷"
                checked={formData.gender === '수컷'}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                required
              />
              수컷
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="radio"
                name={`gender-${isEdit ? 'edit' : 'add'}`}
                value="암컷"
                checked={formData.gender === '암컷'}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                required
              />
              암컷
            </label>
          </div>
        </div>
        <div className="form-group">
          <label>중성화 여부 *</label>
          <div style={{ display: 'flex', gap: '1rem', paddingTop: '0.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="radio"
                name={`neutering-${isEdit ? 'edit' : 'add'}`}
                value="여"
                checked={formData.neutering === '여'}
                onChange={(e) => setFormData({ ...formData, neutering: e.target.value })}
                required
              />
              여
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="radio"
                name={`neutering-${isEdit ? 'edit' : 'add'}`}
                value="부"
                checked={formData.neutering === '부'}
                onChange={(e) => setFormData({ ...formData, neutering: e.target.value })}
                required
              />
              부
            </label>
          </div>
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
            max={today}
            required
          />
        </div>
        <div className="form-group">
          <label>입원일 *</label>
          <input
            type="date"
            value={formData.admissionDate}
            onChange={(e) => setFormData({ ...formData, admissionDate: e.target.value })}
            max={today}
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
      <button
        type="button"
        className="btn-secondary"
        onClick={onCancel}
      >
        취소
      </button>
      <button type="submit" className="btn-primary">
        {isEdit ? '수정' : '등록'}
      </button>
    </div>
  </form>
)

function Patients() {
  const [patients, setPatients] = useState([])
  const [devices, setDevices] = useState([])
  const [filter, setFilter] = useState('admitted') // all, admitted, discharged
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingPatient, setEditingPatient] = useState(null)
  const [alertModal, setAlertModal] = useState({ isOpen: false, title: '', message: '' })
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null })
  const [deviceSelectModal, setDeviceSelectModal] = useState({ isOpen: false, patientId: null })
  const [loading, setLoading] = useState(true)
  const [formData, setFormData] = useState({
    name: '',
    species: '',
    breed: '',
    weight: '',
    gender: '수컷',
    neutering: '여',
    birthDate: '2020-01-01',
    admissionDate: new Date().toISOString().split('T')[0],
    veterinarian: '',
    diagnosis: '',
    medicalHistory: '',
    device_address: '',
    state: '입원중'
  })

  // 오늘 날짜 (YYYY-MM-DD 형식)
  const today = new Date().toISOString().split('T')[0]

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

  const handleEdit = (patient) => {
    setEditingPatient(patient)
    setFormData({
      name: patient.name,
      species: patient.species,
      breed: patient.breed,
      weight: patient.weight,
      gender: patient.gender,
      neutering: patient.neutering,
      birthDate: patient.birthDate,
      admissionDate: patient.admissionDate,
      veterinarian: patient.veterinarian,
      diagnosis: patient.diagnosis,
      medicalHistory: patient.medicalHistory,
      device_address: patient.device_address || '',
      state: patient.state || '입원중'
    })
    setShowEditModal(true)
  }

  const handleDelete = (patientId) => {
    setConfirmModal({
      isOpen: true,
      title: '환자 삭제',
      message: '이 환자를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.',
      onConfirm: async () => {
        try {
          await petService.deletePet(patientId)
          setAlertModal({ isOpen: true, title: '삭제 완료', message: '환자가 삭제되었습니다.' })
          loadData()
        } catch (error) {
          setAlertModal({ isOpen: true, title: '오류', message: error.message || '환자 삭제에 실패했습니다.' })
        }
      }
    })
  }

  const handleDischarge = async (patientId) => {
    setConfirmModal({
      isOpen: true,
      title: '퇴원 처리',
      message: '이 환자를 퇴원 처리하시겠습니까?',
      onConfirm: async () => {
        try {
          await petService.updatePet(patientId, { state: '퇴원' })
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
        gender: '수컷',
        neutering: '여',
        birthDate: '2020-01-01',
        admissionDate: new Date().toISOString().split('T')[0],
        veterinarian: '',
        diagnosis: '',
        medicalHistory: '',
        device_address: '',
        state: '입원중'
      })
      loadData()
    } catch (error) {
      setAlertModal({ isOpen: true, title: '오류', message: error.message || '환자 등록에 실패했습니다.' })
    }
  }

  const handleEditSubmit = async (e) => {
    e.preventDefault()
    try {
      // state 필드는 제외하고 수정 (state는 퇴원 버튼으로만 변경 가능)
      const { state, ...updateData } = formData
      await petService.updatePet(editingPatient.id, updateData)
      setAlertModal({ isOpen: true, title: '수정 완료', message: '환자 정보가 수정되었습니다.' })
      setShowEditModal(false)
      setEditingPatient(null)
      setFormData({
        name: '',
        species: '',
        breed: '',
        weight: '',
        gender: '수컷',
        neutering: '여',
        birthDate: '2020-01-01',
        admissionDate: new Date().toISOString().split('T')[0],
        veterinarian: '',
        diagnosis: '',
        medicalHistory: '',
        device_address: '',
        state: '입원중'
      })
      loadData()
    } catch (error) {
      setAlertModal({ isOpen: true, title: '오류', message: error.message || '환자 수정에 실패했습니다.' })
    }
  }

  // 가용 디바이스 목록 (연결되지 않은 디바이스)
  const availableDevices = devices.filter(d =>
    d.status === 'connected' && !d.connectedPatient
  )
  
  // 모든 디바이스 목록 (연결된 디바이스 포함, 환자 정보 포함)
  const allDevicesWithPatients = devices.map(device => {
    const connectedPatient = patients.find(p => p.device_address === device.address)
    return {
      ...device,
      connectedPatientName: connectedPatient?.name || null
    }
  })

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

  // 취소 핸들러
  const handleCancel = () => {
    if (showEditModal) {
      setShowEditModal(false)
      setEditingPatient(null)
    } else {
      setShowAddModal(false)
    }
    setFormData({
      name: '',
      species: '',
      breed: '',
      weight: '',
      gender: '수컷',
      neutering: '여',
      birthDate: '2020-01-01',
      admissionDate: new Date().toISOString().split('T')[0],
      veterinarian: '',
      diagnosis: '',
      medicalHistory: '',
      device_address: '',
      state: '입원중'
    })
  }

  return (
    <div className="patients-page">
      <Header />
      <div className="patients-container">
        <div className="patients-header">
          <button className="btn-primary" onClick={() => {
            setFormData({
              name: '',
              species: '',
              breed: '',
              weight: '',
              gender: '수컷',
              neutering: '여',
              birthDate: '2020-01-01',
              admissionDate: new Date().toISOString().split('T')[0],
              veterinarian: '',
              diagnosis: '',
              medicalHistory: '',
              device_address: '',
              state: '입원중'
            })
            setShowAddModal(true)
          }}>
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
                <button
                  className="btn-primary"
                  onClick={() => handleEdit(patient)}
                >
                  정보 수정
                </button>
                {patient.connectedDevice && (
                  <>
                    <button
                      className="btn-secondary"
                      onClick={() => setDeviceSelectModal({ isOpen: true, patientId: patient.id, isChange: true })}
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
                    className="btn-secondary"
                    onClick={() => handleDischarge(patient.id)}
                  >
                    퇴원 처리
                  </button>
                )}
                <button
                  className="btn-danger"
                  onClick={() => handleDelete(patient.id)}
                >
                  환자 삭제
                </button>
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
              <PatientForm
                formData={formData}
                setFormData={setFormData}
                onSubmit={handleSubmit}
                isEdit={false}
                today={today}
                availableDevices={availableDevices}
                onCancel={handleCancel}
              />
            </div>
          </div>
        </div>
      )}

      {/* 환자 수정 모달 */}
      {showEditModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>환자 정보 수정</h3>
              <button onClick={() => setShowEditModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <PatientForm
                formData={formData}
                setFormData={setFormData}
                onSubmit={handleEditSubmit}
                isEdit={true}
                today={today}
                availableDevices={availableDevices}
                onCancel={handleCancel}
              />
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

      {/* 디바이스 선택 모달 (연결용) */}
      {deviceSelectModal.isOpen && !deviceSelectModal.isChange && (
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
                      {device.name}
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

      {/* 디바이스 변경 모달 */}
      {deviceSelectModal.isOpen && deviceSelectModal.isChange && (
        <div className="modal-overlay" onClick={() => setDeviceSelectModal({ isOpen: false, patientId: null, isChange: false })}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>디바이스 변경</h3>
              <button onClick={() => setDeviceSelectModal({ isOpen: false, patientId: null, isChange: false })}>×</button>
            </div>
            <div className="modal-body">
              {allDevicesWithPatients.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {allDevicesWithPatients.map(device => {
                    const isConnected = !!device.connectedPatient
                    const displayName = device.connectedPatientName 
                      ? `${device.name} (${device.connectedPatientName})`
                      : device.name
                    
                    return (
                      <button
                        key={device.address}
                        className={isConnected ? "btn-secondary" : "btn-secondary"}
                        style={{ 
                          width: '100%', 
                          textAlign: 'left', 
                          padding: '0.75rem',
                          opacity: isConnected ? 0.5 : 1,
                          cursor: isConnected ? 'not-allowed' : 'pointer'
                        }}
                        disabled={isConnected}
                        onClick={() => {
                          if (!isConnected) {
                            handleDeviceChange(deviceSelectModal.patientId, device.address);
                            setDeviceSelectModal({ isOpen: false, patientId: null, isChange: false });
                          }
                        }}
                      >
                        {displayName}
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div>사용 가능한 디바이스가 없습니다.</div>
              )}
            </div>
            <div className="modal-footer">
              <button
                className="btn-secondary"
                onClick={() => setDeviceSelectModal({ isOpen: false, patientId: null, isChange: false })}
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
