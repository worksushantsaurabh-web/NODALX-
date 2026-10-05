import React from 'react';
import { FileText, ListFilter, MessageSquareText, ScanSearch } from 'lucide-react';
import { BlurFade } from '../ui/BlurFade';

const steps = [
  { number: '01', icon: FileText, title: 'An inquiry arrives', description: 'Bring a new contact request into one review queue.' },
  { number: '02', icon: ScanSearch, title: 'Find the signals', description: 'Pull out context such as the request, company, and timing.' },
  { number: '03', icon: ListFilter, title: 'Assess the fit', description: 'See how the inquiry relates to your qualification criteria.' },
  { number: '04', icon: MessageSquareText, title: 'Prepare a reply', description: 'Start from a contextual draft, then review before sending.' },
];

export default function WorkflowPreview() {
  return (
    <section className="border-t border-border bg-bg py-20 sm:py-24 lg:py-28" aria-labelledby="workflow-heading">
      <div className="max-w-7xl mx-auto px-5 sm:px-6 md:px-12">
        <div className="max-w-2xl mb-10 sm:mb-14">
          <p className="text-xs font-semibold tracking-[0.16em] uppercase text-accent mb-4">Product walkthrough</p>
          <h2 id="workflow-heading" className="text-3xl sm:text-4xl font-semibold tracking-tight leading-tight text-text-primary">From first contact to a considered follow-up.</h2>
          <p className="mt-4 text-base text-text-secondary leading-relaxed">A simple view of the workflow. The content below is an example, not a live product session.</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
          {steps.map((step) => (
            <BlurFade key={step.number} inView delay={Number(step.number) * 0.04} className="h-full">
              <article className="rounded-xl border border-border bg-surface p-5 sm:p-6 flex flex-col min-h-[216px] h-full transition-colors duration-200 hover:border-border-strong">
                <div className="flex items-center justify-between gap-2 mb-10">
                  <span className="text-xs font-semibold tracking-widest text-text-tertiary">{step.number} / 04</span>
                  <step.icon className="w-5 h-5 text-accent" strokeWidth={1.6} aria-hidden="true" />
                </div>
                <h3 className="text-base font-semibold text-text-primary mb-2">{step.title}</h3>
                <p className="text-sm text-text-secondary leading-relaxed">{step.description}</p>
              </article>
            </BlurFade>
          ))}
        </div>

        <div className="mt-5 rounded-xl border border-border bg-surface p-5 sm:p-6 grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div>
            <span className="text-[11px] uppercase tracking-wider font-semibold text-text-tertiary">Example inquiry</span>
            <p className="mt-3 text-sm leading-relaxed text-text-primary">“We’re looking for a better way to organize inbound requests and follow up with potential customers.”</p>
            <p className="mt-3 text-xs text-text-tertiary">Sample content · Meridian Group</p>
          </div>
          <div className="md:border-l md:border-border md:pl-6">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-text-tertiary">Example draft</span>
            <p className="mt-3 text-sm leading-relaxed text-text-primary">“Thanks for reaching out. I’d be glad to learn more about your inbound workflow and what you’d like to improve.”</p>
            <p className="mt-3 text-xs text-text-tertiary">Draft for human review · Not sent</p>
          </div>
        </div>
      </div>
    </section>
  );
}
