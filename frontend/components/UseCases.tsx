import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import { Section, SectionHeader } from '../ui';
import { useCases } from '../data/useCases';

export default function UseCases() {
  return (
    <Section bg="surface" border innerClassName="max-w-6xl mx-auto px-4 sm:px-6 md:px-12">
      <SectionHeader
        label="Who it's for"
        heading="Built for teams that can't afford to miss a lead."
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {useCases.map((uc) => (
          <div
            key={uc.id}
            className="flex flex-col rounded-xl border border-border bg-surface overflow-hidden transition-all duration-200 hover:-translate-y-0.5"
          >
            <div className="px-5 py-4 border-b border-border">
              <p className="text-xs font-medium text-text-tertiary mb-1">{uc.companyType}</p>
              <h3 className="text-sm font-bold text-white">{uc.persona}</h3>
            </div>

            <div className="p-5 flex flex-col gap-4 flex-1">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary mb-1.5">The problem</p>
                <p className="text-sm text-text-secondary leading-relaxed">{uc.problem}</p>
              </div>

              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary mb-1.5">The outcome</p>
                <p className="text-sm text-neutral-300 leading-relaxed">{uc.outcome}</p>
              </div>

              {uc.caseStudy && (
                <blockquote className="mt-auto pt-4 border-t border-border">
                  <p className="text-sm text-neutral-200 leading-relaxed italic mb-3">
                    "{uc.caseStudy.quote}"
                  </p>
                  <footer className="text-xs text-text-tertiary">
                    <span className="font-semibold text-neutral-300">{uc.caseStudy.author}</span>
                    {' · '}{uc.caseStudy.role}, {uc.caseStudy.company}
                  </footer>
                </blockquote>
              )}
            </div>

            <div className="px-5 py-3 border-t border-border bg-surface flex items-center justify-between">
              <div>
                <span className="text-lg font-bold text-white">{uc.metric.value}</span>
                <span className="text-xs text-text-tertiary ml-1.5">{uc.metric.label}</span>
              </div>
              {uc.caseStudy && (
                <span className="text-xs text-text-tertiary flex items-center gap-1">
                  {uc.caseStudy.company} <ArrowUpRight className="w-3 h-3" />
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}
