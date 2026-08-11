import React, { useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from './Button';
import './Input.css';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  description?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, description, id, required, ...props }, ref) => {
    const defaultId = useId();
    const inputId = id || defaultId;
    const errorId = `${inputId}-error`;
    const descriptionId = `${inputId}-description`;
    const [showPassword, setShowPassword] = useState(false);
    
    const isPasswordType = props.type === 'password';
    const currentType = isPasswordType && showPassword ? 'text' : props.type;

    return (
      <div className="input-wrapper">
        <label htmlFor={inputId} className="input-label">
          {label} {required && <span aria-hidden="true" className="input-required">*</span>}
        </label>
        
        <div style={{ position: 'relative', width: '100%' }}>
          <input
            ref={ref}
            id={inputId}
            className={cn('input-field', isPasswordType && 'input-field-password', error && 'input-field-error', className)}
            aria-invalid={!!error}
            aria-describedby={
              cn(error && errorId, description && descriptionId) || undefined
            }
            required={required}
            {...props}
            type={currentType}
          />
          {isPasswordType && (
            <button
              type="button"
              className="password-toggle-btn"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          )}
        </div>

        {description && !error && (
          <div id={descriptionId} className="input-description">
            {description}
          </div>
        )}
        
        {error && (
          <div id={errorId} className="input-error-msg" role="alert">
            {error}
          </div>
        )}
      </div>
    );
  }
);
Input.displayName = 'Input';
