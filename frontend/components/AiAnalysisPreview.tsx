import React from 'react';
import { Sparkles, Flame, Wallet, AlertCircle, PhoneCall, ChevronRight, Activity, CheckCircle2 } from 'lucide-react';

export default function AiAnalysisPreview() {
  return (
    <section id="ai-analysis" className="relative py-24 lg:py-32 bg-neutral-50/30 dark:bg-neutral-950 border-t border-neutral-100 dark:border-neutral-800/50 overflow-hidden transition-colors duration-300">
      {/* Subtle Background Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-full pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-neutral-50/50 dark:bg-neutral-900/10 rounded-full blur-3xl animate-pulse-slow"></div>
      </div>

      <div className="max-w-5xl mx-auto px-6 md:px-12 relative z-10">
        <div className="text-center max-w-2xl mx-auto mb-16 animate-fade-in-up">
          <h2 className="text-xs font-bold tracking-widest text-neutral-600 dark:text-neutral-400 uppercase mb-3 flex items-center justify-center gap-2">
            <Activity className="w-4 h-4 animate-pulse" />
            Live Preview
          </h2>
          <h3 className="text-3xl md:text-4xl font-extrabold text-neutral-900 dark:text-white tracking-tight mb-4">
            Instant AI Analysis
          </h3>
          <p className="text-lg text-neutral-500 dark:text-neutral-400 leading-relaxed">
            See how NODALxAI processes inquiries in real-time, extracting key data and recommending the next best action for your team.
          </p>
        </div>

        {/* Dashboard UI Mockup */}
        <div className="relative mx-auto max-w-4xl animate-fade-in-up group" style={{ animationDelay: '0.2s' }}>
          {/* Main Card */}
          <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 shadow-2xl shadow-neutral-200/40 dark:shadow-none overflow-hidden flex flex-col transition-all duration-500 group-hover:shadow-3xl group-hover:-translate-y-1">
            
            {/* Mock Browser/App Header */}
            <div className="bg-neutral-50/80 dark:bg-neutral-950/50 border-b border-neutral-200/80 dark:border-neutral-800 px-5 py-3 flex items-center justify-between backdrop-blur-sm">
              <div className="flex items-center gap-4">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-neutral-300 dark:bg-neutral-700"></div>
                  <div className="w-3 h-3 rounded-full bg-neutral-300 dark:bg-neutral-700"></div>
                  <div className="w-3 h-3 rounded-full bg-neutral-300 dark:bg-neutral-700"></div>
                </div>
                <div className="px-2.5 py-1 bg-white dark:bg-neutral-800 rounded-md border border-neutral-200 dark:border-neutral-700 text-xs font-medium text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5 shadow-sm">
                  <Sparkles className="w-3 h-3 text-neutral-500 dark:text-neutral-400" />
                  NODALxAI CRM
                </div>
              </div>
              <div className="text-xs font-medium text-neutral-400 dark:text-neutral-500 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                Analyzed successfully
              </div>
            </div>

            {/* Dashboard Content */}
            <div className="p-6 md:p-10">
              
              {/* Top Row: Profile & Score */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center text-xl font-bold text-neutral-700 dark:text-neutral-200 shadow-sm">
                    SJ
                  </div>
                  <div>
                    <h4 className="text-2xl font-bold text-neutral-900 dark:text-white tracking-tight mb-1">Sarah Jenkins</h4>
                    <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">VP of Operations, TechFlow Inc.</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2.5 bg-orange-50 dark:bg-orange-500/10 border border-orange-200/60 dark:border-orange-500/20 px-4 py-2 rounded-full shadow-sm">
                  <Flame className="w-5 h-5 text-orange-500 dark:text-orange-400" />
                  <span className="text-orange-700 dark:text-orange-400 font-bold text-sm tracking-wide">Lead Score: 🔥 HOT</span>
                </div>
              </div>

              {/* Middle Row: Key Metrics Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-10">
                {/* Budget */}
                <div className="p-5 rounded-xl border border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/50 flex items-start gap-4 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800">
                  <div className="p-2.5 bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-700 shadow-sm">
                    <Wallet className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-1">Estimated Budget</p>
                    <p className="text-xl font-bold text-neutral-900 dark:text-white">$120,000 - $150,000</p>
                  </div>
                </div>

                {/* Priority */}
                <div className="p-5 rounded-xl border border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/50 flex items-start gap-4 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800">
                  <div className="p-2.5 bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-700 shadow-sm">
                    <AlertCircle className="w-5 h-5 text-rose-500 dark:text-rose-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-1">Priority</p>
                    <p className="text-xl font-bold text-neutral-900 dark:text-white">High (Decision Maker)</p>
                  </div>
                </div>
              </div>

              {/* Bottom Row: Summary & Action */}
              <div className="space-y-6">
                {/* Summary */}
                <div>
                  <h5 className="text-sm font-bold text-neutral-900 dark:text-white mb-3 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-neutral-500 dark:text-neutral-400" />
                    AI Summary
                  </h5>
                  <div className="p-5 rounded-xl border border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/50 text-neutral-700 dark:text-neutral-300 leading-relaxed text-sm md:text-base">
                    Customer is actively looking for an enterprise AI automation solution to streamline their inbound sales pipeline. They have a high budget, are the primary decision-maker, and plan to implement within 30 days.
                  </div>
                </div>

                {/* Recommended Action */}
                <div>
                  <h5 className="text-sm font-bold text-neutral-900 dark:text-white mb-3 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-neutral-500 dark:text-neutral-400" />
                    Suggested Next Action
                  </h5>
                  <div className="p-5 rounded-xl border border-neutral-200/60 dark:border-neutral-800/50 bg-neutral-50/40 dark:bg-neutral-900/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-neutral-100 dark:bg-neutral-900/50 rounded-lg text-neutral-700 dark:text-neutral-300">
                        <PhoneCall className="w-5 h-5" />
                      </div>
                      <p className="text-neutral-900 dark:text-neutral-100 font-medium">Schedule a technical demo within 24 hours.</p>
                    </div>
                    <button className="w-full sm:w-auto px-5 py-2.5 bg-neutral-600 hover:bg-neutral-700 dark:bg-neutral-500 dark:hover:bg-neutral-400 text-white dark:text-neutral-950 text-sm font-semibold rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2">
                      Take Action
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
