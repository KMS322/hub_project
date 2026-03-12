import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation
} from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useAuthStore } from './stores/useAuthStore'
import hubService from './api/hubService'
import deviceService from './api/deviceService'
import ConfirmModal from './components/ConfirmModal'
import { ToastContainer } from './components/ToastContainer'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Hardware from './pages/Hardware'
import Patients from './pages/Patients'
import Records from './pages/Records'
import Profile from './pages/Profile'
import Monitoring from './pages/Monitoring'
import Guide from './pages/Guide'
import SerialMonitor from './pages/SerialMonitor'
import HardwareErrorTest from './pages/HardwareErrorTest'
import HrvAnalysis from './pages/HrvAnalysis'
import AdminSystemLogs from './pages/AdminSystemLogs'
import AdminSystemHealth from './pages/AdminSystemHealth'
import AdminCsvFiles from './pages/AdminCsvFiles'
import AdminConnectionMonitor from './pages/AdminConnectionMonitor'
import GlobalErrorModal from './components/GlobalErrorModal'
import './App.css'

// 처음 접속 시 로그인(사용자/어드민 선택) 없이 대시보드 등으로 진입 허용. .env에 VITE_GUEST_ACCESS=true 설정 시 사용.
const GUEST_ACCESS = import.meta.env.VITE_GUEST_ACCESS === 'true'

