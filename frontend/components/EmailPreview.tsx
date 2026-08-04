import React from 'react';
import { Mail, Sparkles, CheckCircle2 } from 'lucide-react';

export default function EmailPreview() {
  const emailPayload = {
    id: "email_9823749823",
    inquiryId: "FP-48291",
    to: "sarah.jenkins@techflow.com",
    from: "alex@nodalx.ai",
    subject: "Re: Enterprise AI Automation Inquiry",
    body: "Hi Sarah,\n\nThank you for reaching out to NODALxAI.\n\nI understand you're looking for an enterprise AI automation solution to streamline your inbound sales pipeline, with a target implementation of 30 days.\n\nGiven your requirements, I'd love to show you a tailored technical demo of how NODALxAI can integrate directly with your existing CRM to handle your lead volume instantly.\n\nAre you available for a brief 15-minute call this Thursday?\n\nBest regards,\n\nAlex\nNODALxAI Team",
    status: "draft",
    aiConfidenceScore: 0.98,
    createdAt: new Date().toISOString()
  };

  return (
    <section id="email-draft" className="relative py-24 lg:py-32 bg-white dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800/50 overflow-hidden transition-colors duration-300">
      {/* Subtle Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-gradient-to-tr from-purple-50/50 dark:from-purple-900/10 to-transparent blur-3xl opacity-60"></div>
      </div>

      <div className="max-w-4xl mx-auto px-6 md:px-12 relative z-10">
        <div className="text-center mb-12 md:mb-16 animate-fade-in-up">
          <h2 className="text-xs font-bold tracking-widest text-teal-600 dark:text-teal-400 uppercase mb-3 flex items-center justify-center gap-2">
            <Mail className="w-4 h-4" />
            Auto-Drafted Response
          </h2>
          <h3 className="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-4">
            Ready to Send
          </h3>
          <p className="text-lg text-slate-500 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
            NODALxAI instantly drafts a highly personalized, context-aware email based on the customer's inquiry and AI analysis.
          </p>
        </div>

        <div className="relative animate-fade-in-up group" style={{ animationDelay: '0.2s' }}>
          {/* Email Client Mockup */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xl shadow-slate-200/40 dark:shadow-none overflow-hidden flex flex-col transition-all duration-500 group-hover:shadow-3xl group-hover:-translate-y-1">
            
            {/* Mock Browser/App Header */}
            <div className="bg-slate-50/80 dark:bg-slate-950/50 border-b border-slate-200/80 dark:border-slate-800 px-5 py-3 flex items-center justify-between backdrop-blur-sm">
              <div className="flex items-center gap-4">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-slate-300 dark:bg-slate-700"></div>
                  <div className="w-3 h-3 rounded-full bg-slate-300 dark:bg-slate-700"></div>
                  <div className="w-3 h-3 rounded-full bg-slate-300 dark:bg-slate-700"></div>
                </div>
                <div className="px-2.5 py-1 bg-teal-50 dark:bg-teal-500/10 rounded-md border border-teal-100 dark:border-teal-500/20 text-xs font-bold text-teal-700 dark:text-teal-400 flex items-center gap-1.5 shadow-sm">
                  <Sparkles className="w-3 h-3" />
                  AI Draft
                </div>
              </div>
              <div className="text-xs font-medium text-slate-400 dark:text-slate-500">
                Saved just now
              </div>
            </div>

            {/* Email Headers */}
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
              <div className="flex items-center text-sm">
                <span className="w-16 text-slate-400 dark:text-slate-500 font-medium">To:</span>
                <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-md font-medium border border-slate-200/60 dark:border-slate-700/60">
                  {emailPayload.to}
                </span>
              </div>
              <div className="flex items-center text-sm">
                <span className="w-16 text-slate-400 dark:text-slate-500 font-medium">From:</span>
                <span className="text-slate-700 dark:text-slate-300 font-medium">{emailPayload.from}</span>
              </div>
              <div className="flex items-center text-sm">
                <span className="w-16 text-slate-400 dark:text-slate-500 font-medium">Subject:</span>
                <span className="text-slate-900 dark:text-white font-bold">{emailPayload.subject}</span>
              </div>
            </div>

            {/* Email Body */}
            <div className="p-6 md:p-8 bg-white dark:bg-slate-900">
              <div className="prose prose-slate dark:prose-invert max-w-none">
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap font-sans text-[15px]">
                  {emailPayload.body}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
