import React from 'react';
import { X } from 'lucide-react';
import { Button } from './Button';

export type AlertVariant = 'success' | 'error' | 'warning' | 'info';

export interface AlertProps {
  variant: AlertVariant;
  title?: string;
  children: React.ReactNode;
  onClose?: () => void;
  className?: string;
}

export const Alert: React.FC<AlertProps> = ({ 
  variant, 
  title,
  children, 
  onClose,
  className = '' 
}) => {
  const variantClasses = {
    success: 'alert-success',
    error: 'alert-error',
    warning: 'alert-warning',
    info: 'alert-info',
  };

  const classes = ['alert', variantClasses[variant], className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} role="alert">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          {title && (
            <div className="font-semibold mb-1">{title}</div>
          )}
          <div className="text-sm">{children}</div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="flex-shrink-0 p-1 rounded hover:bg-black hover:bg-opacity-10 transition-colors"
            aria-label="Close alert"
          >
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  );
};
