import React from 'react';
import { ArrowRight } from 'lucide-react';
import { Button } from '../ui';
import { Analytics } from '../lib/analytics';

interface ClosingCTAProps {
  onGetStarted: () => void;
}

export default function ClosingCTA({ onGetStarted }: ClosingCTAProps) {
  return (
    <section className="relative py-32 lg:py-40 overflow-hidden border-t border-border">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 md:px-12 text-center relative z-10">
        <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mb-5 leading-tight">
          Handle every inquiry like your best rep is on call — 24 hours a day.
        </h2>
        <p className="text-base text-text-secondary mb-8 max-w-xl mx-auto leading-relaxed">
          No missed leads. No generic replies. No spreadsheets to update by hand. Just qualified, responded, and ready to close.
        </p>
        <Button
          variant="primary"
          size="lg"
          onClick={() => { Analytics.ctaClick('closing_cta'); onGetStarted(); }}
          className="rounded-md"
        >
          Get Early Access
          <ArrowRight className="w-4 h-4" />
        </Button>
        <p className="mt-4 text-xs text-text-tertiary">Free to start. No credit card required.</p>
      </div>
    </section>
  );
}
