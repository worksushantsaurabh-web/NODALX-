import React from 'react';
import { ArrowRight, Play, Sparkles } from 'lucide-react';
import FlowIllustration from './FlowIllustration';

interface HeroProps {
  onGetStarted: () => void;
}

export default function Hero({ onGetStarted }: HeroProps) {
  const handleBookDemo = () => {
    document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="relative pt-32 pb-16 sm:pt-36 sm:pb-20 lg:pt-48 lg:pb-28 overflow-hidden transition-colors duration-300">
      {/* Enhanced Background Gradient Mesh */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[50%] h-[50%] rounded-full bg-gradient-to-br from-teal-400/15 to-blue-500/15 dark:from-teal-600/15 dark:to-blue-800/15 blur-[100px] animate-pulse-slow"></div>
        <div className="absolute top-[20%] -right-[10%] w-[35%] h-[50%] rounded-full bg-gradient-to-bl from-purple-400/15 to-teal-300/15 dark:from-purple-600/15 dark:to-teal-800/15 blur-[100px] animate-float" style={{ animationDelay: '1s' }}></div>
        <div className="absolute -bottom-[10%] left-[20%] w-[45%] h-[45%] rounded-full bg-gradient-to-tr from-blue-400/15 to-teal-400/15 dark:from-blue-800/15 dark:to-teal-600/15 blur-[100px] animate-float" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          
          {/* Text Content */}
          <div className="max-w-xl lg:max-w-2xl animate-fade-in-up">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-teal-100/80 dark:border-teal-800/40 text-teal-700 dark:text-teal-300 text-sm font-medium mb-6 sm:mb-8 shadow-sm hover:shadow-md transition-all cursor-default glass-shine">
              <Sparkles className="w-3.5 h-3.5 text-teal-500" />
              Introducing NODALxAI 1.0
            </div>
            
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.15] sm:leading-[1.2] mb-5 sm:mb-6 py-1">
              AI-Powered <br className="hidden sm:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-600 to-teal-400 dark:from-teal-400 dark:to-teal-200">
                Business Inquiry
              </span>{' '}
              Assistant
            </h1>
            
            <p className="text-base sm:text-lg lg:text-xl text-slate-600 dark:text-slate-400 mb-8 sm:mb-10 leading-relaxed max-w-lg">
              Capture customer inquiries, qualify leads with AI, and automate follow-ups in minutes.
            </p>
            
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
              <button 
                onClick={onGetStarted}
                className="relative px-7 sm:px-8 py-3.5 sm:py-4 rounded-xl sm:rounded-full bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-700 hover:to-teal-600 text-white font-semibold text-base sm:text-lg transition-all shadow-lg shadow-teal-600/25 hover:shadow-teal-600/40 hover:-translate-y-0.5 flex items-center justify-center gap-2 group overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
                Get Started
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
              
              <button 
                onClick={handleBookDemo}
                className="px-7 sm:px-8 py-3.5 sm:py-4 rounded-xl sm:rounded-full bg-white/70 dark:bg-slate-900/70 backdrop-blur-md hover:bg-white dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-white/10 font-semibold text-base sm:text-lg transition-all shadow-sm hover:shadow-lg hover:-translate-y-0.5 flex items-center justify-center gap-2 group"
              >
                <Play className="w-5 h-5 text-slate-400 dark:text-slate-500 group-hover:text-teal-500 transition-colors" fill="currentColor" />
                Book Demo
              </button>
            </div>
            
            <div className="mt-8 sm:mt-12 flex items-center gap-3 sm:gap-4 text-sm text-slate-500 dark:text-slate-400">
              <div className="flex -space-x-2.5">
                {[1, 2, 3, 4].map((i) => (
                  <img 
                    key={i}
                    src={`https://i.pravatar.cc/100?img=${i + 10}`} 
                    alt="User avatar" 
                    className="w-8 h-8 rounded-full border-2 border-white dark:border-slate-950 shadow-sm hover:-translate-y-1 transition-transform relative z-10 hover:z-20"
                  />
                ))}
              </div>
              <p>Trusted by 1,000+ modern teams</p>
            </div>
          </div>

          {/* Illustration */}
          <div className="relative lg:h-[500px] xl:h-[600px] flex items-center justify-center animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            <FlowIllustration />
          </div>

        </div>
      </div>
    </section>
  );
}
