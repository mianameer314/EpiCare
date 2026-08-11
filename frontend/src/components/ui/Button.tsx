import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { Loader2 } from 'lucide-react';
import './Button.css';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'btn',
          `btn-${variant}`,
          `btn-${size}`,
          isLoading && 'btn-loading',
          className
        )}
        disabled={disabled || isLoading}
        aria-disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && (
          <Loader2 className="btn-spinner" aria-hidden="true" />
        )}
        <span style={{ opacity: isLoading ? 0 : 1, transition: 'opacity 0.2s' }}>{children}</span>
        {isLoading && <span className="visually-hidden">Loading...</span>}
      </button>
    );
  }
);
Button.displayName = 'Button';
