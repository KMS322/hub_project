import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '../stores/useAuthStore'
import { validateRegisterForm } from '../utils/validation'
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
  const [phoneParts, setPhoneParts] = useState({
    part1: '', // 3자리 (02, 031 등)
    part2: '', // 3-4자리
    part3: ''  // 4자리
  })
  const [validationError, setValidationError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})

  const handleSubmit = async (e) => {
    e.preventDefault()
    setValidationError('')
    setFieldErrors({})

    // 비밀번호 확인 검증
    if (formData.password !== formData.passwordConfirm) {
      setValidationError('비밀번호가 일치하지 않습니다.')
      return
    }

    // 폼 데이터 검증
    const validation = validateRegisterForm(formData)
    if (!validation.valid) {
      setFieldErrors(validation.errors)
      setValidationError('입력한 정보를 확인해주세요.')
      return
    }

    const result = await register(formData)

    if (result.success) {
      console.log('회원가입 성공:', result.user)
      // 첫 로그인 플래그 설정
      if (result.user?.email) {
        localStorage.setItem(`first_login_${result.user.email}`, 'true')
        console.log('[Register] First login flag set for:', result.user.email)
        // user 정보가 store에 반영될 시간을 주기 위해 약간의 지연
        setTimeout(() => {
          navigate('/guide')
        }, 100)
      } else {
        navigate('/dashboard')
      }
    }
  }

  const handleChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setFormData({
      ...formData,
      [e.target.name]: value
    })
  }

  // 전화번호 파트별 입력 처리
  const handlePhonePartChange = (part, value) => {
    // 숫자만 허용
    const numericValue = value.replace(/\D/g, '')
    
    let newPhoneParts = { ...phoneParts }
    
    if (part === 'part1') {
      // 첫 번째 파트: 최대 3자리
      newPhoneParts.part1 = numericValue.slice(0, 3)
      // 3자리 입력 시 다음 필드로 포커스 이동
      if (numericValue.length === 3) {
        setTimeout(() => {
          document.getElementById('phone-part2')?.focus()
        }, 0)
      }
    } else if (part === 'part2') {
      // 두 번째 파트: 최대 4자리
      newPhoneParts.part2 = numericValue.slice(0, 4)
      // 4자리 입력 시 다음 필드로 포커스 이동
      if (numericValue.length === 4) {
        setTimeout(() => {
          document.getElementById('phone-part3')?.focus()
        }, 0)
      }
    } else if (part === 'part3') {
      // 세 번째 파트: 최대 4자리
      newPhoneParts.part3 = numericValue.slice(0, 4)
    }
    
    setPhoneParts(newPhoneParts)
    
    // 전체 전화번호 조합 (하이픈 포함)
    const fullPhone = `${newPhoneParts.part1}${newPhoneParts.part2 ? '-' + newPhoneParts.part2 : ''}${newPhoneParts.part3 ? '-' + newPhoneParts.part3 : ''}`
    setFormData({
      ...formData,
      phone: fullPhone
    })
  }

  // 전화번호 파트별 백스페이스 처리
  const handlePhonePartKeyDown = (part, e) => {
    if (e.key === 'Backspace') {
      const currentValue = phoneParts[part]
      if (currentValue === '' && part === 'part2') {
        // 두 번째 필드가 비어있으면 첫 번째 필드로 포커스 이동
        e.preventDefault()
        document.getElementById('phone-part1')?.focus()
      } else if (currentValue === '' && part === 'part3') {
        // 세 번째 필드가 비어있으면 두 번째 필드로 포커스 이동
        e.preventDefault()
        document.getElementById('phone-part2')?.focus()
      }
    }
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
                placeholder="병원명을 입력하세요 (2-50자)"
                className={fieldErrors.name ? 'error' : ''}
              />
              {fieldErrors.name && <span className="field-error">{fieldErrors.name}</span>}
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
                placeholder="우편번호를 입력하세요 (예: 12345)"
                maxLength={5}
                className={fieldErrors.postcode ? 'error' : ''}
              />
              {fieldErrors.postcode && <span className="field-error">{fieldErrors.postcode}</span>}
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
                className={fieldErrors.address ? 'error' : ''}
              />
              {fieldErrors.address && <span className="field-error">{fieldErrors.address}</span>}
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
                className={fieldErrors.detail_address ? 'error' : ''}
              />
              {fieldErrors.detail_address && <span className="field-error">{fieldErrors.detail_address}</span>}
            </div>
            <div className="form-group">
              <label htmlFor="phone">병원 전화번호</label>
              <div className="phone-input-group">
                <input
                  type="tel"
                  id="phone-part1"
                  value={phoneParts.part1}
                  onChange={(e) => handlePhonePartChange('part1', e.target.value)}
                  onKeyDown={(e) => handlePhonePartKeyDown('part1', e)}
                  required
                  placeholder="02"
                  maxLength={3}
                  className={fieldErrors.phone ? 'error' : ''}
                  style={{ width: '80px', textAlign: 'center' }}
                />
                <span className="phone-separator">-</span>
                <input
                  type="tel"
                  id="phone-part2"
                  value={phoneParts.part2}
                  onChange={(e) => handlePhonePartChange('part2', e.target.value)}
                  onKeyDown={(e) => handlePhonePartKeyDown('part2', e)}
                  required
                  placeholder="1234"
                  maxLength={4}
                  className={fieldErrors.phone ? 'error' : ''}
                  style={{ width: '100px', textAlign: 'center' }}
                />
                <span className="phone-separator">-</span>
                <input
                  type="tel"
                  id="phone-part3"
                  value={phoneParts.part3}
                  onChange={(e) => handlePhonePartChange('part3', e.target.value)}
                  onKeyDown={(e) => handlePhonePartKeyDown('part3', e)}
                  required
                  placeholder="5678"
                  maxLength={4}
                  className={fieldErrors.phone ? 'error' : ''}
                  style={{ width: '100px', textAlign: 'center' }}
                />
              </div>
              {fieldErrors.phone && <span className="field-error">{fieldErrors.phone}</span>}
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

