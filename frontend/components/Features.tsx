import React from 'react';
import { Bot, Send, FileSpreadsheet, BarChart3 } from 'lucide-react';

const features = [
  {
    title: 'AI Lead Qualification',
    description: 'Automatically score and categorize incoming leads based on custom criteria using advanced AI models.',
    icon: Bot,
  },
  {
    title: 'Instant Email Replies',
    description: 'Draft and send personalized, context-aware responses to common customer inquiries in seconds.',
    icon: Send,
  },
  {
    title: 'Google Sheets Integration',
    description: 'Seamlessly sync all captured lead data and conversation history directly to your spreadsheets.',
    icon: FileSpreadsheet,
  },
  {
    title: 'Business Analytics',
    description: 'Gain actionable insights into inquiry volume, response times, and lead conversion rates.',
    icon: BarChart3,
  },
];

export default function Features() {
  return (
    <section id="features" className="relative py-24 lg:py-32 overflow-hidden bg-slate-50/50">
      {/* Subtle background decoration */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] opacity-20 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-tr from-teal-200 to-transparent rounded-full blur-3xl"></div>
      </div>

      <div className="max-w-7xl mx-auto px-6 md:px-12 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-16 lg:mb-24 animate-fade-in-up">
          <h2 className="text-sm font-bold tracking-widest text-teal-600 uppercase mb-3">
            Supercharge Your Workflow
          </h2>
          <h3 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight mb-6">
            Everything you need to scale your inbound sales
          </h3>
          <p className="text-lg text-slate-600 leading-relaxed">
            NODALxAI replaces manual data entry and slow response times with intelligent automation, giving you more time to close deals.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className="group relative p-8 rounded-3xl bg-white/60 backdrop-blur-xl border border-slate-200/60 shadow-sm hover:shadow-2xl hover:shadow-teal-600/10 transition-all duration-500 hover:-translate-y-2 animate-fade-in-up"
              style={{ animationDelay: `${index * 0.15}s` }}
            >
              {/* Hover Gradient Overlay */}
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-teal-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
              
              <div className="relative z-10">
                <div className="w-14 h-14 rounded-2xl bg-white border border-slate-100 shadow-sm text-teal-600 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-teal-600 group-hover:text-white transition-all duration-500">
                  <feature.icon strokeWidth={1.5} className="w-7 h-7" />
                </div>
                
                <h4 className="text-xl font-bold text-slate-900 mb-3 tracking-tight">
                  {feature.title}
                </h4>
                
                <p className="text-slate-600 leading-relaxed text-sm">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}