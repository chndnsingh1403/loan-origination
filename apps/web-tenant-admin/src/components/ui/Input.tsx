import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helper?: string;
  required?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    { 
      label, 
      error, 
      helper, 
      required, 
      className = '', 
      id, 
      ...props 
    },
    ref
  ) => {
    const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
    const inputClasses = ['input', error && 'input-error', className]
      .filter(Boolean)
      .join(' ');

    return (
      <div className="form-group">
        {label && (
          <label
            htmlFor={inputId}
            className={`form-label ${required ? 'form-label-required' : ''}`}
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={inputClasses}
          {...props}
        />
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

Input.displayName = 'Input';

export interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helper?: string;
  required?: boolean;
}

export const TextArea = React.forwardRef<HTMLTextAreaElement, TextAreaProps>(
  (
    { 
      label, 
      error, 
      helper, 
      required, 
      className = '', 
      id, 
      ...props 
    },
    ref
  ) => {
    const inputId = id || `textarea-${Math.random().toString(36).substr(2, 9)}`;
    const inputClasses = ['textarea', error && 'textarea-error', className]
      .filter(Boolean)
      .join(' ');

    return (
      <div className="form-group">
        {label && (
          <label
            htmlFor={inputId}
            className={`form-label ${required ? 'form-label-required' : ''}`}
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          className={inputClasses}
          {...props}
        />
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

TextArea.displayName = 'TextArea';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helper?: string;
  required?: boolean;
  options: Array<{ value: string; label: string }>;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    { 
      label, 
      error, 
      helper, 
      required, 
      options, 
      className = '', 
      id, 
      ...props 
    },
    ref
  ) => {
    const inputId = id || `select-${Math.random().toString(36).substr(2, 9)}`;
    const inputClasses = ['select', error && 'select-error', className]
      .filter(Boolean)
      .join(' ');

    return (
      <div className="form-group">
        {label && (
          <label
            htmlFor={inputId}
            className={`form-label ${required ? 'form-label-required' : ''}`}
          >
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={inputId}
          className={inputClasses}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
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
