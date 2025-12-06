import React, { forwardRef } from 'react';
import './Button.css';

const Button = forwardRef(({
  children,
  variant = 'primary',
  size = 'medium',
  icon,
  iconPosition = 'left',
  loading = false,
  disabled = false,
  fullWidth = false,
  type = 'button',
  className = '',
  ...props
}, ref) => {
  const classNames = [
    'btn',
    `btn-${variant}`,
    `btn-${size}`,
    fullWidth && 'btn-full-width',
    loading && 'btn-loading',
    disabled && 'btn-disabled',
    className
  ].filter(Boolean).join(' ');

  return (
    <button
      ref={ref}
      type={type}
      className={classNames}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <span className="btn-spinner"></span>}
      {!loading && icon && iconPosition === 'left' && <i className={`btn-icon ${icon}`}></i>}
      {children && <span className="btn-content">{children}</span>}
      {!loading && icon && iconPosition === 'right' && <i className={`btn-icon ${icon}`}></i>}
    </button>
  );
});

Button.displayName = 'Button';

export default Button;
