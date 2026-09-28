import React from 'react';
import { ArrowRight } from 'lucide-react';
import ProductMockup from './ProductMockup';

import { Button } from '../ui';
import { Analytics } from '../lib/analytics';

interface HeroProps {
  onGetStarted: () => void;
}

export default function Hero({ onGetStarted }: HeroProps) {
  const scrollTo = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="pt-32 pb-24 sm:pt-40 sm:pb-32 lg:pt-48 lg:pb-32 bg-bg relative overflow-hidden">
      <div className="max-w-6xl mx-auto px-6 md:px-12 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">

          <div className="max-w-xl">
            <div className="g-chip inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-text-tertiary text-xs font-medium uppercase tracking-cosmos mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse-dot" />
              Now live
            </div>

            <h1 className="text-5xl sm:text-6xl lg:text-[4rem] font-bold tracking-tight text-text-primary leading-[1.05] mb-6">
              Every inquiry answered.{' '}
              Every lead scored.{' '}
              <span className="text-gradient">Nothing missed.</span>
            </h1>

            <p className="text-lg text-text-secondary leading-relaxed mb-10">
              NodalX reads every incoming inquiry, scores it against your criteria, and drafts a reply — automatically. Average first response: under 3 minutes.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                variant="primary"
                size="lg"
                onClick={() => { Analytics.ctaClick('hero'); onGetStarted(); }}
              >
                Get Early Access
                <ArrowRight className="w-4 h-4" />
              </Button>
              <Button
                variant="secondary"
                size="lg"
                onClick={(e) => { Analytics.navScrollClick('how-it-works'); scrollTo('how-it-works')(e); }}
              >
                See how it works
              </Button>
            </div>

            <p className="mt-8 text-xs text-text-tertiary tracking-wide uppercase">
              Free to start. No credit card required.
            </p>
          </div>

          <div className="hidden sm:block w-full relative">
            <div className="relative">
              <ProductMockup />
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
