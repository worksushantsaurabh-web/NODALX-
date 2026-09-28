import React from 'react';

const rows = [
  { name: 'Sarah K.', company: 'Meridian Group', score: 92, status: 'Qualified', intent: 'Purchase' },
  { name: 'Tom R.', company: 'Atlas Logistics', score: 74, status: 'Review', intent: 'Partnership' },
  { name: 'Priya M.', company: 'SolvPath Inc.', score: 88, status: 'Qualified', intent: 'Purchase' },
  { name: 'David L.', company: 'Forefront SaaS', score: 51, status: 'Low fit', intent: 'Info' },
];

function Score({ value }: { value: number }) {
  const color =
    value >= 80 ? 'text-black ' :
    value >= 65 ? 'text-text-tertiary' :
                  'text-text-secondary';
  return (
    <span className={`text-sm font-bold tabular-nums ${color}`}>{value}</span>
  );
}

function Status({ value }: { value: string }) {
  const v =
    value === 'Qualified' ? { dot: 'bg-black ', text: 'text-black ', ring: 'ring-neutral-300 ' } :
    value === 'Review' ? { dot: 'bg-neutral-400', text: 'text-text-tertiary ', ring: 'ring-neutral-200 ' } :
                          { dot: 'bg-neutral-300', text: 'text-text-secondary', ring: 'ring-neutral-200 ' };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-semibold ring-1 bg-transparent ${v.text} ${v.ring}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${v.dot}`} />
      {value}
    </span>
  );
}

export default function ProductMockup() {
  return (
    <div className="w-full rounded-2xl overflow-hidden bg-surface border border-border shadow-2xl shadow-black/10  select-none text-xs">

      <div className="flex items-center gap-1.5 px-4 py-2.5 bg-neutral-50  border-b border-neutral-200 ">
        <span className="w-2.5 h-2.5 rounded-full bg-neutral-300 " />
        <span className="w-2.5 h-2.5 rounded-full bg-neutral-300 " />
        <span className="w-2.5 h-2.5 rounded-full bg-neutral-300 " />
        <div className="flex-1 mx-3 px-3 py-1 rounded-md bg-white  border border-neutral-200  text-text-secondary text-[10px]">
          nodalx.in/dashboard
        </div>
      </div>

      <div className="flex h-[340px]">

        <aside className="w-40 shrink-0 border-r border-neutral-100  bg-neutral-50  flex flex-col py-4 px-2 gap-0.5">
          <div className="flex items-center gap-2 px-2 py-1.5 mb-2">
            <div className="w-4 h-4 rounded-md bg-black  shrink-0" />
            <span className="font-bold text-black  text-[11px]">NodalX</span>
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
                  ? 'bg-black  text-white '
                  : 'text-text-secondary '
              }`}
            >
              {item.label}
            </div>
          ))}
        </aside>

        <main className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100 ">
            <div>
              <div className="font-semibold text-black  text-[11px]">Inquiry Queue</div>
              <div className="text-text-secondary text-[10px] mt-0.5">4 new since yesterday</div>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-black  text-white  text-[10px] font-semibold">
              Review all
            </div>
          </div>

          <div className="grid grid-cols-[1fr_1fr_3rem_5rem] px-4 py-2 border-b border-neutral-100  bg-neutral-50 ">
            {['Contact', 'Company', 'Score', 'Status'].map((h) => (
              <span key={h} className="text-[9px] font-semibold text-text-secondary uppercase tracking-wider">{h}</span>
            ))}
          </div>

          <div className="flex-1 overflow-hidden">
            {rows.map((row, i) => (
              <div
                key={row.name}
                className={`grid grid-cols-[1fr_1fr_3rem_5rem] px-4 py-2.5 border-b border-neutral-50  items-center ${
                  i === 0 ? 'bg-neutral-50 ' : ''
                }`}
              >
                <div>
                  <div className="font-semibold text-black  text-[11px]">{row.name}</div>
                  <div className="text-text-secondary text-[9px] mt-0.5">{row.intent}</div>
                </div>
                <div className="text-text-tertiary  text-[11px] truncate pr-2">{row.company}</div>
                <Score value={row.score} />
                <Status value={row.status} />
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 px-4 py-2.5 border-t border-neutral-100 ">
            <div className="flex-1 h-1 rounded-full bg-neutral-100 ">
              <div className="h-full rounded-full bg-black " style={{ width: '75%' }} />
            </div>
            <span className="text-[9px] text-text-secondary whitespace-nowrap">3 of 4 reviewed</span>
          </div>
        </main>
      </div>
    </div>
  );
}
