import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../stores/useAuthStore";
import "./Header.css";

function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, logout } = useAuthStore();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
    setIsMobileMenuOpen(false);
  };

  const handleNavClick = () => {
    setIsMobileMenuOpen(false);
  };

  // 메뉴 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        isMobileMenuOpen &&
        !event.target.closest(".mobile-menu") &&
        !event.target.closest(".hamburger-btn")
      ) {
        setIsMobileMenuOpen(false);
      }
    };

    if (isMobileMenuOpen) {
      document.addEventListener("click", handleClickOutside);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.removeEventListener("click", handleClickOutside);
      document.body.style.overflow = "";
    };
  }, [isMobileMenuOpen]);

  // 라우트 변경 시 메뉴 닫기
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  if (!isAuthenticated) {
    return null;
  }

  const isActive = (path) => {
    return location.pathname === path;
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <header className="header">
      <div className="header-container">
        <div className="header-logo">
          <Link to="/dashboard" className="logo-link" onClick={handleNavClick}>
            <img src="/images/logo.png" alt="Talktail" className="logo-image" />
          </Link>
        </div>
        <nav className="header-nav">
          <Link
            to="/dashboard"
            className={`nav-link ${isActive("/dashboard") ? "active" : ""}`}
          >
            대시보드
          </Link>
          <Link
            to="/hardware"
            className={`nav-link ${isActive("/hardware") ? "active" : ""}`}
          >
            하드웨어 관리
          </Link>
          <Link
            to="/patients"
            className={`nav-link ${isActive("/patients") ? "active" : ""}`}
          >
            환자 관리
          </Link>
          <Link
            to="/records"
            className={`nav-link ${isActive("/records") ? "active" : ""}`}
          >
            기록 관리
          </Link>
          <Link
            to="/hrv-analysis"
            className={`nav-link ${isActive("/hrv-analysis") ? "active" : ""}`}
          >
            HRV 분석
          </Link>
        </nav>
        <div className="header-actions">
          <span className="hospital-name">{user?.name || "병원명"}</span>
          <Link
            to="/profile"
            className={`nav-link ${isActive("/profile") ? "active" : ""}`}
          >
            내정보
          </Link>
          <button onClick={handleLogout} className="logout-btn">
            로그아웃
          </button>
        </div>
        {/* 햄버거 메뉴 버튼 (모바일 전용) - 메뉴가 열려있을 때는 숨김 */}
        {!isMobileMenuOpen && (
          <button
            className="hamburger-btn"
            onClick={toggleMobileMenu}
            aria-label="메뉴 열기"
            aria-expanded={false}
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
        )}
      </div>
      {/* 모바일 메뉴 오버레이 */}
      {isMobileMenuOpen && (
        <div className="mobile-menu-overlay" onClick={handleNavClick}></div>
      )}
      {/* 모바일 메뉴 */}
      <nav className={`mobile-menu ${isMobileMenuOpen ? "open" : ""}`}>
        <div className="mobile-menu-header">
          <span className="mobile-menu-title">메뉴</span>
          <button
            className="mobile-menu-close"
            onClick={toggleMobileMenu}
            aria-label="메뉴 닫기"
          >
            ✕
          </button>
        </div>
        <div className="mobile-menu-content">
          <Link
            to="/dashboard"
            className={`mobile-nav-link ${isActive("/dashboard") ? "active" : ""}`}
            onClick={handleNavClick}
          >
            대시보드
          </Link>
          <Link
            to="/hardware"
            className={`mobile-nav-link ${isActive("/hardware") ? "active" : ""}`}
            onClick={handleNavClick}
          >
            하드웨어 관리
          </Link>
          <Link
            to="/patients"
            className={`mobile-nav-link ${isActive("/patients") ? "active" : ""}`}
            onClick={handleNavClick}
          >
            환자 관리
          </Link>
          <Link
            to="/records"
            className={`mobile-nav-link ${isActive("/records") ? "active" : ""}`}
            onClick={handleNavClick}
          >
            기록 관리
          </Link>
          <Link
            to="/hrv-analysis"
            className={`mobile-nav-link ${isActive("/hrv-analysis") ? "active" : ""}`}
            onClick={handleNavClick}
          >
            HRV 분석
          </Link>
          <div className="mobile-menu-divider"></div>
          <div className="mobile-menu-user">
            <span className="mobile-hospital-name">{user?.name || "병원명"}</span>
          </div>
          <Link
            to="/profile"
            className={`mobile-nav-link ${isActive("/profile") ? "active" : ""}`}
            onClick={handleNavClick}
          >
            내정보
          </Link>
          <button onClick={handleLogout} className="mobile-logout-btn">
            로그아웃
          </button>
        </div>
      </nav>
    </header>
  );
}

export default Header;
