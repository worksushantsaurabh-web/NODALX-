import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import { Section, SectionHeader } from '../ui';
import { useCases } from '../data/useCases';

export default function UseCases() {
  return (
    <Section bg="muted" border innerClassName="max-w-6xl mx-auto px-4 sm:px-6 md:px-12">
      <SectionHeader
        label="Who it's for"
        heading="Built for teams that can't afford to miss a lead."
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {useCases.map((uc) => (
          <div
            key={uc.id}
            className="flex flex-col rounded-xl glass-card overflow-hidden transition-all duration-200 hover:-translate-y-0.5"
          >
            <div className="px-5 py-4 border-b border-neutral-100 dark:border-neutral-800">
              <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">{uc.companyType}</p>
              <h3 className="text-sm font-bold text-black dark:text-white">{uc.persona}</h3>
            </div>

            <div className="p-5 flex flex-col gap-4 flex-1">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">The problem</p>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">{uc.problem}</p>
              </div>

              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">The outcome</p>
                <p className="text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed">{uc.outcome}</p>
              </div>

              {uc.caseStudy && (
                <blockquote className="mt-auto pt-4 border-t border-neutral-100 dark:border-neutral-800">
                  <p className="text-sm text-neutral-700 dark:text-neutral-200 leading-relaxed italic mb-3">
                    "{uc.caseStudy.quote}"
                  </p>
                  <footer className="text-xs text-neutral-500 dark:text-neutral-400">
                    <span className="font-semibold text-neutral-700 dark:text-neutral-300">{uc.caseStudy.author}</span>
                    {' · '}{uc.caseStudy.role}, {uc.caseStudy.company}
                  </footer>
                </blockquote>
              )}
            </div>

            <div className="px-5 py-3 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 flex items-center justify-between">
              <div>
                <span className="text-lg font-bold text-black dark:text-white">{uc.metric.value}</span>
                <span className="text-xs text-neutral-400 ml-1.5">{uc.metric.label}</span>
              </div>
              {uc.caseStudy && (
                <span className="text-xs text-neutral-400 flex items-center gap-1">
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
