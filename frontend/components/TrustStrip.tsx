import React from 'react';

const stats = [
  { value: '< 3 min', label: 'typical response time' },
  { value: '94%', label: 'qualification accuracy (beta)' },
  { value: '15 min', label: 'avg. setup time' },
  { value: '12+', label: 'countries (early users)' },
];

export default function TrustStrip() {
  return (
    <section className="border-y border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 md:px-12 py-10">
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-slate-200 dark:divide-slate-800">
          {stats.map((stat) => (
            <div key={stat.label} className="flex flex-col items-center text-center px-6 first:pl-0 last:pr-0 gap-1">
              <span className="text-2xl sm:text-3xl font-bold text-teal-600 dark:text-teal-400 tracking-tight">
                {stat.value}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">{stat.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
