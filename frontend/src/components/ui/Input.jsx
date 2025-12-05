import React, { forwardRef } from 'react';
import './Input.css';

const Input = forwardRef(({
  label,
  error,
  helperText,
  required = false,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  className = '',
  type = 'text',
  ...props
}, ref) => {
  const inputClassNames = [
    'input-field',
    error && 'input-error',
    icon && `input-with-icon-${iconPosition}`,
    fullWidth && 'input-full-width',
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={`input-wrapper ${fullWidth ? 'input-wrapper-full-width' : ''}`}>
      {label && (
        <label className="input-label">
          {label}
          {required && <span className="input-required">*</span>}
        </label>
      )}
      <div className="input-container">
        {icon && iconPosition === 'left' && (
          <i className={`input-icon input-icon-left ${icon}`}></i>
        )}
        <input
          ref={ref}
          type={type}
          className={inputClassNames}
          required={required}
          {...props}
        />
        {icon && iconPosition === 'right' && (
          <i className={`input-icon input-icon-right ${icon}`}></i>
        )}
      </div>
      {error && <span className="input-error-message">{error}</span>}
      {!error && helperText && <span className="input-helper-text">{helperText}</span>}
    </div>
  );
});

Input.displayName = 'Input';

export const Select = forwardRef(({
  label,
  error,
  helperText,
  required = false,
  fullWidth = false,
  className = '',
  children,
  ...props
}, ref) => {
  const selectClassNames = [
    'input-field',
    'select-field',
    error && 'input-error',
    fullWidth && 'input-full-width',
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={`input-wrapper ${fullWidth ? 'input-wrapper-full-width' : ''}`}>
      {label && (
        <label className="input-label">
          {label}
          {required && <span className="input-required">*</span>}
        </label>
      )}
      <div className="input-container">
        <select
          ref={ref}
          className={selectClassNames}
          required={required}
          {...props}
        >
          {children}
        </select>
        <i className="fas fa-chevron-down select-icon"></i>
      </div>
      {error && <span className="input-error-message">{error}</span>}
      {!error && helperText && <span className="input-helper-text">{helperText}</span>}
    </div>
  );
});

Select.displayName = 'Select';

export const Textarea = forwardRef(({
  label,
  error,
  helperText,
  required = false,
  fullWidth = false,
  className = '',
  rows = 4,
  ...props
}, ref) => {
  const textareaClassNames = [
    'input-field',
    'textarea-field',
    error && 'input-error',
    fullWidth && 'input-full-width',
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={`input-wrapper ${fullWidth ? 'input-wrapper-full-width' : ''}`}>
      {label && (
        <label className="input-label">
          {label}
          {required && <span className="input-required">*</span>}
        </label>
      )}
      <textarea
        ref={ref}
        className={textareaClassNames}
        rows={rows}
        required={required}
        {...props}
      />
      {error && <span className="input-error-message">{error}</span>}
      {!error && helperText && <span className="input-helper-text">{helperText}</span>}
    </div>
  );
});

Textarea.displayName = 'Textarea';

export default Input;
