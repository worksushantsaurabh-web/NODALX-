import React from 'react';
import { cn } from './cn';

export interface PanelProps {
  title?: string;
  action?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}

export function Panel({ title, action, className, bodyClassName, children }: PanelProps) {
  return (
    <div className={cn('glass-card rounded-2xl overflow-hidden', className)}>
      {(title || action) && (
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 dark:border-white/5">
          {title && (
            <h3 className="text-sm font-bold text-neutral-900 dark:text-white tracking-tight">{title}</h3>
          )}
          {action && <div className="flex items-center gap-2">{action}</div>}
        </div>
      )}
      <div className={cn('p-6', bodyClassName)}>
        {children}
      </div>
    </div>
  );
}
