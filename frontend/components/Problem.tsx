import React from 'react';
import { Section, SectionHeader } from '../ui';

const problems = [
  {
    stat: '78%',
    claim: 'of B2B buyers choose the first vendor that responds.',
    detail: 'Most teams take hours. Your response time is your competitive moat — or your blind spot.',
  },
  {
    stat: '20–40 min',
    claim: 'lost to manual triage per inquiry.',
    detail: 'Reading, categorizing, copy-pasting into a CRM. Every single time. For every submission.',
  },
  {
    stat: '1 in 3',
    claim: 'inquiries never gets a personalized reply.',
    detail: 'Generic templates or silence. Both kill deals before a conversation starts.',
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
            <p className="text-3xl font-bold text-white mb-3 tracking-tight">
              {p.stat}
            </p>
            <p className="font-semibold text-white text-sm mb-2 leading-snug">{p.claim}</p>
            <p className="text-sm text-text-secondary leading-relaxed">{p.detail}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}
