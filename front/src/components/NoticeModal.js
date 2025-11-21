import { useEffect } from 'react'
import './Modal.css'

function NoticeModal({ isOpen, onClose, title, message, duration = 3000 }) {
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        onClose()
      }, duration)

      return () => clearTimeout(timer)
    }
  }, [isOpen, duration, onClose])

  if (!isOpen) return null

  return (
    <div className="modal-overlay">
      <div className="modal-content notice-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
        </div>
        <div className="modal-body">
          <p>{message}</p>
        </div>
      </div>
    </div>
  )
}

export default NoticeModal

