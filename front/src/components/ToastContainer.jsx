import { useState, useEffect } from 'react'
import Toast from './Toast'
import { toastManager } from '../utils/toastManager'
import './Toast.css'

export const ToastContainer = () => {
  const [toasts, setToasts] = useState([])

  useEffect(() => {
    const unsubscribe = toastManager.subscribe((newToast) => {
      setToasts(prev => [...prev, newToast])
    })

    return unsubscribe
  }, [])

  const removeToast = (id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }

  return (
    <div 
      className="toast-container" 
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map(toast => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          duration={toast.duration}
          onClick={toast.onClick}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </div>
  )
}

// 편의 훅
export const useToast = () => {
  return {
    success: (message, duration, onClick) => toastManager.success(message, duration, onClick),
    error: (message, duration, onClick) => toastManager.error(message, duration, onClick),
    warning: (message, duration, onClick) => toastManager.warning(message, duration, onClick),
    info: (message, duration, onClick) => toastManager.info(message, duration, onClick),
    show: (message, type, duration, onClick) => toastManager.show(message, type, duration, onClick)
  }
}

