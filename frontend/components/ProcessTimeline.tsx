import React from 'react';
import { MousePointerClick, Sparkles, BellRing, MailCheck, ArrowRight, ArrowDown } from 'lucide-react';

const steps = [
  {
    id: 1,
    title: 'Customer submits inquiry',
    description: 'The form data is securely captured and encrypted.',
    icon: MousePointerClick,
  },
  {
    id: 2,
    title: 'AI analyzes the request',
    description: 'NODALxAI categorizes intent, urgency, and budget.',
    icon: Sparkles,
  },
  {
    id: 3,
    title: 'Business receives instant notification',
    description: 'The right team member is pinged via Slack or Email.',
    icon: BellRing,
  },
  {
    id: 4,
    title: 'Customer receives confirmation email',
    description: 'A personalized, context-aware reply is sent instantly.',
    icon: MailCheck,
  },
];

export default function ProcessTimeline() {
  return (
    <section className="relative py-24 lg:py-32 bg-slate-50/50 overflow-hidden border-t border-slate-100">
      {/* Decorative Background */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-5xl h-full pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-teal-100/40 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-50/50 rounded-full blur-3xl"></div>
      </div>

      <div className="max-w-7xl mx-auto px-6 md:px-12 relative z-10">
        <div className="text-center max-w-2xl mx-auto mb-16 lg:mb-24 animate-fade-in-up">
          <h2 className="text-sm font-bold tracking-widest text-teal-600 dark:text-teal-500 uppercase mb-3">
            The Workflow
          </h2>
          <h3 className="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            What Happens Next?
          </h3>
        </div>

        <div className="flex flex-col lg:flex-row items-center lg:items-stretch justify-between gap-4 lg:gap-2">
          {steps.map((step, index) => (
            <React.Fragment key={step.id}>
              {/* Step Card */}
              <div 
                className="flex-1 w-full max-w-sm lg:max-w-none bg-white/80 backdrop-blur-xl rounded-3xl p-8 border border-slate-200/60 shadow-sm hover:shadow-2xl hover:shadow-teal-600/10 transition-all duration-500 group relative animate-fade-in-up"
                style={{ animationDelay: `${index * 0.15}s` }}
              >
                {/* Hover Gradient Overlay */}
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-teal-50/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
                
                <div className="relative z-10 flex flex-col h-full">
                  <div className="flex items-center justify-between mb-6">
                    <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 text-teal-600 flex items-center justify-center group-hover:scale-110 group-hover:bg-teal-600 group-hover:text-white transition-all duration-500 shadow-sm">
                      <step.icon strokeWidth={1.5} className="w-6 h-6" />
                    </div>
                    <span className="text-sm font-bold text-slate-300 group-hover:text-teal-200 transition-colors">
                      0{step.id}
                    </span>
                  </div>
                  
                  <div className="mt-auto">
                    <div className="text-xs font-bold text-teal-600 uppercase tracking-wider mb-2">
                      Step {step.id}
                    </div>
                    <h4 className="text-lg font-bold text-slate-900 leading-snug mb-2">
                      {step.title}
                    </h4>
                    <p className="text-sm text-slate-500 leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </div>
              </div>

              {/* Connecting Arrow */}
              {index < steps.length - 1 && (
                <div 
                  className="flex items-center justify-center text-slate-300 animate-fade-in-up"
                  style={{ animationDelay: `${index * 0.15 + 0.1}s` }}
                >
                  <ArrowRight className="hidden lg:block w-6 h-6 flex-shrink-0 mx-2" />
                  <ArrowDown className="block lg:hidden w-6 h-6 flex-shrink-0 my-2" />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    </section>
  );
}