import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '../stores/useAuthStore'
import './Login.css'

const LOGIN_MODE = { USER: 'user', ADMIN: 'admin' }

function Login() {
  const navigate = useNavigate()
  const { login, loginStatus, loginError, logout } = useAuthStore()

  const [loginMode, setLoginMode] = useState(LOGIN_MODE.USER)
  const [adminDenied, setAdminDenied] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setAdminDenied(false)

    const result = await login(formData.email, formData.password)

    if (result.success) {
      if (loginMode === LOGIN_MODE.ADMIN) {
        if (result.user?.role !== 'admin') {
          logout()
          setAdminDenied(true)
          return
        }
        navigate('/admin/system-logs')
        return
      }
      // 사용자 로그인: 첫 로그인 여부 확인
      let isFirstLogin = null
      try {
        isFirstLogin = localStorage.getItem(`first_login_${result.user?.email}`)
        console.log('[Login] First login flag:', isFirstLogin, 'for user:', result.user?.email)
      } catch (error) {
        console.error('[Login] Failed to check first login flag:', error)
        isFirstLogin = null
      }
      if (isFirstLogin === 'true') {
        setTimeout(() => navigate('/guide'), 100)
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
    <div className="login-view">
      <div className="login-container">
        <div className="login-logo">
          <h1>생체 모니터링 시스템</h1>
        </div>
        <div className="login-mode-tabs">
          <button
            type="button"
            className={`login-mode-tab ${loginMode === LOGIN_MODE.USER ? 'active' : ''}`}
            onClick={() => { setLoginMode(LOGIN_MODE.USER); setAdminDenied(false); }}
          >
            사용자 로그인
          </button>
          <button
            type="button"
            className={`login-mode-tab ${loginMode === LOGIN_MODE.ADMIN ? 'active' : ''}`}
            onClick={() => { setLoginMode(LOGIN_MODE.ADMIN); setAdminDenied(false); }}
          >
            어드민 로그인
          </button>
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
          {(loginError || adminDenied) && (
            <div className="error-message">
              {adminDenied ? '관리자 계정이 아닙니다.' : loginError}
            </div>
          )}
          <button type="submit" className="btn-login" disabled={loginStatus === 'loading'}>
            {loginStatus === 'loading' ? '로그인 중...' : '로그인'}
          </button>
          {loginMode === LOGIN_MODE.USER && (
            <div className="login-footer">
              <span>계정이 없으신가요? </span>
              <Link to="/register">회원가입</Link>
            </div>
          )}
        </form>
      </div>
      <div className="login-page" aria-hidden="true" />
    </div>
  )
}

export default Login

