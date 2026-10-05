import React from 'react';

const rows = [
  { name: 'Sarah K.', company: 'Meridian Group', score: 'High fit', status: 'Ready to review', intent: 'Sales inquiry' },
  { name: 'Tom R.', company: 'Atlas Logistics', score: 'Needs review', status: 'In queue', intent: 'Partnership' },
  { name: 'Priya M.', company: 'SolvPath Inc.', score: 'High fit', status: 'Draft ready', intent: 'Sales inquiry' },
];

export default function ProductMockup() {
  return (
    <figure className="w-full min-w-0 overflow-hidden rounded-xl border border-border-strong bg-surface shadow-[0_16px_48px_-32px_rgba(15,23,42,0.35)]">
      <div className="flex items-center justify-between gap-4 px-4 sm:px-5 py-3 border-b border-border bg-bg">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 rounded-full bg-accent shrink-0" aria-hidden="true" />
          <span className="text-xs font-semibold text-text-primary truncate">NodalX / Inquiry queue</span>
        </div>
        <span className="text-[10px] font-medium tracking-wider uppercase text-text-tertiary whitespace-nowrap">Illustrative preview</span>
      </div>

      <div className="flex min-h-[330px] sm:min-h-[380px]">
        <div className="hidden sm:flex w-36 lg:w-40 shrink-0 flex-col gap-1 border-r border-border bg-bg px-3 py-5" aria-hidden="true">
          <div className="text-[10px] uppercase tracking-widest text-text-tertiary px-2 mb-3">Workspace</div>
          <span className="px-2.5 py-2 rounded-md bg-surface border border-border text-xs font-semibold text-text-primary">Inquiries</span>
          <span className="px-2.5 py-2 text-xs text-text-tertiary">Drafts</span>
          <span className="px-2.5 py-2 text-xs text-text-tertiary">Settings</span>
        </div>

        <div className="flex-1 min-w-0 p-4 sm:p-5 lg:p-6">
          <div className="flex items-start justify-between gap-3 mb-5 sm:mb-7">
            <div>
              <h2 className="text-base sm:text-lg font-semibold tracking-tight text-text-primary">Inquiry queue</h2>
              <p className="mt-1 text-xs text-text-secondary">A place to review signals and draft responses.</p>
            </div>
            <span className="hidden md:inline-flex text-[10px] font-medium text-text-secondary bg-bg border border-border px-2.5 py-1 rounded-md whitespace-nowrap">Example workspace</span>
          </div>

          <div className="overflow-hidden border border-border rounded-lg">
            <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,0.9fr)] gap-3 px-3 sm:px-4 py-2.5 bg-bg border-b border-border text-[10px] uppercase tracking-wider font-medium text-text-tertiary">
              <span>Inquiry</span><span>Fit</span><span className="hidden md:block">Next step</span>
            </div>
            {rows.map((row) => (
              <div key={row.name} className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,0.9fr)] gap-3 px-3 sm:px-4 py-3.5 items-center border-b border-border last:border-b-0">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-text-primary truncate">{row.name}</div>
                  <div className="text-[10px] text-text-secondary mt-0.5 truncate">{row.company} · {row.intent}</div>
                </div>
                <span className={`text-[11px] font-medium ${row.score === 'High fit' ? 'text-accent' : 'text-text-secondary'}`}>{row.score}</span>
                <span className="hidden md:block text-[11px] text-text-secondary truncate">{row.status}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-2 text-[11px] text-text-tertiary">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
            Scores and statuses shown for illustration only
          </div>
        </div>
      </div>
      <figcaption className="sr-only">Illustrative NodalX inquiry queue with example contacts, fit signals, and review statuses. Not live data.</figcaption>
    </figure>
  );
}
