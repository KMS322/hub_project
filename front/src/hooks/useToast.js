import { useContext, createContext } from 'react'
import { useToast as useToastHook } from '../components/ToastContainer'

const ToastContext = createContext(null)

export const ToastProvider = ({ children }) => {
  const toast = useToastHook()
  return (
    <ToastContext.Provider value={toast}>
      {children}
    </ToastContext.Provider>
  )
}

export const useToastContext = () => {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToastContext must be used within ToastProvider')
  }
  return context
}

// 간편 사용을 위한 훅
export const useToast = () => {
  const toast = useToastHook()
  return toast
}

