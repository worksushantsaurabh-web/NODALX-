import React from 'react';

const rows = [
  { name: 'Sarah K.', company: 'Meridian Group', score: 92, status: 'Qualified', intent: 'Purchase' },
  { name: 'Tom R.', company: 'Atlas Logistics', score: 74, status: 'Review', intent: 'Partnership' },
  { name: 'Priya M.', company: 'SolvPath Inc.', score: 88, status: 'Qualified', intent: 'Purchase' },
  { name: 'David L.', company: 'Forefront SaaS', score: 51, status: 'Low fit', intent: 'Info' },
];

function Score({ value }: { value: number }) {
  const color =
    value >= 80 ? 'text-black dark:text-white' :
    value >= 65 ? 'text-neutral-500' :
                  'text-neutral-400';
  return (
    <span className={`text-sm font-bold tabular-nums ${color}`}>{value}</span>
  );
}

function Status({ value }: { value: string }) {
  const v =
    value === 'Qualified' ? { dot: 'bg-black dark:bg-white', text: 'text-black dark:text-white', ring: 'ring-neutral-300 dark:ring-neutral-600' } :
    value === 'Review' ? { dot: 'bg-neutral-400', text: 'text-neutral-600 dark:text-neutral-400', ring: 'ring-neutral-200 dark:ring-neutral-700' } :
                          { dot: 'bg-neutral-300', text: 'text-neutral-400', ring: 'ring-neutral-200 dark:ring-neutral-700' };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-semibold ring-1 bg-transparent ${v.text} ${v.ring}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${v.dot}`} />
      {value}
    </span>
  );
}

export default function ProductMockup() {
  return (
    <div className="w-full rounded-2xl overflow-hidden glass-card shadow-2xl shadow-black/10 dark:shadow-black/40 select-none text-xs">

      <div className="flex items-center gap-1.5 px-4 py-2.5 bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">
        <span className="w-2.5 h-2.5 rounded-full bg-neutral-300 dark:bg-neutral-700" />
        <span className="w-2.5 h-2.5 rounded-full bg-neutral-300 dark:bg-neutral-700" />
        <span className="w-2.5 h-2.5 rounded-full bg-neutral-300 dark:bg-neutral-700" />
        <div className="flex-1 mx-3 px-3 py-1 rounded-md bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-400 text-[10px]">
          app.nodalxai.com/dashboard
        </div>
      </div>

      <div className="flex h-[340px]">

        <aside className="w-40 shrink-0 border-r border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 flex flex-col py-4 px-2 gap-0.5">
          <div className="flex items-center gap-2 px-2 py-1.5 mb-2">
            <div className="w-4 h-4 rounded-md bg-black dark:bg-white shrink-0" />
            <span className="font-bold text-black dark:text-white text-[11px]">NODALxAI</span>
          </div>
          {[
            { label: 'Overview', active: false },
            { label: 'Inquiry Queue', active: true },
            { label: 'Automations', active: false },
            { label: 'Connectors', active: false },
            { label: 'Settings', active: false },
          ].map((item) => (
            <div
              key={item.label}
              className={`px-2 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                item.active
                  ? 'bg-black dark:bg-white text-white dark:text-black'
                  : 'text-neutral-400 dark:text-neutral-500'
              }`}
            >
              {item.label}
            </div>
          ))}
        </aside>

        <main className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100 dark:border-neutral-800">
            <div>
              <div className="font-semibold text-black dark:text-white text-[11px]">Inquiry Queue</div>
              <div className="text-neutral-400 text-[10px] mt-0.5">4 new since yesterday</div>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-black dark:bg-white text-white dark:text-black text-[10px] font-semibold">
              Review all
            </div>
          </div>

          <div className="grid grid-cols-[1fr_1fr_3rem_5rem] px-4 py-2 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900">
            {['Contact', 'Company', 'Score', 'Status'].map((h) => (
              <span key={h} className="text-[9px] font-semibold text-neutral-400 uppercase tracking-wider">{h}</span>
            ))}
          </div>

          <div className="flex-1 overflow-hidden">
            {rows.map((row, i) => (
              <div
                key={row.name}
                className={`grid grid-cols-[1fr_1fr_3rem_5rem] px-4 py-2.5 border-b border-neutral-50 dark:border-neutral-800 items-center ${
                  i === 0 ? 'bg-neutral-50 dark:bg-neutral-900' : ''
                }`}
              >
                <div>
                  <div className="font-semibold text-black dark:text-white text-[11px]">{row.name}</div>
                  <div className="text-neutral-400 text-[9px] mt-0.5">{row.intent}</div>
                </div>
                <div className="text-neutral-500 dark:text-neutral-400 text-[11px] truncate pr-2">{row.company}</div>
                <Score value={row.score} />
                <Status value={row.status} />
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 px-4 py-2.5 border-t border-neutral-100 dark:border-neutral-800">
            <div className="flex-1 h-1 rounded-full bg-neutral-100 dark:bg-neutral-800">
              <div className="h-full rounded-full bg-black dark:bg-white" style={{ width: '75%' }} />
            </div>
            <span className="text-[9px] text-neutral-400 whitespace-nowrap">3 of 4 reviewed</span>
          </div>
        </main>
      </div>
    </div>
  );
}
