import { useState, useEffect } from 'react'
import './Toast.css'

const Toast = ({ message, type = 'info', duration = 3000, onClose, onClick }) => {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onClose()
      }, duration)
      return () => clearTimeout(timer)
    }
  }, [duration, onClose])

  const getIcon = () => {
    switch (type) {
      case 'success':
        return '✓'
      case 'error':
        return '✕'
      case 'warning':
        return '⚠'
      default:
        return 'ℹ'
    }
  }

  const handleClick = (e) => {
    // 닫기 버튼 클릭이 아닐 때만 onClick 실행
    if (e.target.className !== 'toast-close' && onClick) {
      onClick()
      onClose()
    }
  }

  return (
    <div 
      className={`toast toast-${type} ${onClick ? 'toast-clickable' : ''}`} 
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      onClick={handleClick}
    >
      <span className="toast-icon" aria-hidden="true">{getIcon()}</span>
      <span className="toast-message">{message}</span>
      <button 
        className="toast-close" 
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
        aria-label="알림 닫기"
        type="button"
      >
        ×
      </button>
    </div>
  )
}

export default Toast

