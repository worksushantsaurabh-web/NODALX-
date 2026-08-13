import React from 'react';
import { cn } from './cn';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center py-16 px-6', className)}>
      {icon && (
        <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500 mb-4">
          {icon}
        </div>
      )}
      <p className="text-sm font-semibold text-slate-900 dark:text-white mb-1">{title}</p>
      {description && (
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs leading-relaxed mb-5">{description}</p>
      )}
      {action && <div>{action}</div>}
    </div>
  );
}
