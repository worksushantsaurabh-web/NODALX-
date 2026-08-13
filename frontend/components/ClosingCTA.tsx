import React from 'react';
import { ArrowRight } from 'lucide-react';
import { Button } from '../ui';
import { Analytics } from '../lib/analytics';

interface ClosingCTAProps {
  onGetStarted: () => void;
}

export default function ClosingCTA({ onGetStarted }: ClosingCTAProps) {
  return (
    <section className="py-24 lg:py-28 bg-slate-900 dark:bg-slate-950 border-t border-slate-800">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 md:px-12 text-center">
        <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mb-5 leading-tight">
          Handle every inquiry like your best rep is on call — 24 hours a day.
        </h2>
        <p className="text-base text-slate-400 mb-8 max-w-xl mx-auto leading-relaxed">
          No missed leads. No generic replies. No spreadsheets to update by hand. Just qualified, responded, and ready to close.
        </p>
        <Button variant="primary" size="lg" onClick={() => { Analytics.ctaClick('closing_cta'); onGetStarted(); }} className="bg-teal-600 hover:bg-teal-700">
          Get Early Access
          <ArrowRight className="w-4 h-4" />
        </Button>
        <p className="mt-4 text-xs text-slate-600">Free to start. No credit card required.</p>
      </div>
    </section>
  );
}
