import React from 'react';
import { ArrowRight } from 'lucide-react';
import { Button } from '../ui';
import { Analytics } from '../lib/analytics';

interface ClosingCTAProps {
  onGetStarted: () => void;
}

export default function ClosingCTA({ onGetStarted }: ClosingCTAProps) {
  return (
    <section className="py-24 lg:py-28 bg-black dark:bg-white border-t border-neutral-800 dark:border-neutral-200">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 md:px-12 text-center">
        <h2 className="text-3xl sm:text-4xl font-bold text-white dark:text-black tracking-tight mb-5 leading-tight">
          Handle every inquiry like your best rep is on call — 24 hours a day.
        </h2>
        <p className="text-base text-neutral-400 dark:text-neutral-600 mb-8 max-w-xl mx-auto leading-relaxed">
          No missed leads. No generic replies. No spreadsheets to update by hand. Just qualified, responded, and ready to close.
        </p>
        <Button
          variant="secondary"
          size="lg"
          onClick={() => { Analytics.ctaClick('closing_cta'); onGetStarted(); }}
          className="bg-white text-black hover:bg-neutral-100 border-white dark:bg-black dark:text-white dark:hover:bg-neutral-900 dark:border-black"
        >
          Get Early Access
          <ArrowRight className="w-4 h-4" />
        </Button>
        <p className="mt-4 text-xs text-neutral-500">Free to start. No credit card required.</p>
      </div>
    </section>
  );
}
