import React from 'react';
import { cn } from './cn';

const bgMap = {
  bg: 'bg-bg',
  surface: 'bg-surface',
};

export interface SectionProps {
  id?: string;
  bg?: keyof typeof bgMap;
  border?: boolean;
  className?: string;
  innerClassName?: string;
  children: React.ReactNode;
}

export function Section({ id, bg = 'bg', border = false, className, innerClassName, children }: SectionProps) {
  return (
    <section
      id={id}
      className={cn(
        'scroll-mt-24 py-20 sm:py-24 lg:py-28',
        bgMap[bg],
        border && 'border-t border-border',
        className,
      )}
    >
      <div className={cn('min-w-0 max-w-7xl mx-auto px-5 sm:px-6 md:px-12', innerClassName)}>
        {children}
      </div>
    </section>
  );
}
