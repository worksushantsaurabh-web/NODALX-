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
    <section className="pt-28 pb-16 sm:pt-32 sm:pb-20 lg:pt-40 lg:pb-24 bg-white dark:bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">

          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-xs font-medium mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
              Now live — sign up for early access
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-[3.25rem] font-bold tracking-tight text-slate-900 dark:text-white leading-[1.1] mb-5">
              Every inquiry answered.{' '}
              Every lead scored.{' '}
              <span className="text-teal-600 dark:text-teal-400">Nothing missed.</span>
            </h1>

            <p className="text-lg text-slate-500 dark:text-slate-400 leading-relaxed mb-8">
              NODALxAI reads every incoming inquiry, scores it against your criteria, and drafts a reply — automatically. Average first response: under 3 minutes.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="primary"
                size="lg"
                onClick={() => { Analytics.ctaClick('hero'); onGetStarted(); }}
              >
                Get Early Access
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </Button>
              <Button
                variant="secondary"
                size="lg"
                onClick={(e) => { Analytics.navScrollClick('how-it-works'); scrollTo('how-it-works')(e); }}
              >
                See how it works
              </Button>
            </div>

            <p className="mt-6 text-xs text-slate-400 dark:text-slate-500">
              Free to start. No credit card required.
            </p>
          </div>

          <div className="hidden sm:block w-full relative">
            <div className="absolute -inset-3 bg-teal-400/8 dark:bg-teal-500/10 rounded-2xl blur-2xl pointer-events-none" />
            <div className="relative">
              <ProductMockup />
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
