import React from 'react';
import Button from './Button';
import './EmptyState.css';

const EmptyState = ({
  icon = 'fa-inbox',
  title,
  description,
  action,
  actionLabel,
  onAction,
  illustration,
  size = 'medium'
}) => {
  return (
    <div className={`empty-state empty-state-${size}`}>
      {illustration ? (
        <div className="empty-state-illustration">
          {illustration}
        </div>
      ) : (
        <div className="empty-state-icon">
          <i className={`fas ${icon}`}></i>
        </div>
      )}

      {title && <h3 className="empty-state-title">{title}</h3>}
      {description && <p className="empty-state-description">{description}</p>}

      {(action || (actionLabel && onAction)) && (
        <div className="empty-state-actions">
          {action || (
            <Button variant="primary" onClick={onAction}>
              {actionLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default EmptyState;
