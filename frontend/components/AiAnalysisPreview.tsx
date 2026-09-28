import React from 'react';
import { Sparkles, Flame, Wallet, AlertCircle, PhoneCall, ChevronRight, Activity, CheckCircle2 } from 'lucide-react';

export default function AiAnalysisPreview() {
  return (
    <section id="ai-analysis" className="relative py-24 lg:py-32 bg-neutral-50/30  border-t border-neutral-100  overflow-hidden transition-colors duration-300">
      {/* Subtle Background Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-full pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-neutral-50/50  rounded-full blur-3xl animate-pulse-slow"></div>
      </div>

      <div className="max-w-5xl mx-auto px-6 md:px-12 relative z-10">
        <div className="text-center max-w-2xl mx-auto mb-16 animate-fade-in-up">
          <h2 className="text-xs font-bold tracking-widest text-text-tertiary  uppercase mb-3 flex items-center justify-center gap-2">
            <Activity className="w-4 h-4 animate-pulse" />
            Live Preview
          </h2>
          <h3 className="text-3xl md:text-4xl font-extrabold text-neutral-900  tracking-tight mb-4">
            Instant AI Analysis
          </h3>
          <p className="text-lg text-text-tertiary  leading-relaxed">
            See how NodalX processes inquiries in real-time, extracting key data and recommending the next best action for your team.
          </p>
        </div>

        {/* Dashboard UI Mockup */}
        <div className="relative mx-auto max-w-4xl animate-fade-in-up group" style={{ animationDelay: '0.2s' }}>
          {/* Main Card */}
          <div className="bg-white  rounded-2xl border border-neutral-200/80  shadow-2xl shadow-neutral-200/40  overflow-hidden flex flex-col transition-all duration-500 group-hover:shadow-3xl group-hover:-translate-y-1">
            
            {/* Mock Browser/App Header */}
            <div className="bg-neutral-50/80  border-b border-neutral-200/80  px-5 py-3 flex items-center justify-between ">
              <div className="flex items-center gap-4">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-neutral-300 "></div>
                  <div className="w-3 h-3 rounded-full bg-neutral-300 "></div>
                  <div className="w-3 h-3 rounded-full bg-neutral-300 "></div>
                </div>
                <div className="px-2.5 py-1 bg-white  rounded-md border border-neutral-200  text-xs font-medium text-text-tertiary  flex items-center gap-1.5 shadow-sm">
                  <Sparkles className="w-3 h-3 text-text-tertiary " />
                  NodalX CRM
                </div>
              </div>
              <div className="text-xs font-medium text-text-secondary  flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 " />
                Analyzed successfully
              </div>
            </div>

            {/* Dashboard Content */}
            <div className="p-6 md:p-10">
              
              {/* Top Row: Profile & Score */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-neutral-50  border border-neutral-200  flex items-center justify-center text-xl font-bold text-neutral-700  shadow-sm">
                    SJ
                  </div>
                  <div>
                    <h4 className="text-2xl font-bold text-neutral-900  tracking-tight mb-1">Sarah Jenkins</h4>
                    <p className="text-sm font-medium text-text-tertiary ">VP of Operations, TechFlow Inc.</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2.5 bg-orange-50  border border-orange-200/60  px-4 py-2 rounded-full shadow-sm">
                  <Flame className="w-5 h-5 text-orange-500 " />
                  <span className="text-orange-700  font-bold text-sm tracking-wide">Lead Score: 🔥 HOT</span>
                </div>
              </div>

              {/* Middle Row: Key Metrics Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-10">
                {/* Budget */}
                <div className="p-5 rounded-xl border border-neutral-100  bg-neutral-50/50  flex items-start gap-4 transition-colors hover:bg-neutral-50 :bg-surface-hover">
                  <div className="p-2.5 bg-white  rounded-lg border border-neutral-200  shadow-sm">
                    <Wallet className="w-5 h-5 text-text-tertiary " />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text-tertiary  mb-1">Estimated Budget</p>
                    <p className="text-xl font-bold text-neutral-900 ">$120,000 - $150,000</p>
                  </div>
                </div>

                {/* Priority */}
                <div className="p-5 rounded-xl border border-neutral-100  bg-neutral-50/50  flex items-start gap-4 transition-colors hover:bg-neutral-50 :bg-surface-hover">
                  <div className="p-2.5 bg-white  rounded-lg border border-neutral-200  shadow-sm">
                    <AlertCircle className="w-5 h-5 text-rose-500 " />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text-tertiary  mb-1">Priority</p>
                    <p className="text-xl font-bold text-neutral-900 ">High (Decision Maker)</p>
                  </div>
                </div>
              </div>

              {/* Bottom Row: Summary & Action */}
              <div className="space-y-6">
                {/* Summary */}
                <div>
                  <h5 className="text-sm font-bold text-neutral-900  mb-3 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-text-tertiary " />
                    AI Summary
                  </h5>
                  <div className="p-5 rounded-xl border border-neutral-100  bg-neutral-50/50  text-neutral-700  leading-relaxed text-sm md:text-base">
                    Customer is actively looking for an enterprise AI automation solution to streamline their inbound sales pipeline. They have a high budget, are the primary decision-maker, and plan to implement within 30 days.
                  </div>
                </div>

                {/* Recommended Action */}
                <div>
                  <h5 className="text-sm font-bold text-neutral-900  mb-3 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-text-tertiary " />
                    Suggested Next Action
                  </h5>
                  <div className="p-5 rounded-xl border border-neutral-200/60  bg-neutral-50/40  flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-neutral-100  rounded-lg text-neutral-700 ">
                        <PhoneCall className="w-5 h-5" />
                      </div>
                      <p className="text-neutral-900  font-medium">Schedule a technical demo within 24 hours.</p>
                    </div>
                    <button className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-accent to-accent-2 hover:brightness-110 text-[#fff] text-sm font-semibold rounded-lg shadow-md shadow-accent/25 transition-all flex items-center justify-center gap-2">
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
