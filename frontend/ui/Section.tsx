import React from 'react';
import { cn } from './cn';

const bgMap = {
  white: 'bg-white dark:bg-black',
  muted: 'bg-neutral-50 dark:bg-neutral-950',
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
        border && 'border-t border-neutral-200 dark:border-neutral-800',
        className,
      )}
    >
      <div className={cn('max-w-5xl mx-auto px-4 sm:px-6 md:px-12', innerClassName)}>
        {children}
      </div>
    </section>
  );
}
