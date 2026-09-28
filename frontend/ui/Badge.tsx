import React from 'react';
import { cn } from './cn';

const variants = {
  success: 'bg-neutral-900 text-white border-neutral-700',
  warning: 'bg-neutral-900 text-neutral-300 border-neutral-700',
  danger: 'bg-neutral-900 text-neutral-300 border-neutral-700',
  info: 'bg-neutral-900 text-neutral-300 border-neutral-700',
  neutral: 'bg-neutral-900 text-neutral-400 border-neutral-700',
};

const dotColors = {
  success: 'bg-white',
  warning: 'bg-neutral-500',
  danger: 'bg-neutral-300',
  info: 'bg-neutral-400',
  neutral: 'bg-neutral-400',
};

const sizes = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-xs px-2.5 py-1',
};

export interface BadgeProps {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  dot?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function Badge({ variant = 'neutral', size = 'sm', dot = false, className, children }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium border',
        variants[variant],
        sizes[size],
        className,
      )}
    >
      {dot && <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', dotColors[variant])} />}
      {children}
    </span>
  );
}
