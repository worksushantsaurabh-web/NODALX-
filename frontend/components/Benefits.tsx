import React from 'react';
import { Zap, Target, Send, FileSpreadsheet, Clock, Wrench, CheckCircle2 } from 'lucide-react';

const benefits = [
  {
    title: 'Instant AI Qualification',
    description: 'Automatically score and categorize leads the second they submit an inquiry.',
    icon: Zap,
    color: 'text-amber-600',
    bgColor: 'bg-amber-100/80',
    borderColor: 'border-amber-200/60',
  },
  {
    title: 'Never Miss a Lead',
    description: 'Capture every opportunity with zero downtime and instant routing to your team.',
    icon: Target,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100/80',
    borderColor: 'border-blue-200/60',
  },
  {
    title: 'Automatic Email Replies',
    description: 'Engage prospects immediately with context-aware, personalized email responses.',
    icon: Send,
    color: 'text-purple-600',
    bgColor: 'bg-purple-100/80',
    borderColor: 'border-purple-200/60',
  },
  {
    title: 'Google Sheets Integration',
    description: 'Keep your data organized by syncing all inquiries directly to your spreadsheets.',
    icon: FileSpreadsheet,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-100/80',
    borderColor: 'border-emerald-200/60',
  },
  {
    title: 'Works 24/7',
    description: 'Your AI assistant never sleeps, ensuring global customers get immediate attention.',
    icon: Clock,
    color: 'text-rose-600',
    bgColor: 'bg-rose-100/80',
    borderColor: 'border-rose-200/60',
  },
  {
    title: 'Easy Setup',
    description: 'Get up and running in minutes with our intuitive, no-code configuration.',
    icon: Wrench,
    color: 'text-slate-600',
    bgColor: 'bg-slate-100/80',
    borderColor: 'border-slate-200/60',
  },
];

export default function Benefits() {
  return (
    <section className="relative py-20 sm:py-24 lg:py-32 bg-slate-50/50 dark:bg-slate-950/50 overflow-hidden border-t border-slate-100 dark:border-slate-800/50 transition-colors duration-300">
      {/* Subtle Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -right-64 w-96 h-96 bg-teal-100/30 dark:bg-teal-900/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 -left-64 w-96 h-96 bg-blue-50/40 dark:bg-blue-900/10 rounded-full blur-3xl"></div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16 lg:mb-24 animate-fade-in-up">
          <h2 className="text-sm font-bold tracking-widest text-teal-600 dark:text-teal-400 uppercase mb-3 flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            The NODALxAI Advantage
          </h2>
          <h3 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-4 sm:mb-6">
            Why Businesses Choose NODALxAI
          </h3>
          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-400 leading-relaxed">
            We've built the ultimate tool to help modern teams scale their inbound sales without adding headcount.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
          {benefits.map((benefit, index) => (
            <div
              key={benefit.title}
              className="group relative bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl rounded-2xl sm:rounded-3xl p-6 sm:p-8 border border-white/40 dark:border-white/5 shadow-sm hover:shadow-xl hover:shadow-slate-200/40 dark:hover:shadow-black/20 transition-all duration-500 hover:-translate-y-1.5 animate-fade-in-up glass-shine"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {/* Icon Container */}
              <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl ${benefit.bgColor} border ${benefit.borderColor} flex items-center justify-center mb-5 sm:mb-6 group-hover:scale-110 transition-transform duration-300`}>
                <benefit.icon className={`w-6 h-6 sm:w-7 sm:h-7 ${benefit.color}`} strokeWidth={1.5} />
              </div>
              
              {/* Content */}
              <h4 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mb-2 sm:mb-3 tracking-tight">
                {benefit.title}
              </h4>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-sm">
                {benefit.description}
              </p>

              {/* Subtle hover glow */}
              <div className="absolute inset-0 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-teal-500/0 to-teal-500/0 group-hover:from-teal-500/[0.03] group-hover:to-blue-500/[0.03] transition-all duration-500 pointer-events-none"></div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}