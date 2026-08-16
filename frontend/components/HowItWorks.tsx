import React from 'react';
import { Section, SectionHeader } from '../ui';

const steps = [
  {
    number: '01',
    title: 'Connect your inquiry channel',
    description:
      'Embed the NODALxAI form on your site, or forward submissions from your existing contact form to our intake endpoint. No developer required after initial setup.',
  },
  {
    number: '02',
    title: 'Inquiries get read, scored, and routed',
    description:
      'Each submission is analyzed against your qualification criteria — budget fit, company size, urgency signals. Scored, categorized, and logged automatically.',
  },
  {
    number: '03',
    title: 'A personalized draft reply appears',
    description:
      'Not a template. A reply drafted to the specific inquiry. Review it, edit it, approve it — or set a confidence threshold and let it go out automatically.',
  },
];

export default function HowItWorks() {
  return (
    <Section id="how-it-works" bg="muted" border>
      <SectionHeader
        label="How it works"
        heading="Three steps. No new workflows."
      />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-10 lg:gap-12">
        {steps.map((step) => (
          <div key={step.number}>
            <span className="text-xs font-bold text-neutral-300 dark:text-neutral-700 tracking-widest">
              {step.number}
            </span>
            <div className="w-8 h-px bg-black dark:bg-white mt-3 mb-4" />
            <h3 className="text-base font-semibold text-black dark:text-white mb-2">{step.title}</h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">{step.description}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}
