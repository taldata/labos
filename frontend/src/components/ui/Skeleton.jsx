import React from 'react';
import './Skeleton.css';

const Skeleton = ({
  variant = 'text',
  width,
  height,
  borderRadius,
  className = '',
  count = 1,
  ...props
}) => {
  const style = {
    width: width || (variant === 'text' ? '100%' : undefined),
    height: height || getDefaultHeight(variant),
    borderRadius: borderRadius || getDefaultBorderRadius(variant),
  };

  if (count > 1) {
    return (
      <div className="skeleton-group">
        {Array.from({ length: count }).map((_, index) => (
          <div
            key={index}
            className={`skeleton skeleton-${variant} ${className}`}
            style={style}
            {...props}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={`skeleton skeleton-${variant} ${className}`}
      style={style}
      {...props}
    />
  );
};

const getDefaultHeight = (variant) => {
  switch (variant) {
    case 'text':
      return '1rem';
    case 'title':
      return '2rem';
    case 'avatar':
      return '48px';
    case 'button':
      return '40px';
    case 'card':
      return '200px';
    default:
      return undefined;
  }
};

const getDefaultBorderRadius = (variant) => {
  switch (variant) {
    case 'text':
    case 'title':
      return '0.25rem';
    case 'avatar':
      return '50%';
    case 'button':
      return '0.5rem';
    case 'card':
      return '0.75rem';
    case 'rectangular':
      return '0';
    default:
      return '0.5rem';
  }
};

// Compound components for common patterns
const SkeletonCard = () => (
  <div className="skeleton-card-wrapper">
    <Skeleton variant="card" height="150px" />
    <div className="skeleton-card-content">
      <Skeleton variant="title" width="70%" />
      <Skeleton variant="text" width="100%" count={2} />
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
        <Skeleton variant="button" width="100px" />
        <Skeleton variant="button" width="80px" />
      </div>
    </div>
  </div>
);

const SkeletonTable = ({ rows = 5, columns = 4 }) => (
  <div className="skeleton-table">
    <div className="skeleton-table-header">
      {Array.from({ length: columns }).map((_, index) => (
        <Skeleton key={index} variant="text" height="1.25rem" />
      ))}
    </div>
    {Array.from({ length: rows }).map((_, rowIndex) => (
      <div key={rowIndex} className="skeleton-table-row">
        {Array.from({ length: columns }).map((_, colIndex) => (
          <Skeleton key={colIndex} variant="text" />
        ))}
      </div>
    ))}
  </div>
);

const SkeletonList = ({ items = 5 }) => (
  <div className="skeleton-list">
    {Array.from({ length: items }).map((_, index) => (
      <div key={index} className="skeleton-list-item">
        <Skeleton variant="avatar" width="40px" height="40px" />
        <div className="skeleton-list-content">
          <Skeleton variant="text" width="60%" />
          <Skeleton variant="text" width="40%" height="0.875rem" />
        </div>
      </div>
    ))}
  </div>
);

Skeleton.Card = SkeletonCard;
Skeleton.Table = SkeletonTable;
Skeleton.List = SkeletonList;

export default Skeleton;
