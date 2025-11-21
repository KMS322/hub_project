import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/useAuthStore'
import Header from '../components/Header'
import AlertModal from '../components/AlertModal'
import ConfirmModal from '../components/ConfirmModal'
import './Profile.css'

function Profile() {
  const navigate = useNavigate()
  const { user, updateUser, logout } = useAuthStore()

  const [formData, setFormData] = useState({
    email: '',
    name: '',
    postcode: '',
    address: '',
    detail_address: '',
    phone: ''
  })

  useEffect(() => {
    if (user) {
      setFormData({
        email: user.email || '',
        name: user.name || '',
        postcode: user.postcode || '',
        address: user.address || '',
        detail_address: user.detail_address || '',
        phone: user.phone || ''
      })
    }
  }, [user])
  const [alertModal, setAlertModal] = useState({ isOpen: false, title: '', message: '' })
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null })

  const handleChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setFormData({
      ...formData,
      [e.target.name]: value
    })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    // TODO: 실제 API 호출로 교체
    updateUser({
      name: formData.name,
      postcode: formData.postcode,
      address: formData.address,
      detail_address: formData.detail_address,
      phone: formData.phone
    })
    setAlertModal({ isOpen: true, title: '수정 완료', message: '정보가 수정되었습니다.' })
  }

  const handleWithdraw = () => {
    setConfirmModal({
      isOpen: true,
      title: '회원 탈퇴',
      message: '정말 탈퇴하시겠습니까? 모든 데이터가 삭제됩니다.',
      onConfirm: () => {
        // TODO: 실제 API 호출로 교체
        logout()
        navigate('/login')
      }
    })
  }

  return (
    <div className="profile-page">
      <Header />
      <div className="profile-container">
        <form onSubmit={handleSubmit} className="profile-form">
          <div className="form-section">
            <h2>계정 정보</h2>
            <div className="form-group">
              <label htmlFor="email">이메일</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                disabled
                className="disabled-input"
              />
              <span className="help-text">이메일은 변경할 수 없습니다.</span>
            </div>
          </div>

          <div className="form-section">
            <h2>병원 정보</h2>
            <div className="form-group">
              <label htmlFor="name">병원명</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="postcode">우편번호</label>
              <input
                type="text"
                id="postcode"
                name="postcode"
                value={formData.postcode}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="address">주소</label>
              <input
                type="text"
                id="address"
                name="address"
                value={formData.address}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="detail_address">상세주소</label>
              <input
                type="text"
                id="detail_address"
                name="detail_address"
                value={formData.detail_address}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="phone">병원 전화번호</label>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn-primary">정보 수정</button>
            <button type="button" className="btn-danger" onClick={handleWithdraw}>
              회원 탈퇴
            </button>
          </div>
        </form>
      </div>

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

export default Profile

