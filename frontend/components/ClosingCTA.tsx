import React from 'react';
import { ArrowRight } from 'lucide-react';
import { Button } from '../ui';
import { Analytics } from '../lib/analytics';

interface ClosingCTAProps {
  onGetStarted: () => void;
}

export default function ClosingCTA({ onGetStarted }: ClosingCTAProps) {
  return (
    <section className="bg-surface py-20 sm:py-28 border-t border-border">
      <div className="max-w-3xl mx-auto px-5 sm:px-6 md:px-12 text-center">
        <p className="text-xs font-semibold tracking-[0.16em] uppercase text-accent mb-5">Next steps</p>
        <h2 className="text-3xl sm:text-4xl font-semibold text-text-primary tracking-tight mb-5 leading-tight">
          Make room for more thoughtful follow-up.
        </h2>
        <p className="text-base text-text-secondary mb-8 max-w-xl mx-auto leading-relaxed">
          See how a more organized inquiry workflow could work for your team. Request early access to get started.
        </p>
        <Button
          variant="primary"
          size="lg"
          onClick={() => { Analytics.ctaClick('closing_cta'); onGetStarted(); }}
          className="!rounded-lg !bg-accent !shadow-none hover:!shadow-none hover:!translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Get Early Access
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </section>
  );
}
