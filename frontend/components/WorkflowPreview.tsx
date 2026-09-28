import React from 'react';
import { Bell, Zap, CheckCircle2, Send } from 'lucide-react';
import { Section, SectionHeader, Card, Badge } from '../ui';

function InquiryCard() {
  return (
    <Card className="h-full flex flex-col !border-0">
      <Card.Header className="gap-2">
        <div className="flex items-center gap-2">
          <Bell className="w-3.5 h-3.5 text-text-secondary" strokeWidth={1.5} />
          <span className="text-xs font-semibold text-text-secondary">New inquiry</span>
        </div>
        <span className="w-2 h-2 rounded-full bg-white animate-pulse-dot" />
      </Card.Header>
      <Card.Body className="flex flex-col gap-3 flex-1">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-surface-hover border border-border-strong flex items-center justify-center text-white font-bold text-[10px] shrink-0">
            SK
          </div>
          <div>
            <div className="text-xs font-semibold text-white leading-none">Sarah K.</div>
            <div className="text-[10px] text-text-tertiary mt-0.5">Meridian Group</div>
          </div>
        </div>
        <p className="text-[11px] text-text-secondary leading-relaxed border-l-2 border-border-strong pl-2.5">
          "We need an automated way to handle our enterprise sales inquiries. We get ~200/month. Budget is around $3K/mo..."
        </p>
        <div className="mt-auto flex items-center justify-between text-[10px] text-text-tertiary pt-1 border-t border-border">
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
    <Card className="h-full flex flex-col !border-0">
      <Card.Header>
        <div className="flex items-center gap-2">
          <Zap className="w-3.5 h-3.5 text-white" strokeWidth={1.5} />
          <span className="text-xs font-semibold text-text-secondary">AI extracting signals</span>
        </div>
      </Card.Header>
      <Card.Body className="flex flex-col gap-2 flex-1">
        {signals.map((s) => (
          <div key={s.label} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3 h-3 text-text-tertiary shrink-0" />
              <span className="text-[11px] text-text-secondary">{s.label}</span>
            </div>
            <span className="text-[11px] font-medium text-white tabular-nums">{s.value}</span>
          </div>
        ))}
        <div className="mt-auto pt-3 border-t border-border">
          <div className="flex justify-between text-[10px] text-text-tertiary mb-1.5">
            <span>Analysis complete</span>
            <span>100%</span>
          </div>
          <div className="h-1 rounded-full bg-surface-hover">
            <div className="h-full w-full rounded-full bg-white" />
          </div>
        </div>
      </Card.Body>
    </Card>
  );
}

function QualifiedCard() {
  return (
    <Card className="h-full flex flex-col !border-white/20">
      <Card.Header className="bg-white/5">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-3.5 h-3.5 text-white" strokeWidth={1.5} />
          <span className="text-xs font-semibold text-white">Lead qualified</span>
        </div>
        <Badge variant="success">High fit</Badge>
      </Card.Header>
      <Card.Body className="flex flex-col gap-3 flex-1">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-neutral-900 border border-border-strong flex items-center justify-center shrink-0">
            <span className="text-xl font-bold text-white leading-none">92</span>
          </div>
          <div className="flex-1">
            <div className="text-[10px] text-text-tertiary mb-1">Fit score</div>
            <div className="h-1.5 rounded-full bg-surface-hover">
              <div className="h-full rounded-full bg-white" style={{ width: '92%' }} />
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
              <span className="text-text-tertiary">{r.label}</span>
              <span className="font-medium text-white">{r.value}</span>
            </div>
          ))}
        </div>
      </Card.Body>
    </Card>
  );
}

function ReplyCard() {
  return (
    <Card className="h-full flex flex-col !border-0">
      <Card.Header>
        <div className="flex items-center gap-2">
          <Send className="w-3.5 h-3.5 text-white" strokeWidth={1.5} />
          <span className="text-xs font-semibold text-text-secondary">Reply drafted</span>
        </div>
      </Card.Header>
      <Card.Body className="flex flex-col gap-3 flex-1">
        <div className="space-y-1 text-[10px]">
          <div className="flex gap-2">
            <span className="text-text-tertiary w-6 shrink-0">To</span>
            <span className="text-white font-medium">sarah@meridiangrp.com</span>
          </div>
          <div className="flex gap-2">
            <span className="text-text-tertiary w-6 shrink-0">Re</span>
            <span className="text-white">Enterprise inquiry — NodalX</span>
          </div>
        </div>
        <div className="h-px bg-surface-hover" />
        <p className="text-[11px] text-text-secondary leading-relaxed flex-1">
          Hi Sarah, thanks for reaching out. Based on what you've shared, NodalX looks like a strong fit for your team's needs. I'd love to schedule a quick...
        </p>
        <button className="w-full py-2 rounded-md bg-white text-black text-[11px] font-semibold flex items-center justify-center gap-1.5 cursor-default">
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
    <Section border bg="bg" innerClassName="max-w-6xl mx-auto px-4 sm:px-6 md:px-12">
      <SectionHeader
        label="Product walkthrough"
        heading="Raw inquiry to qualified follow-up — in seconds."
      />

      <div className="hidden lg:grid grid-cols-4 mb-3 relative">
        <div className="absolute top-3 left-[calc(12.5%+0.75rem)] right-[calc(12.5%+0.75rem)] h-px bg-neutral-700" />
        {steps.map((s) => (
          <div key={s.number} className="flex flex-col items-center gap-2 relative">
            <div className="w-6 h-6 rounded-full bg-black border border-border-strong flex items-center justify-center z-10">
              <span className="text-[9px] font-bold text-white">{s.number}</span>
            </div>
            <span className="text-xs font-semibold text-text-secondary">{s.label}</span>
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
            <span className="text-[9px] font-bold text-white">{s.number}</span>
            <span className="text-[10px] text-text-tertiary leading-tight">{s.label}</span>
          </div>
        ))}
      </div>
    </Section>
  );
}
