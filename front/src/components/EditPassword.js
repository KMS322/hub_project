import { useState } from 'react'
import authService from '../api/authService'
import AlertModal from './AlertModal'
import './EditPassword.css'

function EditPassword() {
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  const [alertModal, setAlertModal] = useState({ isOpen: false, title: '', message: '' })

  const handleChange = (e) => {
    setPasswordData({
      ...passwordData,
      [e.target.name]: e.target.value
    })
  }

  const handleEditToggle = () => {
    if (isEditing) {
      // 편집 취소 시 입력 필드 초기화
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      })
    }
    setIsEditing(!isEditing)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!isEditing) {
      // 수정 모드로 전환
      setIsEditing(true)
      return
    }

    // 비밀번호 확인 검증
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setAlertModal({
        isOpen: true,
        title: '오류',
        message: '새 비밀번호가 일치하지 않습니다.'
      })
      return
    }

    // 비밀번호 길이 검증
    if (passwordData.newPassword.length < 4) {
      setAlertModal({
        isOpen: true,
        title: '오류',
        message: '비밀번호는 최소 4자 이상이어야 합니다.'
      })
      return
    }

    setLoading(true)

    try {
      await authService.updatePassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      })

      setAlertModal({
        isOpen: true,
        title: '변경 완료',
        message: '비밀번호가 변경되었습니다.'
      })

      // 입력 필드 초기화 및 읽기 모드로 전환
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      })
      setIsEditing(false)
    } catch (error) {
      setAlertModal({
        isOpen: true,
        title: '오류',
        message: error.message || '비밀번호 변경에 실패했습니다.'
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="edit-password">
      <form onSubmit={handleSubmit} className="password-form">
        <div className="form-section">
          <h2>비밀번호 변경</h2>

          {isEditing && (
            <>
              <div className="form-group">
                <label htmlFor="currentPassword">현재 비밀번호</label>
                <input
                  type="password"
                  id="currentPassword"
                  name="currentPassword"
                  value={passwordData.currentPassword}
                  onChange={handleChange}
                  required
                  autoComplete="current-password"
                />
              </div>
              <div className="form-group">
                <label htmlFor="newPassword">새 비밀번호</label>
                <input
                  type="password"
                  id="newPassword"
                  name="newPassword"
                  value={passwordData.newPassword}
                  onChange={handleChange}
                  required
                  autoComplete="new-password"
                />
              </div>
              <div className="form-group">
                <label htmlFor="confirmPassword">새 비밀번호 확인</label>
                <input
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  value={passwordData.confirmPassword}
                  onChange={handleChange}
                  required
                  autoComplete="new-password"
                />
              </div>
            </>
          )}
        </div>

        <div className="form-actions">
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? '변경 중...' : (isEditing ? '비밀번호 저장' : '비밀번호 변경')}
          </button>
          {isEditing && (
            <button type="button" className="btn-secondary" onClick={handleEditToggle}>
              취소
            </button>
          )}
        </div>
      </form>

      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={() => setAlertModal({ isOpen: false, title: '', message: '' })}
        title={alertModal.title}
        message={alertModal.message}
      />
    </div>
  )
}

export default EditPassword
