import React, { useState, useRef } from 'react';
import { Send, CheckCircle2, AlertCircle } from 'lucide-react';
import { Analytics } from '../lib/analytics';
import { useFeedback } from '../contexts/FeedbackContext';

const INQUIRY_SUBMISSION_TIMEOUT_MS = 55000;
const inquiryFormEnabled = import.meta.env.VITE_INQUIRY_FORM_ENABLED === 'true';

export default function InquiryForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const formStarted = useRef(false);
  const submittingRef = useRef(false);
  const requestId = useRef<string | null>(null);
  const lastPayload = useRef('');
  const { showSurvey } = useFeedback();

  const handleFormFocus = () => {
    if (!formStarted.current) {
      formStarted.current = true;
      Analytics.formStart();
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    Analytics.formSubmit();
    setIsSubmitting(true);
    setError(null);

    try {
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
      const identity = JSON.stringify({...payload, submittedAt: undefined});
      if (lastPayload.current !== identity) requestId.current = crypto.randomUUID();
      requestId.current ||= crypto.randomUUID();
      lastPayload.current = identity;

      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': requestId.current },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(INQUIRY_SUBMISSION_TIMEOUT_MS),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.accepted !== true) {
        throw new Error(data.error || `Server responded with status: ${response.status}`);
      }

      setIsSubmitted(true);
      Analytics.formSuccess();
      try {
        showSurvey({ question: 'How easy was that?', context: 'form_submission', delayMs: 2000 });
        if (payload.service) {
          localStorage.setItem('fp_user_service', payload.service);
        }
      } catch (err) {
        console.warn('Inquiry accepted, but optional follow-up failed:', err);
      }

    } catch (err: any) {
      const msg = err?.message || 'Unknown error';
      Analytics.formError(msg);
      console.error('Inquiry submission error:', err);
      setError('We could not confirm your inquiry was saved. It may already be in our inbox. Retry without changing the form to avoid sending a duplicate.');
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    requestId.current = null;
    lastPayload.current = '';
    setIsSubmitted(false);
    setError(null);
    if (formRef.current) {
      formRef.current.reset();
    }
  };

  const inputClass = "min-h-11 min-w-0 w-full bg-bg border border-border-strong rounded-lg px-3 py-3 text-text-primary placeholder:text-text-tertiary outline-none transition-colors text-sm focus:border-accent focus:ring-1 focus:ring-accent";

  return (
    <section id="contact" className="relative scroll-mt-24 py-20 sm:py-24 lg:py-28 bg-bg">
      <div className="max-w-4xl mx-auto px-5 sm:px-6 md:px-12 relative z-10">
        <div className="text-center mb-12 md:mb-16">
          <p className="text-xs font-medium tracking-cosmos text-text-tertiary uppercase mb-3">
            Get Started
          </p>
          <h3 className="text-3xl sm:text-4xl font-semibold text-text-primary tracking-tight mb-4">
            Automate your workflow
          </h3>
          <p className="text-lg text-text-secondary max-w-2xl mx-auto leading-relaxed">
            Tell us about your business and what you need help with.
          </p>
        </div>

        <div className="min-w-0 border border-border bg-surface rounded-xl p-5 sm:p-8 md:p-10 min-h-[400px]">

          {!inquiryFormEnabled ? (
            <div role="status" className="flex min-h-[320px] items-center justify-center text-center">
              <p className="max-w-md text-text-secondary">
                Inquiry submissions are temporarily unavailable while we complete the storage migration.
              </p>
            </div>
          ) : isSubmitted ? (
            <div className="flex flex-col items-center justify-center py-8 text-center animate-fade-in">
              <div className="w-16 h-16 border border-border rounded-full flex items-center justify-center mb-6">
                <CheckCircle2 className="w-8 h-8 text-white" />
              </div>

              <h3 className="text-2xl font-bold text-white mb-4 tracking-tight">
                Inquiry Submitted Successfully
              </h3>

              <p className="text-text-secondary mb-8">
                Thank you for contacting NodalX. The server accepted your inquiry. A response time has not been confirmed.
              </p>

              <button
                onClick={handleReset}
                className="px-6 py-3 rounded-md bg-white text-black font-medium text-sm transition-all hover:bg-neutral-200"
              >
                Submit Another Inquiry
              </button>
            </div>
          ) : (
            <form ref={formRef} id="inquiry-form" onSubmit={handleSubmit} onFocus={handleFormFocus} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label htmlFor="fullName" className="block text-sm font-medium text-text-secondary">
                    Full Name <span className="text-text-tertiary">*</span>
                  </label>
                  <input type="text" id="fullName" name="fullName" required className={inputClass} placeholder="Jane Doe" />
                </div>

                <div className="space-y-2">
                  <label htmlFor="email" className="block text-sm font-medium text-text-secondary">
                    Email Address <span className="text-text-tertiary">*</span>
                  </label>
                  <input type="email" id="email" name="email" required className={inputClass} placeholder="jane@company.com" />
                </div>

                <div className="space-y-2">
                  <label htmlFor="phone" className="block text-sm font-medium text-text-secondary">
                    Phone Number
                  </label>
                  <input type="tel" id="phone" name="phone" className={inputClass} placeholder="+1 (555) 000-0000" />
                </div>

                <div className="space-y-2">
                  <label htmlFor="company" className="block text-sm font-medium text-text-secondary">
                    Company Name <span className="text-text-tertiary">*</span>
                  </label>
                  <input type="text" id="company" name="company" required className={inputClass} placeholder="Acme Corp" />
                </div>

                <div className="space-y-2">
                  <label htmlFor="industry" className="block text-sm font-medium text-text-secondary">
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
                  <label htmlFor="service" className="block text-sm font-medium text-text-secondary">
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
                <label htmlFor="message" className="block text-sm font-medium text-text-secondary">
                  How can we help you? <span className="text-text-tertiary">*</span>
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
                <div role="alert" className="p-4 bg-bg border border-border rounded-lg flex flex-wrap items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-text-secondary flex-shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1 basis-36">
                    <p className="text-sm font-medium text-text-primary">Submission not confirmed</p>
                    <p className="break-words text-sm text-text-secondary mt-1">{error}</p>
                  </div>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => formRef.current?.requestSubmit()}
                    className="min-h-11 shrink-0 px-3 py-2 bg-surface-hover hover:bg-surface text-text-primary text-sm font-medium rounded-lg transition-colors"
                  >
                    Retry
                  </button>
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="min-h-11 w-full md:w-auto px-8 py-3 rounded-lg bg-accent text-[#fff] font-medium text-sm transition-colors hover:opacity-90 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? 'Submitting...' : (
                    <>
                      Submit Inquiry <Send className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>

              <p className="text-center text-xs text-text-tertiary">
                By submitting this form, you agree to our <a href="#/privacy" className="text-text-secondary hover:underline">Privacy Policy</a>.
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
