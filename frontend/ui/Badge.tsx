import React from 'react';
import { cn } from './cn';

const variants = {
  success: 'bg-neutral-100 dark:bg-neutral-900 text-black dark:text-white border-neutral-200 dark:border-neutral-700',
  warning: 'bg-neutral-100 dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700',
  danger: 'bg-neutral-100 dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700',
  info: 'bg-neutral-100 dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700',
  neutral: 'bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700',
};

const dotColors = {
  success: 'bg-black dark:bg-white',
  warning: 'bg-neutral-500',
  danger: 'bg-neutral-700 dark:bg-neutral-300',
  info: 'bg-neutral-600 dark:bg-neutral-400',
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
