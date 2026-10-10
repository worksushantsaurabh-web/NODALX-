import { ArrowRight } from 'lucide-react';
import ProductMockup from './ProductMockup';
import { Button } from '../ui';
import { Analytics } from '../lib/analytics';
import { BlurFade } from '../ui/BlurFade';

interface HeroProps {
  onGetStarted: () => void;
}

export default function Hero({ onGetStarted }: HeroProps) {
  const showHowItWorks = () => {
    Analytics.navScrollClick('how-it-works');
    document.getElementById('how-it-works')?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
  };

  return (
    <section className="bg-bg border-b border-border pt-32 pb-20 sm:pt-40 sm:pb-24 lg:pt-44 lg:pb-28">
      <div className="max-w-7xl mx-auto px-5 sm:px-6 md:px-12">
        <div className="grid lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] gap-12 lg:gap-14 xl:gap-20 items-center">
          <div className="max-w-2xl">
            <BlurFade><p className="text-xs font-semibold tracking-[0.16em] uppercase text-accent mb-6">Inquiry operations, made clearer</p></BlurFade>
            <BlurFade delay={0.06}>
              <h1 className="text-[clamp(2.8rem,5vw,4.75rem)] font-semibold tracking-[-0.045em] leading-[1.08] text-text-primary mb-7">
                Give every inquiry a thoughtful next step.
              </h1>
            </BlurFade>
            <BlurFade delay={0.12}>
              <p className="text-lg sm:text-xl text-text-secondary leading-relaxed max-w-xl">
                NodalX helps your team review incoming inquiries, identify fit against your criteria, and prepare a relevant reply—all in one place.
              </p>
            </BlurFade>
            <BlurFade delay={0.18} className="flex flex-col sm:flex-row sm:items-center gap-3 mt-9">
              <Button
                variant="primary"
                size="lg"
                className="!rounded-lg !bg-accent !shadow-none hover:!shadow-none hover:!translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                onClick={() => { Analytics.ctaClick('hero'); onGetStarted(); }}
              >
                Get Early Access <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Button>
              <Button
                variant="secondary"
                size="lg"
                className="!rounded-lg !bg-surface !border-border !backdrop-blur-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                onClick={showHowItWorks}
              >
                See how it works
              </Button>
            </BlurFade>
            <p className="mt-5 text-sm text-text-tertiary">Explore the workflow before requesting access.</p>
          </div>
          <div className="min-w-0 w-full">
            <BlurFade delay={0.14}><ProductMockup /></BlurFade>
          </div>
        </div>
      </div>
    </section>
  );
}
