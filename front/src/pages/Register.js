import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '../stores/useAuthStore'
import './Register.css'

function Register() {
  const navigate = useNavigate()
  const { register, registerStatus, registerError } = useAuthStore()

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    passwordConfirm: '',
    name: '',
    postcode: '',
    address: '',
    detail_address: '',
    phone: ''
  })
  const [validationError, setValidationError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setValidationError('')

    // 비밀번호 확인 검증
    if (formData.password !== formData.passwordConfirm) {
      setValidationError('비밀번호가 일치하지 않습니다.')
      return
    }

    const result = await register(formData)

    if (result.success) {
      console.log('회원가입 성공:', result.user)
      navigate('/dashboard')
    }
  }

  const handleChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setFormData({
      ...formData,
      [e.target.name]: value
    })
  }

  return (
    <div className="register-page">
      <div className="register-container">
        <div className="register-header">
          <h1>회원가입</h1>
        </div>
        <form onSubmit={handleSubmit} className="register-form">
          <div className="form-section">
            <h3>계정 정보</h3>
            <div className="form-group">
              <label htmlFor="email">이메일</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                placeholder="이메일을 입력하세요"
              />
            </div>
            <div className="form-group">
              <label htmlFor="password">비밀번호</label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                placeholder="비밀번호를 입력하세요"
              />
            </div>
            <div className="form-group">
              <label htmlFor="passwordConfirm">비밀번호 확인</label>
              <input
                type="password"
                id="passwordConfirm"
                name="passwordConfirm"
                value={formData.passwordConfirm}
                onChange={handleChange}
                required
                placeholder="비밀번호를 다시 입력하세요"
              />
            </div>
          </div>

          <div className="form-section">
            <h3>병원 정보</h3>
            <div className="form-group">
              <label htmlFor="name">병원명</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                placeholder="병원명을 입력하세요"
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
                placeholder="우편번호를 입력하세요"
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
                placeholder="주소를 입력하세요"
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
                placeholder="상세주소를 입력하세요"
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
                placeholder="병원 전화번호를 입력하세요"
              />
            </div>
          </div>

          {(validationError || registerError) && (
            <div className="error-message">{validationError || registerError}</div>
          )}
          <button type="submit" className="btn-register" disabled={registerStatus === 'loading'}>
            {registerStatus === 'loading' ? '회원가입 중...' : '회원가입'}
          </button>
          <div className="register-footer">
            <span>이미 계정이 있으신가요? </span>
            <Link to="/login">로그인</Link>
          </div>
        </form>
      </div>
    </div>
  )
}

export default Register

