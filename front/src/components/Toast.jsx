import { useState, useEffect } from 'react'
import './Toast.css'

const Toast = ({ message, type = 'info', duration = 3000, onClose }) => {
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

  return (
    <div 
      className={`toast toast-${type}`} 
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
    >
      <span className="toast-icon" aria-hidden="true">{getIcon()}</span>
      <span className="toast-message">{message}</span>
      <button 
        className="toast-close" 
        onClick={onClose} 
        aria-label="알림 닫기"
        type="button"
      >
        ×
      </button>
    </div>
  )
}

export default Toast

