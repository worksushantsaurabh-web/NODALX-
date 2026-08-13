/**
 * NODALxAI — Frontend Integration for Apps Script Webhook
 * 
 * This shows how to update your InquiryForm.tsx to send inquiries
 * to the Google Apps Script webhook instead of (or alongside) your backend.
 * 
 * You have 3 options:
 * 
 * OPTION 1: Replace backend entirely with Apps Script
 *   - Inquiry → Apps Script → Google Sheets
 *   - Dashboard reads from Apps Script GET endpoint
 * 
 * OPTION 2: Use BOTH (recommended during transition)
 *   - Inquiry → Your backend (Firestore) + Apps Script (Sheets + AI)
 *   - This gives you redundancy while you test
 * 
 * OPTION 3: Apps Script calls your backend
 *   - Inquiry → Apps Script → Classifies → Stores in Sheet → Forwards to your backend
 */

import React, { useState, useRef } from 'react';
import { Send, Sparkles, CheckCircle2, AlertCircle, Clock, Bot } from 'lucide-react';

// Your Apps Script Web App URL
const APPSCRIPT_WEBHOOK_URL = import.meta.env.VITE_APPSCRIPT_WEBHOOK_URL || '';

interface Classification {
  intent: string;
  urgency: string;
  fit_score: number;
  summary: string;
  suggested_action: string;
  category: string;
}

