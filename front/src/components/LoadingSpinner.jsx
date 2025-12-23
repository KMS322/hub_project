import './LoadingSpinner.css'

const LoadingSpinner = ({ size = 'medium', text = '로딩 중...', fullScreen = false }) => {
  const sizeClass = `spinner-${size}`
  
  if (fullScreen) {
    return (
      <div className="loading-spinner-fullscreen" role="status" aria-live="polite">
        <div className={`loading-spinner ${sizeClass}`} aria-hidden="true"></div>
        {text && <p className="loading-text">{text}</p>}
      </div>
    )
  }

  return (
    <div className="loading-spinner-container" role="status" aria-live="polite">
      <div className={`loading-spinner ${sizeClass}`} aria-hidden="true"></div>
      {text && <p className="loading-text">{text}</p>}
    </div>
  )
}

export default LoadingSpinner

