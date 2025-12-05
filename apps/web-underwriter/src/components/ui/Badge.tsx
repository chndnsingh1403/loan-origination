import React from 'react';

export type BadgeVariant = 'primary' | 'success' | 'warning' | 'error' | 'info' | 'neutral';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  icon?: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ 
  children, 
  variant = 'neutral', 
  icon,
  className = '' 
}) => {
  const variantClasses = {
    primary: 'badge-primary',
    success: 'badge-success',
    warning: 'badge-warning',
    error: 'badge-error',
    info: 'badge-info',
    neutral: 'badge-neutral',
  };

  const classes = ['badge', variantClasses[variant], className]
    .filter(Boolean)
    .join(' ');

  return (
    <span className={classes}>
      {icon && icon}
      {children}
    </span>
  );
};
