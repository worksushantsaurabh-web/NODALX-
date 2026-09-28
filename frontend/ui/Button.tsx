import React from 'react';
import { cn } from './cn';

const variants = {
  primary: 'btn-primary rounded-full',
  secondary: 'g-chip rounded-full text-text-primary hover:border-accent',
  ghost: 'text-text-secondary hover:text-text-primary hover:bg-surface-hover rounded-full',
  destructive: 'bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 rounded-full',
};

const sizes = {
  sm: 'text-xs px-4 py-2',
  md: 'text-sm px-5 py-2.5',
  lg: 'text-base px-7 py-3',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading = false, disabled, className, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'rounded-md font-medium transition-all duration-150 inline-flex items-center justify-center gap-2 disabled:cursor-not-allowed',
          variants[variant],
          sizes[size],
          loading && 'opacity-70',
          className,
        )}
        {...props}
      >
        {loading && (
          <svg className="animate-spin h-4 w-4 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        )}
        {children}
      </button>
    );
  },
);

Button.displayName = 'Button';
