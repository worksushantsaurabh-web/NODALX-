import React from 'react';
import { cn } from './cn';

const baseTextarea = [
  'w-full rounded-lg border bg-surface',
  'text-sm text-white',
  'placeholder-text-tertiary',
  'focus:outline-none focus:ring-2 transition-colors',
  'disabled:opacity-60 disabled:cursor-not-allowed',
  'resize-y px-3 py-2.5',
].join(' ');

const normalBorder = 'border-border focus:border-border-strong';
const errorBorder  = 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helper?: string;
  error?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, helper, error, className, id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-semibold text-text-secondary mb-1.5">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          className={cn(baseTextarea, error ? errorBorder : normalBorder, className)}
          {...props}
        />
        {error  && <p className="mt-1.5 text-xs text-rose-400">{error}</p>}
        {!error && helper && <p className="mt-1.5 text-xs text-text-secondary">{helper}</p>}
      </div>
    );
  },
);

Textarea.displayName = 'Textarea';
