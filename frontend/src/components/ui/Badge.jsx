import React from 'react';
import './Badge.css';

const Badge = ({
  children,
  variant = 'default',
  size = 'medium',
  icon,
  iconPosition = 'left',
  rounded = false,
  className = '',
  ...props
}) => {
  const classNames = [
    'badge',
    `badge-${variant}`,
    `badge-${size}`,
    rounded && 'badge-rounded',
    className
  ].filter(Boolean).join(' ');

  return (
    <span className={classNames} {...props}>
      {icon && iconPosition === 'left' && <i className={`badge-icon ${icon}`}></i>}
      <span className="badge-content">{children}</span>
      {icon && iconPosition === 'right' && <i className={`badge-icon ${icon}`}></i>}
    </span>
  );
};

export default Badge;
