import './Modal.css'

function ConfirmModal({ isOpen, onClose, onConfirm, title, message }) {
  if (!isOpen) return null

  const handleConfirm = () => {
    onConfirm()
    onClose()
  }

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
          <button onClick={onClose} className="btn-secondary">거절</button>
          <button onClick={handleConfirm} className="btn-primary">동의</button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmModal

