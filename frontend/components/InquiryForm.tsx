import React, { useState, useRef } from 'react';
import { Send, Sparkles, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { Analytics } from '../lib/analytics';
import { useFeedback } from '../contexts/FeedbackContext';

const APPSCRIPT_WEBHOOK_URL = import.meta.env.VITE_APPSCRIPT_WEBHOOK_URL || '';

export default function InquiryForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const formStarted = useRef(false);
  const { showSurvey } = useFeedback();

  const handleFormFocus = () => {
    if (!formStarted.current) {
      formStarted.current = true;
      Analytics.formStart();
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    Analytics.formSubmit();
    setIsSubmitting(true);
    setError(null);
    
    // Collect all form values
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
      let response: Response;

      if (APPSCRIPT_WEBHOOK_URL) {
        response = await fetch(APPSCRIPT_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify(payload),
        });
      } else {
        response = await fetch('/api/inquiries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }

      const data = await response.json();
      if (data && data.success === false) {
        throw new Error(data.error || data.message || 'Submission failed');
      }

      // Success
      Analytics.formSuccess();
      showSurvey({ question: 'How easy was that?', context: 'form_submission', delayMs: 2000 });
      if (payload.service) {
        localStorage.setItem('fp_user_service', payload.service);
      }
      setReferenceNumber(`FP-${Math.floor(10000 + Math.random() * 90000)}`);
      setIsSubmitted(true);

    } catch (err: any) {
      const msg = err?.message || 'Unknown error';
      Analytics.formError(msg);
      console.error('Inquiry submission error:', err);
      setError('We could not submit your inquiry. Please try again in a moment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setIsSubmitted(false);
    setError(null);
    if (formRef.current) {
      formRef.current.reset();
    }
  };

  return (
    <section id="contact" className="relative pb-24 pt-12 lg:pb-32 lg:pt-16 overflow-hidden bg-white dark:bg-slate-950 transition-colors duration-300">
      {/* Subtle Background Elements */}
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
          {/* Form Card - Linear/Stripe Style */}
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
                
                <div className="text-lg text-slate-600 dark:text-slate-400 mb-10 space-y-2">
                  <p>Thank you for contacting NODALxAI.</p>
                  <p>Your inquiry is being reviewed by our team.</p>
                </div>

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
              <form ref={formRef} id="inquiry-form" onSubmit={handleSubmit} onFocus={handleFormFocus} className="space-y-6 animate-fade-in">
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
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">We'll tailor the setup based on your selected workflow.</p>
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
                    {isSubmitting ? 'Submitting...' : (
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
