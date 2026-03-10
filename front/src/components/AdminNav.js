import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../stores/useAuthStore';
import './AdminNav.css';

export default function AdminNav() {
  const navigate = useNavigate();
  const { logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="admin-nav">
      <div className="admin-nav__inner">
        <Link to="/admin/system-logs" className="admin-nav__logo">
          <img src="/images/logo.png" alt="Talktail" className="admin-nav__logo-img" />
        </Link>
        <button type="button" onClick={handleLogout} className="admin-nav__logout">
          로그아웃
        </button>
      </div>
    </header>
  );
}
