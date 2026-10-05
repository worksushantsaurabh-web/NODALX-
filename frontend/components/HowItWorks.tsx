import React from 'react';
import { Section, SectionHeader } from '../ui';

const steps = [
  {
    number: '01',
    title: 'Connect your inquiry channel',
    description:
      'Forward inquiries from your form server or trusted automation to the authenticated intake endpoint. Initial connection may need developer assistance.',
  },
  {
    number: '02',
    title: 'Keep the original and review signals',
    description:
      'The inquiry is saved first. If processing is configured, qualification results appear alongside the original message; failures stay visible.',
  },
  {
    number: '03',
    title: 'Choose the next action',
    description:
      'Review any available draft, open it in your email app, and record status or a follow-up date. Sending remains a human action.',
  },
];

export default function HowItWorks() {
  return (
    <Section id="how-it-works" bg="surface" border>
      <SectionHeader
        label="How it works"
        heading="Three steps. No new workflows."
      />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-10 lg:gap-12">
        {steps.map((step) => (
          <div key={step.number}>
            <span className="text-xs font-bold text-text-tertiary tracking-widest">
              {step.number}
            </span>
            <div className="w-8 h-px bg-border mt-3 mb-4" />
            <h3 className="text-base font-semibold leading-6 text-text-primary mb-2 md:min-h-12">{step.title}</h3>
            <p className="text-sm text-text-secondary leading-relaxed">{step.description}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}
