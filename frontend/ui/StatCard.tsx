import React from 'react';
import { cn } from './cn';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

export interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  iconBg: string;
  trend?: {
    value: string;
    direction: 'up' | 'down' | 'neutral';
  };
  loading?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

const trendStyles = {
  up:      { cls: 'bg-emerald-100/80 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400', Icon: ArrowUpRight },
  down:    { cls: 'bg-rose-100/80 dark:bg-rose-500/15 text-rose-700 dark:text-rose-400',             Icon: ArrowDownRight },
  neutral: { cls: 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400',               Icon: Minus },
};

export function StatCard({ label, value, icon, iconBg, trend, loading = false, className, style }: StatCardProps) {
  const trendStyle = trend ? trendStyles[trend.direction] : null;

  return (
    <div className={cn('glass-card rounded-2xl p-6 hover-lift', className)} style={style}>
      {loading && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="skeleton skeleton-circle w-12 h-12" />
            <div className="skeleton w-14 h-6 rounded-full" />
          </div>
          <div className="skeleton skeleton-text w-24" />
          <div className="skeleton w-16 h-8 rounded-lg" />
        </div>
      )}
      {!loading && (
        <>
          <div className="flex items-start justify-between mb-4">
            <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center', iconBg)}>
              {icon}
            </div>
            {trend && trendStyle && (
              <div className={cn('flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-full', trendStyle.cls)}>
                <trendStyle.Icon className="w-3 h-3" />
                {trend.value}
              </div>
            )}
          </div>
          <p className="text-3xl font-extrabold text-neutral-900 dark:text-white tracking-tight tabular-nums mb-1">
            {value}
          </p>
          <p className="text-neutral-500 dark:text-neutral-400 text-sm font-medium tracking-wide">{label}</p>
        </>
      )}
    </div>
  );
}
