import React from 'react';
import { cn } from './cn';

const bgMap = {
  white: 'bg-white dark:bg-slate-950',
  muted: 'bg-slate-100 dark:bg-slate-900/40',
};

export interface SectionProps {
  id?: string;
  bg?: keyof typeof bgMap;
  border?: boolean;
  className?: string;
  innerClassName?: string;
  children: React.ReactNode;
}

export function Section({ id, bg = 'white', border = false, className, innerClassName, children }: SectionProps) {
  return (
    <section
      id={id}
      className={cn(
        'py-24 lg:py-28',
        bgMap[bg],
        border && 'border-t border-slate-200 dark:border-slate-800',
        className,
      )}
    >
      <div className={cn('max-w-5xl mx-auto px-4 sm:px-6 md:px-12', innerClassName)}>
        {children}
      </div>
    </section>
  );
}
