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
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </div>
  )
}

// 편의 훅
export const useToast = () => {
  return {
    success: (message, duration) => toastManager.success(message, duration),
    error: (message, duration) => toastManager.error(message, duration),
    warning: (message, duration) => toastManager.warning(message, duration),
    info: (message, duration) => toastManager.info(message, duration),
    show: (message, type, duration) => toastManager.show(message, type, duration)
  }
}

