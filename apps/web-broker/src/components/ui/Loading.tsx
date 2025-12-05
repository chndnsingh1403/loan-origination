import React from 'react';

export interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  className = '',
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  return (
    <div className={`spinner ${sizeClasses[size]} ${className}`} />
  );
};

export interface LoadingStateProps {
  text?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  text = 'Loading...',
  size = 'md',
  className = '',
}) => {
  return (
    <div className={`flex flex-col items-center justify-center p-8 ${className}`}>
      <LoadingSpinner size={size} />
      <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">{text}</p>
    </div>
  );
};

export interface SkeletonProps {
  className?: string;
  width?: string;
  height?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  width = '100%',
  height = '1rem',
}) => {
  return (
    <div
      className={`skeleton ${className}`}
      style={{ width, height }}
    />
  );
};

export interface TableSkeletonProps {
  rows?: number;
  columns?: number;
}

export const TableSkeleton: React.FC<TableSkeletonProps> = ({
  rows = 5,
  columns = 4,
}) => {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-4">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton key={colIndex} height="2.5rem" />
          ))}
        </div>
      ))}
    </div>
  );
};
