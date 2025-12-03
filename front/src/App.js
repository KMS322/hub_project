import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/useAuthStore'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Hardware from './pages/Hardware'
import Patients from './pages/Patients'
import Records from './pages/Records'
import Profile from './pages/Profile'
import Monitoring from './pages/Monitoring'
import Guide from './pages/Guide'
import TelemetryTest from './pages/TelemetryTest'
import './App.css'

function App() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

  return (
    <Router>
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
            path="/telemetry-test"
            element={isAuthenticated ? <TelemetryTest /> : <Navigate to="/login" />}
          />
          <Route path="/" element={<Navigate to="/dashboard" />} />
        </Routes>
      </div>
    </Router>
  )
}

export default App
