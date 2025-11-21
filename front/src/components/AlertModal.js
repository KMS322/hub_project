import './Modal.css'

function AlertModal({ isOpen, onClose, title, message }) {
  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
        </div>
        <div className="modal-body">
          <p>{message}</p>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn-primary">확인</button>
        </div>
      </div>
    </div>
  )
}

export default AlertModal

