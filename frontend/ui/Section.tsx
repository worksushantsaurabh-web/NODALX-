import React from 'react';
import { cn } from './cn';

const bgMap = {
  bg: 'bg-black',
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
        'py-32 lg:py-40',
        bgMap[bg],
        border && 'border-t border-border',
        className,
      )}
    >
      <div className={cn('max-w-6xl mx-auto px-6 md:px-12', innerClassName)}>
        {children}
      </div>
    </section>
  );
}
