import React from 'react';

const principles = [
  { number: '01', label: 'Bring inquiries together' },
  { number: '02', label: 'Review fit with context' },
  { number: '03', label: 'Keep people in the loop' },
];

export default function TrustStrip() {
  return (
    <section className="bg-surface border-b border-border" aria-label="NodalX workflow principles">
      <div className="max-w-7xl mx-auto px-5 sm:px-6 md:px-12 py-6 sm:py-8 grid gap-4 sm:gap-0 sm:grid-cols-3">
        {principles.map((item) => (
          <div key={item.number} className="flex items-center gap-3 sm:gap-4 sm:px-6 first:sm:pl-0 last:sm:pr-0 sm:border-r last:sm:border-r-0 border-border">
            <span className="text-xs font-semibold text-accent tabular-nums">{item.number}</span>
            <span className="text-sm font-medium text-text-secondary">{item.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
