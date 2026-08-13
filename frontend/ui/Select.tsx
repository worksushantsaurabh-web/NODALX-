import React from 'react';
import { cn } from './cn';

const baseSelect = [
  'w-full rounded-lg border bg-white dark:bg-slate-900',
  'text-sm text-slate-900 dark:text-white',
  'focus:outline-none focus:ring-2 transition-colors',
  'disabled:opacity-60 disabled:cursor-not-allowed',
  'px-3 py-2.5 appearance-none',
].join(' ');

const normalBorder = 'border-slate-200 dark:border-slate-700 focus:border-teal-500 focus:ring-teal-500/20';
const errorBorder  = 'border-rose-400 dark:border-rose-500 focus:border-rose-500 focus:ring-rose-500/20';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  helper?: string;
  error?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, helper, error, className, id, children, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={inputId}
            className={cn(baseSelect, error ? errorBorder : normalBorder, 'pr-8', className)}
            {...props}
          >
            {children}
          </select>
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-400">
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
            </svg>
          </span>
        </div>
        {error  && <p className="mt-1.5 text-xs text-rose-600 dark:text-rose-400">{error}</p>}
        {!error && helper && <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">{helper}</p>}
      </div>
    );
  },
);

Select.displayName = 'Select';
