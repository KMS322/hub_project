import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '../stores/useAuthStore'
import './Login.css'

function Login() {
  const navigate = useNavigate()
  const { login, loginStatus, loginError } = useAuthStore()

  const [formData, setFormData] = useState({
    email: '',
    password: ''
  })

  const handleSubmit = async (e) => {
    e.preventDefault()

    const result = await login(formData.email, formData.password)

    if (result.success) {
      console.log('로그인 성공:', result.user)
      // 첫 로그인 여부 확인
      const isFirstLogin = localStorage.getItem(`first_login_${result.user?.email}`)
      console.log('[Login] First login flag:', isFirstLogin, 'for user:', result.user?.email)
      if (isFirstLogin === 'true') {
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
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-logo">
          <h1>생체 모니터링 시스템</h1>
        </div>
        <form onSubmit={handleSubmit} className="login-form">
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
          {loginError && <div className="error-message">{loginError}</div>}
          <button type="submit" className="btn-login" disabled={loginStatus === 'loading'}>
            {loginStatus === 'loading' ? '로그인 중...' : '로그인'}
          </button>
          <div className="login-footer">
            <span>계정이 없으신가요? </span>
            <Link to="/register">회원가입</Link>
          </div>
        </form>
      </div>
    </div>
  )
}

export default Login

