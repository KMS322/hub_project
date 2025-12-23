import './EmptyState.css'

const EmptyState = ({ 
  icon = '📋', 
  title, 
  message, 
  actionLabel, 
  onAction,
  children 
}) => {
  return (
    <div className="empty-state" role="status" aria-live="polite">
      <div className="empty-state-icon" aria-hidden="true">{icon}</div>
      {title && <h3 className="empty-state-title">{title}</h3>}
      {message && <p className="empty-state-message">{message}</p>}
      {children}
      {actionLabel && onAction && (
        <button 
          className="empty-state-action btn-primary" 
          onClick={onAction}
          type="button"
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}

export default EmptyState

