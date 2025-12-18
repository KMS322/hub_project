import { useState, useEffect } from 'react'
import './HardwareAlertBar.css'

function HardwareAlertBar({ alerts, onDismiss }) {
  const [visibleAlerts, setVisibleAlerts] = useState([])

  useEffect(() => {
    if (alerts && alerts.length > 0) {
      setVisibleAlerts(alerts)
    } else {
      setVisibleAlerts([])
    }
  }, [alerts])

  const handleDismiss = (alertId) => {
    if (onDismiss) {
      onDismiss(alertId)
    } else {
      setVisibleAlerts(prev => prev.filter(alert => alert.id !== alertId))
    }
  }

  if (visibleAlerts.length === 0) {
    return null
  }

  return (
    <div className="hardware-alert-bar-container">
      {visibleAlerts.map(alert => (
        <div 
          key={alert.id} 
          className={`hardware-alert-bar ${alert.type || 'warning'}`}
        >
          <div className="alert-icon">
            {alert.type === 'error' && '⚠️'}
            {alert.type === 'warning' && '⚠️'}
            {alert.type === 'info' && 'ℹ️'}
          </div>
          <div className="alert-content">
            <div className="alert-title">{alert.deviceName || '디바이스'}</div>
            <div className="alert-message">{alert.message}</div>
          </div>
          <button 
            className="alert-dismiss-btn"
            onClick={() => handleDismiss(alert.id)}
            aria-label="알림 닫기"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}

export default HardwareAlertBar

