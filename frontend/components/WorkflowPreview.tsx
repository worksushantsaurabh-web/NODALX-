import React from 'react';
import { Bell, Zap, CheckCircle2, Send } from 'lucide-react';
import { Section, SectionHeader, Card, Badge } from '../ui';

function InquiryCard() {
  return (
    <Card className="h-full flex flex-col glass-card !border-0">
      <Card.Header className="gap-2">
        <div className="flex items-center gap-2">
          <Bell className="w-3.5 h-3.5 text-neutral-400" strokeWidth={1.5} />
          <span className="text-xs font-semibold text-neutral-600 dark:text-neutral-300">New inquiry</span>
        </div>
        <span className="w-2 h-2 rounded-full bg-black dark:bg-white animate-pulse-dot" />
      </Card.Header>
      <Card.Body className="flex flex-col gap-3 flex-1">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center text-black dark:text-white font-bold text-[10px] shrink-0">
            SK
          </div>
          <div>
            <div className="text-xs font-semibold text-black dark:text-white leading-none">Sarah K.</div>
            <div className="text-[10px] text-neutral-400 mt-0.5">Meridian Group</div>
          </div>
        </div>
        <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed border-l-2 border-neutral-200 dark:border-neutral-700 pl-2.5">
          "We need an automated way to handle our enterprise sales inquiries. We get ~200/month. Budget is around $3K/mo..."
        </p>
        <div className="mt-auto flex items-center justify-between text-[10px] text-neutral-400 pt-1 border-t border-neutral-100 dark:border-neutral-800">
          <span>via contact form</span>
          <span>Just now</span>
        </div>
      </Card.Body>
    </Card>
  );
}

const signals = [
  { label: 'Budget', value: '$2-5K / mo' },
  { label: 'Volume', value: '~200 / month' },
  { label: 'Company', value: 'Enterprise' },
  { label: 'Intent signal', value: 'Purchase ready' },
];

function AICard() {
  return (
    <Card className="h-full flex flex-col glass-card !border-0">
      <Card.Header>
        <div className="flex items-center gap-2">
          <Zap className="w-3.5 h-3.5 text-black dark:text-white" strokeWidth={1.5} />
          <span className="text-xs font-semibold text-neutral-600 dark:text-neutral-300">AI extracting signals</span>
        </div>
      </Card.Header>
      <Card.Body className="flex flex-col gap-2 flex-1">
        {signals.map((s) => (
          <div key={s.label} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3 h-3 text-neutral-400 shrink-0" />
              <span className="text-[11px] text-neutral-500 dark:text-neutral-400">{s.label}</span>
            </div>
            <span className="text-[11px] font-medium text-black dark:text-white tabular-nums">{s.value}</span>
          </div>
        ))}
        <div className="mt-auto pt-3 border-t border-neutral-100 dark:border-neutral-800">
          <div className="flex justify-between text-[10px] text-neutral-400 mb-1.5">
            <span>Analysis complete</span>
            <span>100%</span>
          </div>
          <div className="h-1 rounded-full bg-neutral-100 dark:bg-neutral-800">
            <div className="h-full w-full rounded-full bg-black dark:bg-white" />
          </div>
        </div>
      </Card.Body>
    </Card>
  );
}

