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
        <div className="w-12 h-12 rounded-xl bg-surface-hover flex items-center justify-center text-text-tertiary mb-4">
          {icon}
        </div>
      )}
      <p className="text-sm font-semibold text-white mb-1">{title}</p>
      {description && (
        <p className="text-sm text-text-secondary max-w-xs leading-relaxed mb-5">{description}</p>
      )}
      {action && <div>{action}</div>}
    </div>
  );
}
