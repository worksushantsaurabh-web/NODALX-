import React, { useState, useRef } from 'react';
import { Send, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
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
      if (APPSCRIPT_WEBHOOK_URL) {
        // Apps Script POST: use no-cors to bypass Google's redirect CORS issue
        // The request still reaches the server and executes doPost
        await fetch(APPSCRIPT_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify(payload),
          mode: 'no-cors',
          redirect: 'follow',
        });
        // no-cors gives opaque response (can't read body), but POST executes server-side
      } else {
        const response = await fetch('/api/inquiries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error(`Server responded with status: ${response.status}`);
        }

        const data = await response.json();
        if (data && data.success === false) {
          throw new Error(data.error || data.message || 'Submission failed');
        }
      }

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

  const inputClass = "w-full glass-input rounded-lg px-4 py-3 text-black dark:text-white placeholder-neutral-400 dark:placeholder-neutral-600 outline-none transition-all text-sm";

  return (
    <section id="contact" className="relative pb-24 pt-12 lg:pb-32 lg:pt-16 bg-white dark:bg-black">
      <div className="max-w-4xl mx-auto px-6 md:px-12 relative z-10">
        <div className="text-center mb-12 md:mb-16">
          <p className="text-xs font-medium tracking-widest text-neutral-500 uppercase mb-3">
            Get Started
          </p>
          <h3 className="text-3xl md:text-4xl font-bold text-black dark:text-white tracking-tight mb-4">
            Automate your workflow
          </h3>
          <p className="text-lg text-neutral-500 dark:text-neutral-400 max-w-2xl mx-auto leading-relaxed">
            Tell us about your business, and our AI will instantly route your inquiry to the right specialist.
          </p>
        </div>

        <div className="glass-card rounded-2xl p-8 md:p-10 min-h-[400px]">

          {isSubmitted ? (
            <div className="flex flex-col items-center justify-center py-8 text-center animate-fade-in">
              <div className="w-16 h-16 bg-neutral-100 dark:bg-neutral-900 rounded-full flex items-center justify-center mb-6 border border-neutral-200 dark:border-neutral-800">
                <CheckCircle2 className="w-8 h-8 text-black dark:text-white" />
              </div>

              <h3 className="text-2xl font-bold text-black dark:text-white mb-4 tracking-tight">
                Inquiry Submitted Successfully
              </h3>

              <p className="text-neutral-500 dark:text-neutral-400 mb-8">
                Thank you for contacting NODALxAI. Your inquiry is being reviewed.
              </p>

              <div className="w-full max-w-md bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 mb-8 text-left space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800">
                  <span className="text-sm text-neutral-500">Estimated Response</span>
                  <span className="text-sm font-semibold text-black dark:text-white flex items-center gap-1.5">
                    <Clock className="w-4 h-4" />
                    15 Minutes
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-500">Reference</span>
                  <span className="text-sm font-mono font-semibold text-black dark:text-white bg-white dark:bg-black px-2.5 py-1 rounded-md border border-neutral-200 dark:border-neutral-800">
                    {referenceNumber}
                  </span>
                </div>
              </div>

              <button
                onClick={handleReset}
                className="px-6 py-3 rounded-lg bg-black dark:bg-white text-white dark:text-black font-medium text-sm transition-all hover:opacity-80"
              >
                Submit Another Inquiry
              </button>
            </div>
          ) : (
            <form ref={formRef} id="inquiry-form" onSubmit={handleSubmit} onFocus={handleFormFocus} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label htmlFor="fullName" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    Full Name <span className="text-neutral-400">*</span>
                  </label>
                  <input type="text" id="fullName" name="fullName" required className={inputClass} placeholder="Jane Doe" />
                </div>

                <div className="space-y-2">
                  <label htmlFor="email" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    Email Address <span className="text-neutral-400">*</span>
                  </label>
                  <input type="email" id="email" name="email" required className={inputClass} placeholder="jane@company.com" />
                </div>

                <div className="space-y-2">
                  <label htmlFor="phone" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    Phone Number
                  </label>
                  <input type="tel" id="phone" name="phone" className={inputClass} placeholder="+1 (555) 000-0000" />
                </div>

                <div className="space-y-2">
                  <label htmlFor="company" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    Company Name <span className="text-neutral-400">*</span>
                  </label>
                  <input type="text" id="company" name="company" required className={inputClass} placeholder="Acme Corp" />
                </div>

                <div className="space-y-2">
                  <label htmlFor="industry" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    Industry
                  </label>
                  <select id="industry" name="industry" className={inputClass}>
                    <option value="">Select an industry...</option>
                    <option value="technology">Technology & Software</option>
                    <option value="healthcare">Healthcare</option>
                    <option value="finance">Financial Services</option>
                    <option value="retail">Retail & E-commerce</option>
                    <option value="manufacturing">Manufacturing</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label htmlFor="service" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    Service Required
                  </label>
                  <select id="service" name="service" className={inputClass}>
                    <option value="">Select a service...</option>
                    <option value="ai-automation">AI Workflow Automation</option>
                    <option value="lead-scoring">Intelligent Lead Scoring</option>
                    <option value="custom-integration">Custom CRM Integration</option>
                    <option value="consulting">Strategy & Consulting</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="message" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  How can we help you? <span className="text-neutral-400">*</span>
                </label>
                <textarea
                  id="message"
                  name="message"
                  required
                  rows={4}
                  className={`${inputClass} resize-none`}
                  placeholder="e.g., We get 50 leads a day on our real estate app and need to qualify them instantly..."
                />
              </div>

              {error && (
                <div className="p-4 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-neutral-600 dark:text-neutral-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-black dark:text-white">Submission Failed</p>
                    <p className="text-sm text-neutral-500 mt-1">{error}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => formRef.current?.requestSubmit()}
                    className="px-3 py-1.5 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-black dark:text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    Retry
                  </button>
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full md:w-auto px-8 py-3.5 rounded-lg bg-black dark:bg-white text-white dark:text-black font-medium text-sm transition-all hover:opacity-80 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? 'Submitting...' : (
                    <>
                      Submit Inquiry <Send className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>

              <p className="text-center text-xs text-neutral-400">
                By submitting this form, you agree to our <a href="#/privacy" className="text-neutral-600 dark:text-neutral-300 hover:underline">Privacy Policy</a>.
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