export default function InquiryFormWithAppsScript() {
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
      name: formData.get('fullName') as string,
      email: formData.get('email') as string,
      phone: formData.get('phone') as string,
      company: formData.get('company') as string,
      industry: formData.get('industry') as string,
      service: formData.get('service') as string,
      message: formData.get('message') as string,
      submittedAt: new Date().toISOString(),
    };

    try {
      // ═══════════════════════════════════════════════════════════
      // OPTION A: Send to Apps Script ONLY
      // Replace your existing /api/inquiries call with this:
      // ═══════════════════════════════════════════════════════════
      
      if (!APPSCRIPT_WEBHOOK_URL) {
        throw new Error('Apps Script webhook URL not configured. Check your .env file.');
      }

      const response = await fetch(APPSCRIPT_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server responded with status: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Unknown error from Apps Script');
      }

      // Store classification for display
      if (data.classification) {
        setClassification(data.classification);
      }

      // ═══════════════════════════════════════════════════════════
      // OPTION B: Send to BOTH (your backend + Apps Script)
      // Uncomment this block if you want to keep Firestore AND Sheets:
      // ═══════════════════════════════════════════════════════════
      
      /*
      // Firestore (existing)
      const backendResponse = await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      if (!backendResponse.ok) {
        console.warn('Backend save failed, but Apps Script succeeded');
      }
      */

      // Success
      if (payload.service) {
        localStorage.setItem('fp_user_service', payload.service);
      }
      setReferenceNumber(`FP-${Math.floor(10000 + Math.random() * 90000)}`);
      setIsSubmitted(true);

    } catch (err) {
      console.error('Inquiry submission error:', err);
      setError(err instanceof Error ? err.message : 'We could not submit your inquiry. Please try again in a moment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setIsSubmitted(false);
    setError(null);
    setClassification(null);
    if (formRef.current) {
      formRef.current.reset();
    }
  };

  // Helper to get color based on intent
  const getIntentColor = (intent: string) => {
    switch (intent) {
      case 'purchase': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'partnership': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
      case 'support': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'spam': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      default: return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400';
    }
  };

  // Helper to get color based on urgency
  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'high': return 'text-red-600 dark:text-red-400';
      case 'medium': return 'text-amber-600 dark:text-amber-400';
      case 'low': return 'text-green-600 dark:text-green-400';
      default: return 'text-slate-600 dark:text-slate-400';
    }
  };

  return (
    <section id="contact" className="relative pb-24 pt-12 lg:pb-32 lg:pt-16 overflow-hidden bg-white dark:bg-slate-950 transition-colors duration-300">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -right-[10%] w-[70%] h-[70%] rounded-full bg-gradient-to-b from-teal-50/50 dark:from-teal-900/10 to-transparent blur-3xl opacity-60"></div>
      </div>

      <div className="max-w-4xl mx-auto px-6 md:px-12 relative z-10">
        <div className="text-center mb-12 md:mb-16 animate-fade-in-up">
          <h2 className="text-xs font-bold tracking-widest text-teal-600 dark:text-teal-400 uppercase mb-3 flex items-center justify-center gap-2">
            <Sparkles className="w-4 h-4" />
            Get Started
          </h2>
          <h3 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-4">
            Automate your workflow
          </h3>
          <p className="text-lg text-slate-500 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Tell us about your business, and our AI will instantly route your inquiry to the right specialist.
          </p>
        </div>

        <div className="relative animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] border border-slate-200/80 dark:border-slate-800 p-8 md:p-10 relative overflow-hidden min-h-[400px]">
            
            {isSubmitted ? (
              <div className="flex flex-col items-center justify-center py-8 text-center animate-fade-in">
                <div className="relative flex justify-center mb-8">
                  <div className="absolute inset-0 bg-teal-100 dark:bg-teal-900/50 rounded-full animate-[ping_2.5s_cubic-bezier(0,0,0.2,1)_infinite] opacity-60 scale-150"></div>
                  <div className="relative w-20 h-20 bg-teal-50 dark:bg-teal-900/30 rounded-full flex items-center justify-center border-4 border-white dark:border-slate-900 shadow-lg z-10">
                    <CheckCircle2 className="w-10 h-10 text-teal-600 dark:text-teal-400 animate-scale-in" style={{ animationDelay: '0.2s' }} />
                  </div>
                </div>
                
                <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-4 tracking-tight">
                  Inquiry Submitted Successfully
                </h3>
                
                <div className="text-lg text-slate-600 dark:text-slate-400 mb-6 space-y-2">
                  <p>Thank you for contacting NODALxAI.</p>
                  <p>Your inquiry is being reviewed by our team.</p>
                </div>

                {/* AI Classification Results */}
                {classification && (
                  <div className="w-full max-w-lg bg-gradient-to-br from-slate-50 to-teal-50/50 dark:from-slate-800/80 dark:to-teal-900/20 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl p-6 mb-6 text-left shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                      <Bot className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                      <h4 className="font-bold text-slate-900 dark:text-white">AI Analysis</h4>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-500 dark:text-slate-400">Intent</span>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${getIntentColor(classification.intent)}`}>
                          {classification.intent}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-500 dark:text-slate-400">Urgency</span>
                        <span className={`text-sm font-bold capitalize ${getUrgencyColor(classification.urgency)}`}>
                          {classification.urgency}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-500 dark:text-slate-400">Fit Score</span>
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-teal-500 rounded-full transition-all duration-1000"
                              style={{ width: `${classification.fit_score * 10}%` }}
                            />
                          </div>
                          <span className="text-sm font-bold text-slate-900 dark:text-white">{classification.fit_score}/10</span>
                        </div>
                      </div>
                      
                      <div className="pt-2 border-t border-slate-200/80 dark:border-slate-700/80">
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          <span className="font-semibold">Summary:</span> {classification.summary}
                        </p>
                      </div>
                      
                      <div className="bg-teal-50 dark:bg-teal-900/20 rounded-lg p-3">
                        <p className="text-sm text-teal-800 dark:text-teal-300">
                          <span className="font-semibold">Suggested Action:</span> {classification.suggested_action}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="w-full max-w-md bg-slate-50/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl p-6 mb-10 text-left space-y-4 shadow-sm">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-200/80 dark:border-slate-700/80">
                    <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Estimated Response Time</span>
                    <span className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                      15 Minutes
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Reference Number</span>
                    <span className="text-sm font-mono font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 shadow-sm">
                      {referenceNumber}
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleReset}
                  className="px-8 py-3.5 rounded-xl bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900 font-semibold text-base transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5"
                >
                  Submit Another Inquiry
                </button>
              </div>
            ) : (
              <form ref={formRef} id="inquiry-form" onSubmit={handleSubmit} className="space-y-6 animate-fade-in">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Full Name */}
                  <div className="space-y-2">
                    <label htmlFor="fullName" className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Full Name <span className="text-teal-600 dark:text-teal-400">*</span>
                    </label>
                    <input
                      type="text"
                      id="fullName"
                      name="fullName"
                      required
                      className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 shadow-sm rounded-xl px-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                      placeholder="Jane Doe"
                    />
                  </div>

                  {/* Email Address */}
                  <div className="space-y-2">
                    <label htmlFor="email" className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Email Address <span className="text-teal-600 dark:text-teal-400">*</span>
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      required
                      className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 shadow-sm rounded-xl px-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                      placeholder="jane@company.com"
                    />
                  </div>

                  {/* Phone Number */}
                  <div className="space-y-2">
                    <label htmlFor="phone" className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 shadow-sm rounded-xl px-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                      placeholder="+1 (555) 000-0000"
                    />
                  </div>

                  {/* Company Name */}
                  <div className="space-y-2">
                    <label htmlFor="company" className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Company Name <span className="text-teal-600 dark:text-teal-400">*</span>
                    </label>
                    <input
                      type="text"
                      id="company"
                      name="company"
                      required
                      className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 shadow-sm rounded-xl px-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                      placeholder="Acme Corp"
                    />
                  </div>

                  {/* Industry */}
                  <div className="space-y-2">
                    <label htmlFor="industry" className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Industry
                    </label>
                    <select
                      id="industry"
                      name="industry"
                      className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 shadow-sm rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all appearance-none"
                      style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: `right 0.75rem center`, backgroundRepeat: `no-repeat`, backgroundSize: `1.25em 1.25em` }}
                    >
                      <option value="">Select an industry...</option>
                      <option value="technology">Technology & Software</option>
                      <option value="healthcare">Healthcare</option>
                      <option value="finance">Financial Services</option>
                      <option value="retail">Retail & E-commerce</option>
                      <option value="manufacturing">Manufacturing</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  {/* Service Required */}
                  <div className="space-y-2">
                    <label htmlFor="service" className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Service Required
                    </label>
                    <select
                      id="service"
                      name="service"
                      className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 shadow-sm rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all appearance-none"
                      style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: `right 0.75rem center`, backgroundRepeat: `no-repeat`, backgroundSize: `1.25em 1.25em` }}
                    >
                      <option value="">Select a service...</option>
                      <option value="ai-automation">AI Workflow Automation</option>
                      <option value="lead-scoring">Intelligent Lead Scoring</option>
                      <option value="custom-integration">Custom CRM Integration</option>
                      <option value="consulting">Strategy & Consulting</option>
                    </select>
                  </div>
                </div>

                {/* Message */}
                <div className="space-y-2">
                  <label htmlFor="message" className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                    How can we help you? <span className="text-teal-600 dark:text-teal-400">*</span>
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    required
                    rows={4}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 shadow-sm rounded-xl px-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all resize-none"
                    placeholder="e.g., We get 50 leads a day on our real estate app and need to qualify them instantly..."
                  ></textarea>
                </div>

                {/* Error Banner */}
                {error && (
                  <div className="p-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800/50 rounded-xl flex items-start gap-3 animate-fade-in">
                    <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="text-sm font-bold text-rose-900 dark:text-rose-300">Submission Failed</h4>
                      <p className="text-sm text-rose-700 dark:text-rose-400 mt-1">{error}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => formRef.current?.requestSubmit()}
                      className="px-4 py-2 bg-rose-100 dark:bg-rose-800/50 hover:bg-rose-200 dark:hover:bg-rose-800 text-rose-800 dark:text-rose-300 text-sm font-bold rounded-lg transition-colors shadow-sm"
                    >
                      Retry
                    </button>
                  </div>
                )}

                {/* Submit Button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full md:w-auto px-8 py-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-base transition-all shadow-lg shadow-teal-600/30 hover:shadow-teal-600/50 hover:-translate-y-0.5 flex items-center justify-center gap-2 disabled:opacity-70 disabled:hover:translate-y-0"
                  >
                    {isSubmitting ? (
                      <>
                        <Bot className="w-4 h-4 animate-pulse" />
                        Analyzing with AI...
                      </>
                    ) : (
                      <>
                        Submit Inquiry <Send className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </button>
                </div>
                
                <p className="text-center text-xs text-slate-500 dark:text-slate-400 mt-4">
                  By submitting this form, you agree to our <a href="#" className="text-teal-600 dark:text-teal-400 hover:underline">Privacy Policy</a>.
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