function QualifiedCard() {
  return (
    <Card className="h-full flex flex-col glass-card !border-black/20 dark:!border-white/20">
      <Card.Header className="bg-white/50 dark:bg-white/5">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-3.5 h-3.5 text-black dark:text-white" strokeWidth={1.5} />
          <span className="text-xs font-semibold text-black dark:text-white">Lead qualified</span>
        </div>
        <Badge variant="success">High fit</Badge>
      </Card.Header>
      <Card.Body className="flex flex-col gap-3 flex-1">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center shrink-0">
            <span className="text-xl font-bold text-black dark:text-white leading-none">92</span>
          </div>
          <div className="flex-1">
            <div className="text-[10px] text-neutral-400 mb-1">Fit score</div>
            <div className="h-1.5 rounded-full bg-neutral-100 dark:bg-neutral-800">
              <div className="h-full rounded-full bg-black dark:bg-white" style={{ width: '92%' }} />
            </div>
          </div>
        </div>
        <div className="space-y-1.5 pt-1">
          {[
            { label: 'Intent', value: 'Purchase' },
            { label: 'Urgency', value: 'High' },
            { label: 'Category', value: 'Enterprise sales' },
          ].map((r) => (
            <div key={r.label} className="flex items-center justify-between text-[11px]">
              <span className="text-neutral-400">{r.label}</span>
              <span className="font-medium text-black dark:text-white">{r.value}</span>
            </div>
          ))}
        </div>
      </Card.Body>
    </Card>
  );
}

function ReplyCard() {
  return (
    <Card className="h-full flex flex-col glass-card !border-0">
      <Card.Header>
        <div className="flex items-center gap-2">
          <Send className="w-3.5 h-3.5 text-black dark:text-white" strokeWidth={1.5} />
          <span className="text-xs font-semibold text-neutral-600 dark:text-neutral-300">Reply drafted</span>
        </div>
      </Card.Header>
      <Card.Body className="flex flex-col gap-3 flex-1">
        <div className="space-y-1 text-[10px]">
          <div className="flex gap-2">
            <span className="text-neutral-400 w-6 shrink-0">To</span>
            <span className="text-black dark:text-white font-medium">sarah@meridiangrp.com</span>
          </div>
          <div className="flex gap-2">
            <span className="text-neutral-400 w-6 shrink-0">Re</span>
            <span className="text-black dark:text-white">Enterprise inquiry — NODALxAI</span>
          </div>
        </div>
        <div className="h-px bg-neutral-100 dark:bg-neutral-800" />
        <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed flex-1">
          Hi Sarah, thanks for reaching out. Based on what you've shared, NODALxAI looks like a strong fit for your team's needs. I'd love to schedule a quick...
        </p>
        <button className="w-full py-2 rounded-lg bg-black dark:bg-white text-white dark:text-black text-[11px] font-semibold flex items-center justify-center gap-1.5 cursor-default">
          <CheckCircle2 className="w-3 h-3" />
          Approve &amp; send
        </button>
      </Card.Body>
    </Card>
  );
}

const steps = [
  { number: '01', label: 'Inquiry in' },
  { number: '02', label: 'AI reads it' },
  { number: '03', label: 'Lead scored' },
  { number: '04', label: 'Reply ready' },
];

export default function WorkflowPreview() {
  return (
    <Section border bg="white" innerClassName="max-w-6xl mx-auto px-4 sm:px-6 md:px-12">
      <SectionHeader
        label="Product walkthrough"
        heading="Raw inquiry to qualified follow-up — in seconds."
      />

      <div className="hidden lg:grid grid-cols-4 mb-3 relative">
        <div className="absolute top-3 left-[calc(12.5%+0.75rem)] right-[calc(12.5%+0.75rem)] h-px bg-neutral-200 dark:bg-neutral-700" />
        {steps.map((s) => (
          <div key={s.number} className="flex flex-col items-center gap-2 relative">
            <div className="w-6 h-6 rounded-full bg-white dark:bg-black border border-neutral-200 dark:border-neutral-700 flex items-center justify-center z-10">
              <span className="text-[9px] font-bold text-black dark:text-white">{s.number}</span>
            </div>
            <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">{s.label}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <InquiryCard />
        <AICard />
        <QualifiedCard />
        <ReplyCard />
      </div>

      <div className="lg:hidden grid grid-cols-4 mt-4 gap-1">
        {steps.map((s) => (
          <div key={s.number} className="flex flex-col items-center gap-1 text-center">
            <span className="text-[9px] font-bold text-black dark:text-white">{s.number}</span>
            <span className="text-[10px] text-neutral-400 leading-tight">{s.label}</span>
          </div>
        ))}
      </div>
    </Section>
  );
}
