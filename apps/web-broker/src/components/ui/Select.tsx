import React from 'react';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helper?: string;
  required?: boolean;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    { 
      label, 
      error, 
      helper, 
      required, 
      className = '', 
      id, 
      children,
      ...props 
    },
    ref
  ) => {
    const selectId = id || `select-${Math.random().toString(36).substr(2, 9)}`;
    const selectClasses = ['input', error && 'input-error', className]
      .filter(Boolean)
      .join(' ');

    return (
      <div className="form-group">
        {label && (
          <label
            htmlFor={selectId}
            className={`form-label ${required ? 'form-label-required' : ''}`}
          >
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={selectClasses}
          {...props}
        >
          {children}
        </select>
        {helper && !error && (
          <span className="form-helper">{helper}</span>
        )}
        {error && (
          <span className="form-error">{error}</span>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';
