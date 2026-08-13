import React from 'react';

const rows = [
  { name: 'Sarah K.', company: 'Meridian Group', score: 92, status: 'Qualified', intent: 'Purchase' },
  { name: 'Tom R.',   company: 'Atlas Logistics', score: 74, status: 'Review',    intent: 'Partnership' },
  { name: 'Priya M.', company: 'SolvPath Inc.',  score: 88, status: 'Qualified', intent: 'Purchase' },
  { name: 'David L.', company: 'Forefront SaaS', score: 51, status: 'Low fit',   intent: 'Info' },
];

// Score: bold number only — the number IS the signal, no box needed
function Score({ value }: { value: number }) {
  const color =
    value >= 80 ? 'text-emerald-500 dark:text-emerald-400' :
    value >= 65 ? 'text-amber-500 dark:text-amber-400' :
                  'text-slate-400 dark:text-slate-500';
  return (
    <span className={`text-sm font-bold tabular-nums ${color}`}>{value}</span>
  );
}

// Status: dot + label pill — distinct shape and weight from the number
function Status({ value }: { value: string }) {
  const v =
    value === 'Qualified' ? { dot: 'bg-emerald-400', text: 'text-emerald-600 dark:text-emerald-400', ring: 'ring-emerald-400/30' } :
    value === 'Review'    ? { dot: 'bg-amber-400',   text: 'text-amber-600 dark:text-amber-400',   ring: 'ring-amber-400/30' } :
                            { dot: 'bg-slate-400',   text: 'text-slate-500 dark:text-slate-400',   ring: 'ring-slate-400/20' };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-semibold ring-1 bg-transparent ${v.text} ${v.ring}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${v.dot}`} />
      {value}
    </span>
  );
}

export default function ProductMockup() {
  return (
    <div className="w-full rounded-2xl border border-slate-200/70 dark:border-slate-700/50 overflow-hidden bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl shadow-2xl shadow-slate-900/12 dark:shadow-slate-900/40 ring-1 ring-slate-900/5 dark:ring-white/5 select-none text-xs">

      {/* Browser chrome */}
      <div className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200/60 dark:border-slate-700/50 backdrop-blur-sm">
        <span className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
        <span className="w-2.5 h-2.5 rounded-full bg-amber-400/70" />
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/70" />
        <div className="flex-1 mx-3 px-3 py-1 rounded-md bg-white/70 dark:bg-slate-700/60 border border-slate-200/50 dark:border-slate-600/40 text-slate-400 dark:text-slate-500 text-[10px] backdrop-blur-sm">
          app.nodalxai.com/dashboard
        </div>
      </div>

      {/* App shell */}
      <div className="flex h-[340px]">

        {/* Sidebar */}
        <aside className="w-40 shrink-0 border-r border-slate-100/80 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/60 flex flex-col py-4 px-2 gap-0.5">
          <div className="flex items-center gap-2 px-2 py-1.5 mb-2">
            <div className="w-4 h-4 rounded-md bg-teal-600 shrink-0 shadow-sm shadow-teal-600/30" />
            <span className="font-bold text-slate-900 dark:text-white text-[11px]">NODALxAI</span>
          </div>
          {[
            { label: 'Overview',       active: false },
            { label: 'Inquiry Queue',  active: true },
            { label: 'Automations',    active: false },
            { label: 'Connectors',     active: false },
            { label: 'Settings',       active: false },
          ].map((item) => (
            <div
              key={item.label}
              className={`px-2 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                item.active
                  ? 'bg-teal-500/10 dark:bg-teal-500/15 text-teal-700 dark:text-teal-400 ring-1 ring-teal-500/20'
                  : 'text-slate-400 dark:text-slate-500 hover:text-slate-600'
              }`}
            >
              {item.label}
            </div>
          ))}
        </aside>

        {/* Main */}
        <main className="flex-1 flex flex-col min-w-0">

          {/* Page header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100/80 dark:border-slate-800/60 bg-white/40 dark:bg-transparent">
            <div>
              <div className="font-semibold text-slate-900 dark:text-white text-[11px]">Inquiry Queue</div>
              <div className="text-slate-400 text-[10px] mt-0.5">4 new since yesterday</div>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-teal-600 text-white text-[10px] font-semibold shadow-sm shadow-teal-600/25">
              Review all
            </div>
          </div>

          {/* Table header */}
          <div className="grid grid-cols-[1fr_1fr_3rem_5rem] px-4 py-2 border-b border-slate-100/80 dark:border-slate-800/60 bg-slate-50/60 dark:bg-slate-800/30">
            {['Contact', 'Company', 'Score', 'Status'].map((h) => (
              <span key={h} className="text-[9px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{h}</span>
            ))}
          </div>

          {/* Rows */}
          <div className="flex-1 overflow-hidden">
            {rows.map((row, i) => (
              <div
                key={row.name}
                className={`grid grid-cols-[1fr_1fr_3rem_5rem] px-4 py-2.5 border-b border-slate-50/80 dark:border-slate-800/30 items-center transition-colors ${
                  i === 0 ? 'bg-teal-50/60 dark:bg-teal-900/10' : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/20'
                }`}
              >
                <div>
                  <div className="font-semibold text-slate-800 dark:text-slate-100 text-[11px]">{row.name}</div>
                  <div className="text-slate-400 dark:text-slate-500 text-[9px] mt-0.5">{row.intent}</div>
                </div>
                <div className="text-slate-500 dark:text-slate-400 text-[11px] truncate pr-2">{row.company}</div>
                <Score value={row.score} />
                <Status value={row.status} />
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div className="flex items-center gap-3 px-4 py-2.5 border-t border-slate-100/80 dark:border-slate-800/60 bg-slate-50/40 dark:bg-transparent">
            <div className="flex-1 h-1 rounded-full bg-slate-100 dark:bg-slate-700/60">
              <div className="h-full rounded-full bg-gradient-to-r from-teal-500 to-teal-400 shadow-sm shadow-teal-500/30" style={{ width: '75%' }} />
            </div>
            <span className="text-[9px] text-slate-400 whitespace-nowrap">3 of 4 reviewed</span>
          </div>
        </main>
      </div>
    </div>
  );
}
