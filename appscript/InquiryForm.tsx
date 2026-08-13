import React, { useState, useRef } from 'react';
import { Send, Sparkles, CheckCircle2, AlertCircle, Clock, Bot, TrendingUp, Building2, Zap, Shield } from 'lucide-react';

const APPSCRIPT_URL = import.meta.env.VITE_APPSCRIPT_WEBHOOK_URL || '';

interface Classification {
  intent: string;
  urgency: string;
  fit_score: number;
  summary: string;
  suggested_action: string;
  category: string;
}

export default function InquiryForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [classification, setClassification] = useState<Classification | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setClassification(null);

    const formData = new FormData(e.currentTarget);
    const payload = {
      name: formData.get('name') as string,
      email: formData.get('email') as string,
      phone: formData.get('phone') as string,
      company: formData.get('company') as string,
      industry: formData.get('industry') as string,
      message: formData.get('message') as string,
      source: window.location.href,
    };

    try {
      if (!APPSCRIPT_URL) {
        throw new Error('Apps Script webhook URL not configured. Add VITE_APPSCRIPT_WEBHOOK_URL to your .env');
      }

      const response = await fetch(APPSCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Submission failed');
      }

      setClassification(data.classification);
      setReferenceNumber(`NX-${Math.floor(10000 + Math.random() * 90000)}`);
      setIsSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setIsSubmitted(false);
    setError(null);
    setClassification(null);
    formRef.current?.reset();
  };

  const getIntentBadge = (intent: string) => {
    const map: Record<string, string> = {
      purchase: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
      partnership: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
      support: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      spam: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
      general: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400',
    };
    return map[intent] || map.general;
  };

  const getUrgencyIcon = (urgency: string) => {
    if (urgency === 'high') return <Zap className="w-4 h-4 text-red-500" />;
    if (urgency === 'medium') return <Clock className="w-4 h-4 text-amber-500" />;
    return <Shield className="w-4 h-4 text-green-500" />;
  };

  return (
    <section id="contact" className="relative py-20 bg-white dark:bg-slate-950">
      <div className="max-w-4xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-sm font-bold tracking-widest text-teal-600 uppercase mb-3">Get Started</h2>
          <h3 className="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white mb-4">Automate your workflow</h3>
          <p className="text-lg text-slate-500 dark:text-slate-400 max-w-xl mx-auto">
            Tell us about your business, and our AI will instantly route your inquiry to the right specialist.
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-8 md:p-10">
          {isSubmitted ? (
            <div className="text-center py-8 animate-fade-in">
              <div className="w-20 h-20 bg-teal-50 dark:bg-teal-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-10 h-10 text-teal-600 dark:text-teal-400" />
              </div>

              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Inquiry Submitted!</h3>
              <p className="text-slate-500 dark:text-slate-400 mb-6">Thank you for contacting NODALxAI. We've analyzed your request.</p>

              {classification && (
                <div className="max-w-md mx-auto bg-slate-50 dark:bg-slate-800/50 rounded-xl p-6 mb-6 text-left">
                  <div className="flex items-center gap-2 mb-4">
                    <Bot className="w-5 h-5 text-teal-600" />
                    <h4 className="font-bold text-slate-900 dark:text-white">AI Classification</h4>
                  </div>

                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 dark:text-slate-400">Intent</span>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${getIntentBadge(classification.intent)}`}>
                        {classification.intent}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 dark:text-slate-400">Urgency</span>
                      <span className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300 capitalize">
                        {getUrgencyIcon(classification.urgency)}
                        {classification.urgency}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 dark:text-slate-400">Category</span>
                      <span className="flex items-center gap-1 text-slate-700 dark:text-slate-300 capitalize">
                        <Building2 className="w-3.5 h-3.5" />
                        {classification.category}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 dark:text-slate-400">Fit Score</span>
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div className="h-full bg-teal-500 rounded-full" style={{ width: `${classification.fit_score * 10}%` }} />
                        </div>
                        <span className="font-bold text-slate-900 dark:text-white">{classification.fit_score}/10</span>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
                      <p className="text-slate-600 dark:text-slate-400">
                        <span className="font-semibold">Summary:</span> {classification.summary}
                      </p>
                    </div>

                    <div className="bg-teal-50 dark:bg-teal-900/20 rounded-lg p-3">
                      <p className="text-teal-800 dark:text-teal-300">
                        <span className="font-semibold">Next Step:</span> {classification.suggested_action}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="max-w-sm mx-auto bg-slate-50 dark:bg-slate-800 rounded-xl p-4 mb-8 flex justify-between items-center">
                <span className="text-sm text-slate-500 dark:text-slate-400">Ref #</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">{referenceNumber}</span>
              </div>

              <button onClick={handleReset} className="px-8 py-3 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold hover:opacity-90 transition-opacity">
                Submit Another
              </button>
            </div>
          ) : (
            <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Full Name <span className="text-teal-600">*</span>
                  </label>
                  <input type="text" name="name" required className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all" placeholder="Jane Doe" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Email <span className="text-teal-600">*</span>
                  </label>
                  <input type="email" name="email" required className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all" placeholder="jane@company.com" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Company</label>
                  <input type="text" name="company" className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all" placeholder="Acme Inc" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Phone</label>
                  <input type="tel" name="phone" className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all" placeholder="+1 555 000 0000" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Industry</label>
                <input type="text" name="industry" className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all" placeholder="E-commerce, SaaS, Healthcare..." />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Message</label>
                <textarea name="message" rows={4} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all resize-none" placeholder="Tell us what you need..." />
              </div>

              {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                </div>
              )}

              <button type="submit" disabled={isSubmitting} className="w-full md:w-auto px-8 py-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold transition-all shadow-lg shadow-teal-600/25 disabled:opacity-60 flex items-center justify-center gap-2">
                {isSubmitting ? (
                  <><Bot className="w-4 h-4 animate-pulse" /> Analyzing...</>
                ) : (
                  <><Send className="w-4 h-4" /> Send Inquiry</>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
