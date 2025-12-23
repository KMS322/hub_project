import { useState } from 'react'
import './FormField.css'

const FormField = ({
  label,
  name,
  type = 'text',
  value,
  onChange,
  onBlur,
  error,
  required = false,
  placeholder,
  options, // select용
  rows, // textarea용
  ...props
}) => {
  const [touched, setTouched] = useState(false)

  const handleBlur = (e) => {
    setTouched(true)
    if (onBlur) onBlur(e)
  }

  const showError = touched && error

  return (
    <div className={`form-field ${showError ? 'has-error' : ''}`}>
      <label htmlFor={name} className="form-label">
        {label}
        {required && <span className="required-mark" aria-label="필수 항목">*</span>}
      </label>
      
      {type === 'select' ? (
        <select
          id={name}
          name={name}
          value={value}
          onChange={onChange}
          onBlur={handleBlur}
          className={`form-input ${showError ? 'error' : ''}`}
          aria-invalid={showError}
          aria-describedby={showError ? `${name}-error` : undefined}
          {...props}
        >
          {options?.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : type === 'textarea' ? (
        <textarea
          id={name}
          name={name}
          value={value}
          onChange={onChange}
          onBlur={handleBlur}
          rows={rows || 4}
          placeholder={placeholder}
          className={`form-input ${showError ? 'error' : ''}`}
          aria-invalid={showError}
          aria-describedby={showError ? `${name}-error` : undefined}
          {...props}
        />
      ) : (
        <input
          id={name}
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          className={`form-input ${showError ? 'error' : ''}`}
          aria-invalid={showError}
          aria-describedby={showError ? `${name}-error` : undefined}
          {...props}
        />
      )}
      
      {showError && (
        <span 
          id={`${name}-error`}
          className="form-error"
          role="alert"
        >
          {error}
        </span>
      )}
    </div>
  )
}

export default FormField

