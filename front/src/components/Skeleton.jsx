import './Skeleton.css'

export const Skeleton = ({ width, height, circle = false, className = '' }) => {
  const style = {
    width: width || '100%',
    height: height || '1rem',
  }

  return (
    <div
      className={`skeleton ${circle ? 'skeleton-circle' : ''} ${className}`}
      style={style}
      aria-hidden="true"
    />
  )
}

export const SkeletonCard = () => {
  return (
    <div className="skeleton-card">
      <Skeleton width="60%" height="1.5rem" className="skeleton-title" />
      <Skeleton width="100%" height="1rem" className="skeleton-line" />
      <Skeleton width="80%" height="1rem" className="skeleton-line" />
      <Skeleton width="40%" height="1rem" className="skeleton-line" />
    </div>
  )
}

export const SkeletonTable = ({ rows = 5, columns = 5 }) => {
  return (
    <div className="skeleton-table">
      <div className="skeleton-table-header">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} width="100%" height="1.5rem" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="skeleton-table-row">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton key={colIndex} width="100%" height="1rem" />
          ))}
        </div>
      ))}
    </div>
  )
}

export const SkeletonList = ({ items = 3 }) => {
  return (
    <div className="skeleton-list">
      {Array.from({ length: items }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  )
}

