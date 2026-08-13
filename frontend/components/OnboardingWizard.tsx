import React, { useState } from 'react';
import { CheckCircle2, Copy, Check, Zap, Code2, Key, ArrowRight, X } from 'lucide-react';
import { NodalXLogo } from './Navbar';
import { Analytics } from '../lib/analytics';
import { useFeedback } from '../contexts/FeedbackContext';
import { api } from '../src/services/api';

interface OnboardingWizardProps {
  userName: string;
  onComplete: () => void;
}

type Step = 'key' | 'snippet' | 'test' | 'done';

interface TestResult {
  score?: number | string;
  intent?: string;
  category?: string;
  summary?: string;
  suggested_action?: string;
}

const TOTAL_STEPS = 3;
const stepIndex: Record<Step, number> = { key: 1, snippet: 2, test: 3, done: 3 };

// ─── Progress bar ──────────────────────────────────────────────────────────

function ProgressBar({ step }: { step: Step }) {
  const current = stepIndex[step];
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <div
          key={i}
          className={`h-1 rounded-full transition-all duration-300 ${
            i < current ? 'bg-teal-600' : 'bg-slate-200 dark:bg-slate-700'
          } ${i === 0 ? 'w-10' : 'w-6'}`}
        />
      ))}
      <span className="text-xs text-slate-400 ml-1">
        {current} of {TOTAL_STEPS}
      </span>
    </div>
  );
}

// ─── Step 1: Generate key ──────────────────────────────────────────────────

