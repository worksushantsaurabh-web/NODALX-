import React from 'react';
import { Section, SectionHeader } from '../ui';

const problems = [
  {
    stat: 'Scattered',
    claim: 'Requests arrive in different places.',
    detail: 'A shared view of incoming work helps you decide what to review next.',
  },
  {
    stat: 'Manual',
    claim: 'Copying and categorizing takes attention.',
    detail: 'Import existing records and keep their original messages available for review.',
  },
  {
    stat: 'Unclear',
    claim: 'Follow-up needs an explicit next step.',
    detail: 'Record status and follow-up dates instead of relying on memory.',
  },
];

export default function Problem() {
  return (
    <Section id="problem" bg="bg">
      <SectionHeader
        label="The cost of slow follow-up"
        heading={`Qualified leads don't wait.\nYour inbox does.`}
      />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-surface-hover rounded-xl overflow-hidden border border-border">
        {problems.map((p) => (
          <div key={p.stat} className="bg-bg p-8">
            <p className="text-3xl font-bold text-text-primary mb-3 tracking-tight">
              {p.stat}
            </p>
            <p className="font-semibold text-text-primary text-sm mb-2 leading-snug">{p.claim}</p>
            <p className="text-sm text-text-secondary leading-relaxed">{p.detail}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}
