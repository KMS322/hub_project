import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../stores/useAuthStore'
import './Header.css'

function Header() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, isAuthenticated, logout } = useAuthStore()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  if (!isAuthenticated) {
    return null
  }

  const isActive = (path) => {
    return location.pathname === path
  }

  return (
    <header className="header">
      <div className="header-container">
        <div className="header-logo">
          <Link to="/dashboard" className="logo-link">
            <img src="/logo.png" alt="로고" className="logo-image" />
          </Link>
        </div>
        <nav className="header-nav">
          <Link 
            to="/dashboard" 
            className={`nav-link ${isActive('/dashboard') ? 'active' : ''}`}
          >
            대시보드
          </Link>
          <Link 
            to="/hardware" 
            className={`nav-link ${isActive('/hardware') ? 'active' : ''}`}
          >
            하드웨어 관리
          </Link>
          <Link 
            to="/patients" 
            className={`nav-link ${isActive('/patients') ? 'active' : ''}`}
          >
            환자 관리
          </Link>
          <Link 
            to="/records" 
            className={`nav-link ${isActive('/records') ? 'active' : ''}`}
          >
            기록 관리
          </Link>
          {process.env.NODE_ENV === 'development' && (
            <>
              <Link
                to="/signal-processing-test"
                className={`nav-link ${isActive('/signal-processing-test') ? 'active' : ''}`}
              >
                신호처리 테스트
              </Link>
            </>
          )}
        </nav>
        <div className="header-actions">
          <span className="hospital-name">{user?.name || '병원명'}</span>
          <Link
            to="/profile"
            className={`nav-link ${isActive('/profile') ? 'active' : ''}`}
          >
            내정보
          </Link>
          <button onClick={handleLogout} className="logout-btn">로그아웃</button>
        </div>
      </div>
    </header>
  )
}

export default Header