function StepKey({
  userName,
  onDone,
}: {
  userName: string;
  onDone: (key: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [key, setKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post<{ apiKey: string; businessName: string; plan: string }>('/api/onboarding/generate-key', {
        businessName: 'My Company',
      });
      setKey(res.apiKey);
      Analytics.apiKeyGenerated();
    } catch (e: any) {
      setError(e?.message || 'Failed to generate key. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const copy = () => {
    if (!key) return;
    navigator.clipboard.writeText(key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!key) {
    return (
      <div className="flex flex-col items-center text-center gap-6">
        <div className="w-14 h-14 rounded-2xl bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center">
          <Key className="w-6 h-6 text-teal-600 dark:text-teal-400" strokeWidth={1.5} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight mb-2">
            Welcome, {userName.split(' ')[0]}!
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed max-w-xs mx-auto">
            Let's get you set up in 2 minutes. First, generate your API key — it connects your website form to the AI.
          </p>
        </div>
        <button
          onClick={generate}
          disabled={loading}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold transition-colors disabled:opacity-60"
        >
          {loading ? (
            <>
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Generating…
            </>
          ) : (
            <>
              <Zap className="w-4 h-4" />
              Generate my API key
            </>
          )}
        </button>
        {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center text-center gap-6">
      <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
        <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" strokeWidth={1.5} />
      </div>
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight mb-2">
          Your key is ready
        </h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm">Copy it — you'll need it in the next step.</p>
      </div>

      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
          <code className="flex-1 text-xs text-slate-700 dark:text-slate-200 font-mono truncate">
            {key}
          </code>
          <button
            onClick={copy}
            className="shrink-0 p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      <button
        onClick={() => onDone(key)}
        className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold transition-colors"
      >
        Next: add to your site
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}

// ─── Step 2: Snippet ───────────────────────────────────────────────────────

function StepSnippet({ apiKey, onDone }: { apiKey: string; onDone: () => void }) {
  const [copied, setCopied] = useState(false);
  const appHost = import.meta.env.VITE_APP_HOST || 'https://app.nodalxai.com';

  const snippet = `<script
  src="${appHost}/widget.js"
  data-api-key="${apiKey}"
></script>`;

  const copy = () => {
    navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col items-center text-center gap-6">
      <div className="w-14 h-14 rounded-2xl bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center">
        <Code2 className="w-6 h-6 text-teal-600 dark:text-teal-400" strokeWidth={1.5} />
      </div>
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight mb-2">
          Add this to your site
        </h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed max-w-xs mx-auto">
          One script tag. Paste it before the <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 rounded">&lt;/body&gt;</code> of any page with a contact form.
        </p>
      </div>

      <div className="w-full max-w-sm">
        <div className="relative rounded-lg bg-slate-900 dark:bg-slate-800 border border-slate-700 text-left overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700">
            <span className="text-[10px] text-slate-400 font-mono">HTML</span>
            <button
              onClick={copy}
              className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-slate-300 hover:text-white transition-colors"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <pre className="px-4 py-3 text-xs text-slate-200 font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap break-all">
            {snippet}
          </pre>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
        <button
          onClick={onDone}
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold transition-colors"
        >
          I've added it
          <ArrowRight className="w-4 h-4" />
        </button>
        <button
          onClick={onDone}
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}

// ─── Step 3: Test inquiry ──────────────────────────────────────────────────

const TEST_PAYLOAD = {
  name: 'Sarah K.',
  email: 'sarah@meridiangroup.io',
  company: 'Meridian Group',
  message: "We're looking for an automated way to handle our enterprise sales inquiries. We get around 200 per month and the team is overwhelmed. Budget is roughly $3K/month.",
};

function StepTest({ apiKey, onDone }: { apiKey: string; onDone: () => void }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { showSurvey } = useFeedback();

  const send = async () => {
    setLoading(true);
    setError(null);
    try {
      const baseUrl = import.meta.env.VITE_APP_HOST || window.location.origin;
      const res = await fetch(`${baseUrl}/api/inquiries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
        body: JSON.stringify(TEST_PAYLOAD),
      });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = await res.json().catch(() => ({}));
      setResult(data);
      Analytics.testInquirySent();
      showSurvey({ question: 'How smooth was setup?', context: 'onboarding_complete', delayMs: 2500 });
    } catch (e: any) {
      setError(e?.message || 'Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    const score = result.score ?? result.fit_score ?? '—';
    return (
      <div className="flex flex-col items-center text-center gap-6">
        <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
          <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" strokeWidth={1.5} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight mb-2">
            It works.
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            The AI read the inquiry, scored it, and drafted a reply — automatically.
          </p>
        </div>

        <div className="w-full max-w-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden text-left">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Inquiry from Sarah K. · Meridian Group</p>
          </div>
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Fit score</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">{score}/10</span>
            </div>
            {result.intent && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Intent</span>
                <span className="font-semibold text-slate-700 dark:text-slate-200 capitalize">{result.intent}</span>
              </div>
            )}
            {result.category && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Category</span>
                <span className="font-semibold text-slate-700 dark:text-slate-200">{result.category}</span>
              </div>
            )}
            {result.suggested_action && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Suggested action</p>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{result.suggested_action}</p>
              </div>
            )}
            {!result.intent && !result.category && !result.suggested_action && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Inquiry received and queued for AI processing.</p>
            )}
          </div>
        </div>

        <button
          onClick={onDone}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold transition-colors"
        >
          Go to my dashboard
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center text-center gap-6">
      <div className="w-14 h-14 rounded-2xl bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center">
        <Zap className="w-6 h-6 text-teal-600 dark:text-teal-400" strokeWidth={1.5} />
      </div>
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight mb-2">
          See it work in 10 seconds
        </h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed max-w-xs mx-auto">
          We'll send a real inquiry through your pipeline and show you what the AI does with it.
        </p>
      </div>

      {/* Preview of the test inquiry */}
      <div className="w-full max-w-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-4 text-left space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Test inquiry</p>
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Sarah K. · Meridian Group</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2">
          "{TEST_PAYLOAD.message}"
        </p>
      </div>

      {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}

      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
        <button
          onClick={send}
          disabled={loading}
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold transition-colors disabled:opacity-60"
        >
          {loading ? (
            <>
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Processing…
            </>
          ) : (
            <>
              <Zap className="w-4 h-4" />
              Send test inquiry
            </>
          )}
        </button>
        <button
          onClick={onDone}
          className="flex-1 inline-flex items-center justify-center px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}

// ─── Root wizard ───────────────────────────────────────────────────────────

export default function OnboardingWizard({ userName, onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState<Step>('key');
  const [apiKey, setApiKey] = useState('');

  const skip = () => {
    localStorage.removeItem('nodalx_wizard');
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-slate-950 overflow-y-auto">
      {/* Top bar */}
      <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
        <NodalXLogo className="w-8 h-8" />
        <ProgressBar step={step} />
        <button
          onClick={skip}
          className="text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors flex items-center gap-1"
        >
          <X className="w-3.5 h-3.5" />
          Skip setup
        </button>
      </div>

      {/* Step content */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {step === 'key' && (
            <StepKey
              userName={userName}
              onDone={(key) => { setApiKey(key); setStep('snippet'); }}
            />
          )}
          {step === 'snippet' && (
            <StepSnippet
              apiKey={apiKey}
              onDone={() => setStep('test')}
            />
          )}
          {step === 'test' && (
            <StepTest
              apiKey={apiKey}
              onDone={() => {
                localStorage.removeItem('nodalx_wizard');
                onComplete();
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
