import React from 'react';
import { cn } from './cn';

export interface SectionHeaderProps {
  label?: string;
  heading: string;
  subtext?: string;
  align?: 'left' | 'center';
  className?: string;
}

export function SectionHeader({ label, heading, subtext, align = 'left', className }: SectionHeaderProps) {
  const isCenter = align === 'center';

  return (
    <div className={cn('mb-14', isCenter && 'text-center', className)}>
      {label && (
        <p className="text-xs font-semibold tracking-widest text-teal-600 dark:text-teal-500 uppercase mb-3">
          {label}
        </p>
      )}
      <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white leading-tight">
        {heading}
      </h2>
      {subtext && (
        <p className={cn('mt-4 text-lg text-slate-500 dark:text-slate-400 leading-relaxed', isCenter ? 'max-w-2xl mx-auto' : 'max-w-xl')}>
          {subtext}
        </p>
      )}
    </div>
  );
}
