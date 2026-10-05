import React from 'react';
import { SlidersHorizontal, MessageSquare, LayoutDashboard, Plug, Code2, FileCheck } from 'lucide-react';
import { Section, SectionHeader } from '../ui';

const features = [
  {
    icon: SlidersHorizontal,
    title: 'Optional qualification',
    description:
      'Use a configured processing workflow to return qualification signals. Missing or failed analysis remains visible for human review.',
  },
  {
    icon: MessageSquare,
    title: 'Context-aware reply drafts',
    description:
      'Where a workflow supplies a draft, review it alongside the original message and open an email draft. NodalX does not send it for you.',
  },
  {
    icon: LayoutDashboard,
    title: 'Inquiry operations dashboard',
    description:
      'Review inquiry counts, recorded statuses, processing failures, and overdue follow-ups. These are operational records, not proof of delivery or revenue.',
  },
  {
    icon: Plug,
    title: 'Focused connections',
    description:
      'Import Google Sheets deliberately, export results when permissions allow, and configure optional Slack notifications. There is no continuous email or CRM sync.',
  },
  {
    icon: Code2,
    title: 'Server-side intake',
    description:
      'Connect your form server or trusted automation to the intake API. Keep the workspace key out of browser code and reuse idempotency keys on retries.',
  },
  {
    icon: FileCheck,
    title: 'Visible processing history',
    description:
      'Review import jobs, recorded results, and processing errors. Investigate failures without losing the original inquiry.',
  },
];

export default function Features() {
  return (
    <Section id="features" bg="bg">
      <SectionHeader
        label="What you get"
        heading="Built for teams that close deals, not manage inboxes."
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {features.map((feature) => (
          <div key={feature.title} className="g-card min-w-0 h-full rounded-2xl p-5 sm:p-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-accent-2 flex items-center justify-center mb-4 shadow-lg">
              <feature.icon className="w-5 h-5 shrink-0 text-[#fff]" strokeWidth={1.5} />
            </div>
            <h3 className="text-sm font-semibold leading-5 text-text-primary mb-2 sm:min-h-10">{feature.title}</h3>
            <p className="text-sm text-text-secondary leading-relaxed">{feature.description}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}
