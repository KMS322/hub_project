import './ErrorState.css'

const ErrorState = ({ 
  title = '오류가 발생했습니다', 
  message, 
  onRetry,
  retryLabel = '다시 시도'
}) => {
  return (
    <div className="error-state" role="alert">
      <div className="error-state-icon" aria-hidden="true">⚠️</div>
      <h3 className="error-state-title">{title}</h3>
      {message && <p className="error-state-message">{message}</p>}
      {onRetry && (
        <button 
          className="error-state-retry btn-primary" 
          onClick={onRetry}
          type="button"
        >
          {retryLabel}
        </button>
      )}
    </div>
  )
}

export default ErrorState

