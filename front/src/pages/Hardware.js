import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import Header from '../components/Header'
import { dummyHubs, dummyDevices, dummyDashboardStats } from '../data/dummyData'
import AlertModal from '../components/AlertModal'
import ConfirmModal from '../components/ConfirmModal'
import './Hardware.css'

function Hardware() {
  const [searchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const [activeTab, setActiveTab] = useState(tabParam || 'device')

  useEffect(() => {
    if (tabParam) {
      setActiveTab(tabParam)
    }
  }, [tabParam])
  const [hubs] = useState(dummyHubs)
  const [devices] = useState(dummyDevices)
  const [alertModal, setAlertModal] = useState({ isOpen: false, title: '', message: '' })
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null })
  const [hubRegisterModal, setHubRegisterModal] = useState({ isOpen: false })
  const [availableDevices, setAvailableDevices] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedDevice, setSelectedDevice] = useState(null)
  const [wifiId, setWifiId] = useState('')
  const [wifiPassword, setWifiPassword] = useState('')
  
  // 디바이스 등록 모달 상태
  const [deviceRegisterModal, setDeviceRegisterModal] = useState({ isOpen: false })
  const [hubModeSwitched, setHubModeSwitched] = useState(false)
  const [scannedDevices, setScannedDevices] = useState([])
  const [isScanning, setIsScanning] = useState(false)
  const [devicesToRegister, setDevicesToRegister] = useState({}) // { deviceId: { name: '', isRegistering: false } }

  // 허브 관리
  const handleHubDelete = (hubId) => {
    setConfirmModal({
      isOpen: true,
      title: '허브 삭제',
      message: '정말 이 허브를 삭제하시겠습니까?',
      onConfirm: () => {
        setAlertModal({ isOpen: true, title: '삭제 완료', message: '허브가 삭제되었습니다.' })
      }
    })
  }

  const handleHubWifiConfig = (hubId) => {
    setAlertModal({ isOpen: true, title: 'WiFi 설정', message: 'USB 연결을 통해 WiFi 설정을 진행하세요.' })
  }

  // 디바이스 관리
  const handleDevicePatientChange = (deviceId) => {
    setAlertModal({ isOpen: true, title: '환자 연결', message: '환자 연결 기능은 추후 구현됩니다.' })
  }

  // 허브 등록 모달
  const handleOpenHubRegister = () => {
    setHubRegisterModal({ isOpen: true })
    setAvailableDevices([])
    setSelectedDevice(null)
    setWifiId('')
    setWifiPassword('')
    setIsSearching(false)
  }

  const handleCloseHubRegister = () => {
    setHubRegisterModal({ isOpen: false })
    setAvailableDevices([])
    setSelectedDevice(null)
    setWifiId('')
    setWifiPassword('')
    setIsSearching(false)
  }

  const handleSearchDevices = () => {
    setIsSearching(true)
    // 더미 연결 가능한 디바이스 목록 (실제로는 USB로 연결된 디바이스를 검색)
    setTimeout(() => {
      const dummyAvailableDevices = [
        { id: 'available1', name: '새 허브 1', macAddress: 'AA:BB:CC:DD:EE:FF' },
        { id: 'available2', name: '새 허브 2', macAddress: 'AA:BB:CC:DD:EE:FE' }
      ]
      setAvailableDevices(dummyAvailableDevices)
      setIsSearching(false)
    }, 1000)
  }

  const handleSelectDevice = (device) => {
    setSelectedDevice(device)
    // 연결 시도
    setAlertModal({ 
      isOpen: true, 
      title: '연결 시도', 
      message: `${device.name} 연결을 시도하고 있습니다...` 
    })
  }

  const handleRegisterHub = () => {
    if (!selectedDevice || !wifiId || !wifiPassword) {
      setAlertModal({ 
        isOpen: true, 
        title: '입력 오류', 
        message: '모든 필드를 입력해주세요.' 
      })
      return
    }
    // 허브 등록 로직
    setAlertModal({ 
      isOpen: true, 
      title: '등록 완료', 
      message: '허브가 성공적으로 등록되었습니다.' 
    })
    handleCloseHubRegister()
  }

  // 디바이스 등록 모달
  const handleOpenDeviceRegister = () => {
    setDeviceRegisterModal({ isOpen: true })
    setHubModeSwitched(false)
    setScannedDevices([])
    setIsScanning(false)
    setDevicesToRegister({})
  }

  const handleCloseDeviceRegister = () => {
    setDeviceRegisterModal({ isOpen: false })
    setHubModeSwitched(false)
    setScannedDevices([])
    setIsScanning(false)
    setDevicesToRegister({})
  }

  const handleSwitchHubMode = () => {
    setHubModeSwitched(true)
    setAlertModal({ 
      isOpen: true, 
      title: '모드 전환', 
      message: '허브가 디바이스 등록 모드로 전환되었습니다. 이제 모든 디바이스를 켜주세요.' 
    })
  }

  const handleScanDevices = () => {
    setIsScanning(true)
    // 더미 스캔된 디바이스 목록 (실제로는 허브가 스캔한 결과)
    setTimeout(() => {
      const dummyScannedDevices = [
        { id: 'scan1', macAddress: 'AA:BB:CC:DD:EE:01', name: '' },
        { id: 'scan2', macAddress: 'AA:BB:CC:DD:EE:02', name: '' },
        { id: 'scan3', macAddress: 'AA:BB:CC:DD:EE:03', name: '' }
      ]
      setScannedDevices(dummyScannedDevices)
      setIsScanning(false)
    }, 1500)
  }

  const handleBlinkLED = (deviceId) => {
    setAlertModal({ 
      isOpen: true, 
      title: 'LED 깜빡임', 
      message: '해당 디바이스의 LED가 깜빡이고 있습니다.' 
    })
  }

  const handleStartRegisterDevice = (deviceId) => {
    setDevicesToRegister(prev => ({
      ...prev,
      [deviceId]: { name: '', isRegistering: true }
    }))
  }

  const handleDeviceNameChange = (deviceId, name) => {
    setDevicesToRegister(prev => ({
      ...prev,
      [deviceId]: { ...prev[deviceId], name }
    }))
  }

  const handleCancelRegisterDevice = (deviceId) => {
    setDevicesToRegister(prev => {
      const newState = { ...prev }
      delete newState[deviceId]
      return newState
    })
  }

  const handleFinalRegister = () => {
    const devicesWithNames = Object.entries(devicesToRegister)
      .filter(([_, data]) => data.name.trim() !== '')
    
    if (devicesWithNames.length === 0) {
      setAlertModal({ 
        isOpen: true, 
        title: '등록 오류', 
        message: '등록할 디바이스가 없습니다. 디바이스명을 입력해주세요.' 
      })
      return
    }

    // 최종 등록 로직
    setAlertModal({ 
      isOpen: true, 
      title: '등록 완료', 
      message: `${devicesWithNames.length}개의 디바이스가 성공적으로 등록되었습니다.` 
    })
    handleCloseDeviceRegister()
  }

  return (
    <div className="hardware-page">
      <Header />
      <div className="hardware-container">
        {/* 디바이스 및 허브 현황 */}
        <section className="stats-section">
          <h2>디바이스 및 허브 현황</h2>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">등록된 허브 수</div>
              <div className="stat-value">{dummyDashboardStats.totalHubs}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">등록된 디바이스 수</div>
              <div className="stat-value">{dummyDashboardStats.totalDevices}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">연결된 디바이스 수</div>
              <div className="stat-value">{dummyDashboardStats.connectedDevices}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">가용중인 디바이스 수</div>
              <div className="stat-value">{dummyDashboardStats.availableDevices}</div>
            </div>
          </div>
        </section>

        <div className="tabs">
          <button 
            className={activeTab === 'hub' ? 'tab active' : 'tab'}
            onClick={() => setActiveTab('hub')}
          >
            허브 관리
          </button>
          <button 
            className={activeTab === 'device' ? 'tab active' : 'tab'}
            onClick={() => setActiveTab('device')}
          >
            디바이스 관리
          </button>
        </div>

        {/* 허브 관리 */}
        {activeTab === 'hub' && (
          <div className="hub-section">
            <div className="section-header">
              <h2>허브 목록</h2>
              <button className="btn-primary" onClick={handleOpenHubRegister}>허브 등록</button>
            </div>
            <div className="hub-list">
              {hubs.map(hub => (
                <div key={hub.id} className="hub-card">
                  <div className="hub-info">
                    <h3>{hub.name}</h3>
                    <div className="hub-details">
                      <div className="detail-item">
                        <span className="label">WiFi ID:</span>
                        <span>{hub.wifiId}</span>
                      </div>
                      <div className="detail-item">
                        <span className="label">연결된 디바이스:</span>
                        <span>{hub.connectedDevices}개</span>
                      </div>
                      <div className="detail-item">
                        <span className="label">상태:</span>
                        <span className={hub.status === 'connected' ? 'status-connected' : 'status-disconnected'}>
                          {hub.status === 'connected' ? '연결됨' : '연결 안됨'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="hub-actions">
                    <button 
                      className="btn-secondary"
                      onClick={() => handleHubWifiConfig(hub.id)}
                    >
                      WiFi 설정
                    </button>
                    <button className="btn-secondary">이름 변경</button>
                    <button 
                      className="btn-danger"
                      onClick={() => handleHubDelete(hub.id)}
                    >
                      삭제
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 디바이스 관리 */}
        {activeTab === 'device' && (
          <div className="device-section">
            <div className="section-header">
              <h2>디바이스 목록</h2>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <div className="device-stats">
                  <span>연결된 디바이스: {devices.filter(d => d.status === 'connected').length}개</span>
                </div>
                <button className="btn-primary" onClick={handleOpenDeviceRegister}>디바이스 등록</button>
              </div>
            </div>
            <div className="device-list">
              {devices.map(device => (
                <div key={device.id} className="device-card">
                  <div className="device-info">
                    <h3>{device.name}</h3>
                    <div className="device-details">
                      <div className="detail-item">
                        <span className="label">MAC 주소:</span>
                        <span>{device.macAddress}</span>
                      </div>
                      <div className="detail-item">
                        <span className="label">허브:</span>
                        <span>{device.hubName}</span>
                      </div>
                      <div className="detail-item">
                        <span className="label">배터리:</span>
                        <span>{device.battery}%</span>
                      </div>
                      <div className="detail-item">
                        <span className="label">상태:</span>
                        <span className={device.status === 'connected' ? 'status-connected' : 'status-disconnected'}>
                          {device.status === 'connected' ? '연결됨' : '연결 안됨'}
                        </span>
                      </div>
                      <div className="detail-item">
                        <span className="label">연결된 환자:</span>
                        <span>{device.connectedPatient ? device.connectedPatient.name : '없음'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="device-actions">
                    <button className="btn-secondary">이름 변경</button>
                    <button 
                      className="btn-primary"
                      onClick={() => handleDevicePatientChange(device.id)}
                    >
                      {device.connectedPatient ? '환자 변경' : '환자 연결'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 사용 가이드 */}
        <section className="guide-section">
          <button 
            className="guide-btn"
            onClick={() => window.open('/guide', '_blank', 'width=1000,height=800')}
          >
            사용 가이드 보기
          </button>
        </section>
      </div>

      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={() => setAlertModal({ isOpen: false, title: '', message: '' })}
        title={alertModal.title}
        message={alertModal.message}
      />
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: null })}
        onConfirm={confirmModal.onConfirm || (() => {})}
        title={confirmModal.title}
        message={confirmModal.message}
      />

      {/* 허브 등록 모달 */}
      {hubRegisterModal.isOpen && (
        <div className="modal-overlay" onClick={handleCloseHubRegister}>
          <div className="modal-content hub-register-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>허브 등록</h3>
              <button onClick={handleCloseHubRegister} className="close-btn">×</button>
            </div>
            <div className="modal-body">
              <div className="hub-register-content">
                <p className="hub-register-instruction">
                  USB 선으로 허브를 연결하세요.
                </p>
                
                <div className="search-section">
                  <button 
                    className="btn-primary search-device-btn"
                    onClick={handleSearchDevices}
                    disabled={isSearching}
                  >
                    {isSearching ? '검색 중...' : '연결된 디바이스 검색'}
                  </button>
                </div>

                {availableDevices.length > 0 && (
                  <div className="available-devices-list">
                    <h4>연결 가능한 디바이스</h4>
                    {availableDevices.map(device => (
                      <div 
                        key={device.id} 
                        className={`available-device-item ${selectedDevice?.id === device.id ? 'selected' : ''}`}
                        onClick={() => handleSelectDevice(device)}
                      >
                        <div className="device-item-info">
                          <span className="device-item-name">{device.name}</span>
                          <span className="device-item-mac">{device.macAddress}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {selectedDevice && (
                  <div className="wifi-form-section">
                    <h4>WiFi 설정</h4>
                    <div className="form-group">
                      <label htmlFor="wifi-id">WiFi ID</label>
                      <input
                        id="wifi-id"
                        type="text"
                        value={wifiId}
                        onChange={(e) => setWifiId(e.target.value)}
                        placeholder="WiFi ID를 입력하세요"
                        className="form-input"
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="wifi-password">WiFi 비밀번호</label>
                      <input
                        id="wifi-password"
                        type="password"
                        value={wifiPassword}
                        onChange={(e) => setWifiPassword(e.target.value)}
                        placeholder="WiFi 비밀번호를 입력하세요"
                        className="form-input"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={handleCloseHubRegister} className="btn-secondary">취소</button>
              <button 
                onClick={handleRegisterHub} 
                className="btn-primary"
                disabled={!selectedDevice || !wifiId || !wifiPassword}
              >
                등록
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 디바이스 등록 모달 */}
      {deviceRegisterModal.isOpen && (
        <div className="modal-overlay" onClick={handleCloseDeviceRegister}>
          <div className="modal-content device-register-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>디바이스 등록</h3>
              <button onClick={handleCloseDeviceRegister} className="close-btn">×</button>
            </div>
            <div className="modal-body">
              <div className="device-register-content">
                <p className="device-register-instruction">
                  허브를 켜주세요.
                </p>

                {!hubModeSwitched ? (
                  <div className="mode-switch-section">
                    <button 
                      className="btn-primary switch-mode-btn"
                      onClick={handleSwitchHubMode}
                    >
                      허브를 디바이스 등록 모드로 전환
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="scan-section">
                      <p className="scan-instruction">
                        연결하고자 하는 모든 디바이스를 켜주세요.
                      </p>
                      <button 
                        className="btn-primary scan-device-btn"
                        onClick={handleScanDevices}
                        disabled={isScanning}
                      >
                        {isScanning ? '검색 중...' : '디바이스 검색'}
                      </button>
                    </div>

                    {scannedDevices.length > 0 && (
                      <div className="scanned-devices-list">
                        <h4>스캔된 디바이스 목록</h4>
                        {scannedDevices.map(device => {
                          const deviceData = devicesToRegister[device.id]
                          const isRegistering = deviceData?.isRegistering
                          const deviceName = deviceData?.name || ''
                          
                          return (
                            <div key={device.id} className="scanned-device-item">
                              <div className="scanned-device-info">
                                <span className="scanned-device-mac">{device.macAddress}</span>
                                {isRegistering && deviceName && (
                                  <span className="scanned-device-name-display">이름: {deviceName}</span>
                                )}
                              </div>
                              <div className="scanned-device-actions">
                                {!isRegistering ? (
                                  <>
                                    <button 
                                      className="btn-secondary blink-led-btn"
                                      onClick={() => handleBlinkLED(device.id)}
                                    >
                                      LED 깜빡이기
                                    </button>
                                    <button 
                                      className="btn-primary start-register-btn"
                                      onClick={() => handleStartRegisterDevice(device.id)}
                                    >
                                      등록하기
                                    </button>
                                  </>
                                ) : (
                                  <div className="device-name-input-section">
                                    <input
                                      type="text"
                                      value={deviceName}
                                      onChange={(e) => handleDeviceNameChange(device.id, e.target.value)}
                                      placeholder="디바이스명을 입력하세요"
                                      className="form-input device-name-input"
                                    />
                                    <button 
                                      className="btn-secondary cancel-register-btn"
                                      onClick={() => handleCancelRegisterDevice(device.id)}
                                    >
                                      취소
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {Object.keys(devicesToRegister).length > 0 && (
                      <div className="final-register-section">
                        <button 
                          className="btn-primary final-register-btn"
                          onClick={handleFinalRegister}
                        >
                          최종등록하기
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={handleCloseDeviceRegister} className="btn-secondary">닫기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Hardware

