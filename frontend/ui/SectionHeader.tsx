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
    <div className={cn('min-w-0 mb-10 sm:mb-14', isCenter && 'text-center', className)}>
      {label && (
        <p className="text-xs font-semibold tracking-[0.16em] text-accent uppercase mb-4">
          {label}
        </p>
      )}
      <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-text-primary leading-tight whitespace-pre-line">
        {heading}
      </h2>
      {subtext && (
        <p className={cn('mt-4 text-base text-text-secondary leading-relaxed', isCenter ? 'max-w-2xl mx-auto' : 'max-w-xl')}>
          {subtext}
        </p>
      )}
    </div>
  );
}
