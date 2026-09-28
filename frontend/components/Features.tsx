import React from 'react';
import { SlidersHorizontal, MessageSquare, LayoutDashboard, Plug, Code2, FileCheck } from 'lucide-react';
import { Section, SectionHeader } from '../ui';

const features = [
  {
    icon: SlidersHorizontal,
    title: 'Configurable qualification',
    description:
      'Set scoring criteria in plain language — budget range, company size, urgency signals. Your rules, applied consistently, with a score and a reason for every result.',
  },
  {
    icon: MessageSquare,
    title: 'Context-aware reply drafts',
    description:
      'Each draft references the actual inquiry. Not a template. Not a macro. Something a thoughtful rep would send, ready to approve in one click.',
  },
  {
    icon: LayoutDashboard,
    title: 'Live pipeline dashboard',
    description:
      'Track inquiry volume, average response time, and conversion rate in real time. No separate analytics tool needed.',
  },
  {
    icon: Plug,
    title: 'Integrations that actually work',
    description:
      'Google Sheets, email, and Slack sync automatically. Every lead record, every reply, every status update — without manual exports.',
  },
  {
    icon: Code2,
    title: 'Embeddable in 2 minutes',
    description:
      'Drop one script tag on your site. Customize the fields. Done. Your web team does not need to get involved after that.',
  },
  {
    icon: FileCheck,
    title: 'Full audit trail',
    description:
      'Every action logged. Every AI decision traceable. So you can explain a reply, review a flag, or escalate a deal without guessing what happened.',
  },
];

export default function Features() {
  return (
    <Section id="features" bg="bg" innerClassName="max-w-6xl mx-auto px-4 sm:px-6 md:px-12">
      <SectionHeader
        label="What you get"
        heading="Built for teams that close deals, not manage inboxes."
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {features.map((feature) => (
          <div key={feature.title} className="g-card rounded-2xl p-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-accent-2 flex items-center justify-center mb-4 shadow-lg">
              <feature.icon className="w-4.5 h-4.5 text-[#fff]" strokeWidth={1.5} />
            </div>
            <h3 className="text-sm font-semibold text-text-primary mb-2">{feature.title}</h3>
            <p className="text-sm text-text-secondary leading-relaxed">{feature.description}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}