function AppContent() {
  const navigate = useNavigate()
  const location = useLocation()

  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const userRole = useAuthStore((state) => state.user?.role)
  const isAdmin = userRole === 'admin'
  const canAccessWithoutLogin = GUEST_ACCESS && !isAuthenticated

  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onNavigate: null
  })

  const [checkCompleted, setCheckCompleted] = useState(false)

  // 하드웨어 체크를 수행할 경로 (하드웨어관리, 대시보드, 모니터링만)
  const HARDWARE_CHECK_PATHS = new Set([
    '/hardware',
    '/dashboard'
  ])
  
  // 모니터링 페이지 체크 (동적 경로)
  const isMonitoringPage = location.pathname.startsWith('/monitoring/')

  // 하드웨어 체크 제외 경로
  const HARDWARE_CHECK_EXCLUDE_PATHS = new Set([
    '/guide'
  ])

  // 경로가 변경될 때 처리
  useEffect(() => {
    // Guide 페이지로 이동하면 모달 닫기
    if (HARDWARE_CHECK_EXCLUDE_PATHS.has(location.pathname)) {
      setConfirmModal({
        isOpen: false,
        title: '',
        message: '',
        onNavigate: null
      })
      setCheckCompleted(true)
    } else {
      // 하드웨어 체크가 필요한 페이지로 이동하면 체크 상태 리셋
      if (HARDWARE_CHECK_PATHS.has(location.pathname) || isMonitoringPage) {
        setCheckCompleted(false)
      } else {
        // 다른 페이지로 이동하면 체크 완료 상태로 설정 (체크하지 않음)
        setCheckCompleted(true)
      }
    }
  }, [location.pathname, isMonitoringPage])

  useEffect(() => {
    const checkHardware = async () => {
      if (!isAuthenticated) return
      if (checkCompleted) return
      // 어드민은 본인 소유 허브/디바이스 체크 생략 (어드민 페이지에서 전체 데이터 조회)
      if (isAdmin) {
        setCheckCompleted(true)
        return
      }
      if (HARDWARE_CHECK_EXCLUDE_PATHS.has(location.pathname)) {
        // Guide 페이지에서는 체크를 완료 상태로 설정 (체크하지 않음)
        setCheckCompleted(true)
        return
      }
      
      // 하드웨어 체크가 필요한 페이지에서만 체크 수행
      const shouldCheck = HARDWARE_CHECK_PATHS.has(location.pathname) || isMonitoringPage
      if (!shouldCheck) {
        setCheckCompleted(true)
        return
      }

      try {
        const [hubs, devices] = await Promise.all([
          hubService.getHubs(),
          deviceService.getDevices()
        ])

        if (hubs.length === 0) {
          setConfirmModal({
            isOpen: true,
            title: '허브 등록 필요',
            message: '허브를 등록해주세요.',
            onNavigate: '/hardware'
          })
          setCheckCompleted(true)
          return
        }

        if (devices.length === 0) {
          setConfirmModal({
            isOpen: true,
            title: '디바이스 등록 필요',
            message: '디바이스를 등록해주세요.',
            onNavigate: '/hardware'
          })
          setCheckCompleted(true)
          return
        }

        setCheckCompleted(true)
      } catch (error) {
        console.error('Hardware check failed:', error)
        setCheckCompleted(true)
      }
    }

    checkHardware()
  }, [isAuthenticated, isAdmin, checkCompleted, location.pathname, isMonitoringPage])

  const handleModalClose = () => {
    setConfirmModal({
      isOpen: false,
      title: '',
      message: '',
      onNavigate: null
    })
  }

  const handleModalConfirm = () => {
    const navigateTo = confirmModal.onNavigate
    handleModalClose()
    if (navigateTo) {
      navigate(navigateTo)
    }
  }

  return (
    <div className="App">
      <Routes>
        <Route
          path="/login"
          element={
            isAuthenticated && isAdmin ? <Navigate to="/admin/system-logs" replace /> : <Login />
          }
        />
        <Route path="/register" element={<Register />} />

        {/* 사용자 전용: 관리자면 어드민으로 리다이렉트 */}
        <Route
          path="/dashboard"
          element={
            (canAccessWithoutLogin || isAuthenticated) ? (isAdmin ? <Navigate to="/admin/system-logs" replace /> : <Dashboard />) : <Navigate to="/login" />
          }
        />
        <Route
          path="/hardware"
          element={
            (canAccessWithoutLogin || isAuthenticated) ? (isAdmin ? <Navigate to="/admin/system-logs" replace /> : <Hardware />) : <Navigate to="/login" />
          }
        />
        <Route
          path="/patients"
          element={
            (canAccessWithoutLogin || isAuthenticated) ? (isAdmin ? <Navigate to="/admin/system-logs" replace /> : <Patients />) : <Navigate to="/login" />
          }
        />
        <Route
          path="/records"
          element={
            (canAccessWithoutLogin || isAuthenticated) ? (isAdmin ? <Navigate to="/admin/system-logs" replace /> : <Records />) : <Navigate to="/login" />
          }
        />
        <Route
          path="/hrv-analysis"
          element={
            (canAccessWithoutLogin || isAuthenticated) ? (isAdmin ? <Navigate to="/admin/system-logs" replace /> : <HrvAnalysis />) : <Navigate to="/login" />
          }
        />
        <Route
          path="/profile"
          element={
            (canAccessWithoutLogin || isAuthenticated) ? (isAdmin ? <Navigate to="/admin/system-logs" replace /> : <Profile />) : <Navigate to="/login" />
          }
        />
        <Route
          path="/monitoring/:patientId"
          element={
            (canAccessWithoutLogin || isAuthenticated) ? (isAdmin ? <Navigate to="/admin/system-logs" replace /> : <Monitoring />) : <Navigate to="/login" />
          }
        />

        <Route
          path="/guide"
          element={
            isAuthenticated && isAdmin ? <Navigate to="/admin/system-logs" replace /> : <Guide />
          }
        />

        <Route
          path="/serial-monitor"
          element={
            (canAccessWithoutLogin || isAuthenticated) ? (isAdmin ? <Navigate to="/admin/system-logs" replace /> : <SerialMonitor />) : <Navigate to="/login" />
          }
        />
        <Route
          path="/hardware-error-test"
          element={
            (canAccessWithoutLogin || isAuthenticated) ? (isAdmin ? <Navigate to="/admin/system-logs" replace /> : <HardwareErrorTest />) : <Navigate to="/login" />
          }
        />
        <Route
          path="/admin/system-logs"
          element={
            !isAuthenticated ? <Navigate to="/login" /> :
            !isAdmin ? <Navigate to="/dashboard" /> :
            <AdminSystemLogs />
          }
        />
        <Route
          path="/admin/system-health"
          element={
            !isAuthenticated ? <Navigate to="/login" /> :
            !isAdmin ? <Navigate to="/dashboard" /> :
            <AdminSystemHealth />
          }
        />
        <Route
          path="/admin/csv-files"
          element={
            !isAuthenticated ? <Navigate to="/login" /> :
            !isAdmin ? <Navigate to="/dashboard" /> :
            <AdminCsvFiles />
          }
        />
        <Route
          path="/admin/connection-status"
          element={
            !isAuthenticated ? <Navigate to="/login" /> :
            !isAdmin ? <Navigate to="/dashboard" /> :
            <AdminConnectionMonitor />
          }
        />

        {/* 루트: 게스트 접속 허용 시 로그인 없이 대시보드, 아니면 로그인 후 역할별 이동 */}
        <Route
          path="/"
          element={
            canAccessWithoutLogin ? <Navigate to="/dashboard" replace /> :
            !isAuthenticated ? <Navigate to="/login" /> :
            isAdmin ? <Navigate to="/admin/system-logs" replace /> :
            <Navigate to="/dashboard" replace />
          }
        />
      </Routes>

      <ConfirmModal
        isOpen={confirmModal.isOpen && !HARDWARE_CHECK_EXCLUDE_PATHS.has(location.pathname)}
        title={confirmModal.title}
        message={confirmModal.message}
        onClose={handleModalClose}
        onConfirm={handleModalConfirm}
      />

      <GlobalErrorModal />
      
      <ToastContainer />
    </div>
  )
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  )
}

export default App
