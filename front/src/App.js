import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useAuthStore } from './stores/useAuthStore'
import hubService from './api/hubService'
import deviceService from './api/deviceService'
import ConfirmModal from './components/ConfirmModal'
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
import './App.css'

function AppContent() {
  const navigate = useNavigate()
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onNavigate: null })
  const [checkCompleted, setCheckCompleted] = useState(false)

  // 로그인 후 hub/device 체크
  useEffect(() => {
    const checkHardware = async () => {
      if (!isAuthenticated || checkCompleted) return

      try {
        const [hubs, devices] = await Promise.all([
          hubService.getHubs(),
          deviceService.getDevices()
        ])

        if (hubs.length === 0) {
          // Hub가 없으면
          setNoticeModal({
            isOpen: true,
            title: '허브 등록 필요',
            message: '허브를 등록해주세요.',
            onNavigate: '/hardware'
          })
          setCheckCompleted(true)
          return
        }

        if (devices.length === 0) {
          // Hub는 있지만 Device가 없으면
          setNoticeModal({
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
  }, [isAuthenticated, checkCompleted])

  const handleModalClose = () => {
    setConfirmModal({ isOpen: false, title: '', message: '', onNavigate: null })
  }

  const handleModalConfirm = () => {
    const navigateTo = confirmModal.onNavigate
    setConfirmModal({ isOpen: false, title: '', message: '', onNavigate: null })
    if (navigateTo) {
      navigate(navigateTo)
    }
  }

  return (
      <div className="App">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/dashboard"
            element={isAuthenticated ? <Dashboard /> : <Navigate to="/login" />}
          />
          <Route
            path="/hardware"
            element={isAuthenticated ? <Hardware /> : <Navigate to="/login" />}
          />
          <Route
            path="/patients"
            element={isAuthenticated ? <Patients /> : <Navigate to="/login" />}
          />
          <Route
            path="/records"
            element={isAuthenticated ? <Records /> : <Navigate to="/login" />}
          />
          <Route
            path="/profile"
            element={isAuthenticated ? <Profile /> : <Navigate to="/login" />}
          />
          <Route
            path="/monitoring/:patientId"
            element={isAuthenticated ? <Monitoring /> : <Navigate to="/login" />}
          />
          <Route 
            path="/guide" 
            element={<Guide />} 
          />
          <Route
            path="/serial-monitor"
            element={isAuthenticated ? <SerialMonitor /> : <Navigate to="/login" />}
          />
          <Route
            path="/hardware-error-test"
            element={isAuthenticated ? <HardwareErrorTest /> : <Navigate to="/login" />}
          />
          <Route path="/" element={<Navigate to="/dashboard" />} />
        </Routes>
        
        {/* 확인 모달 */}
        <ConfirmModal
          isOpen={confirmModal.isOpen}
          title={confirmModal.title}
          message={confirmModal.message}
          onClose={handleModalClose}
          onConfirm={handleModalConfirm}
        />
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
