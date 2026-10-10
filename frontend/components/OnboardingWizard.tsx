import { useState } from 'react';
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
  accepted: boolean;
  id: string;
  processingStatus: string;
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
            i < current ? 'bg-accent ' : 'bg-border-strong '
          } ${i === 0 ? 'w-10' : 'w-6'}`}
        />
      ))}
      <span className="text-xs text-text-secondary ml-1">
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
      if (!res.apiKey) throw new Error('A workspace key already exists. Use your saved key, or skip setup and rotate it in Sources & connections.');
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
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent to-accent-2 dark-ctx flex items-center justify-center">
          <Key className="w-6 h-6 text-[#fff] " strokeWidth={1.5} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-text-primary  tracking-tight mb-2">
            Welcome, {userName.split(' ')[0]}!
          </h2>
          <p className="text-text-tertiary  text-sm leading-relaxed max-w-xs mx-auto">
            Generate a workspace API key to connect your server or automation platform to NodalX.
          </p>
        </div>
        <button
          onClick={generate}
          disabled={loading}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl btn-primary text-[#fff] text-sm font-semibold transition-colors disabled:opacity-60"
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
        {error && <p className="text-xs text-rose-600 ">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center text-center gap-6">
      <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
        <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" strokeWidth={1.5} />
      </div>
      <div>
        <h2 className="text-2xl font-bold text-text-primary  tracking-tight mb-2">
          Your key is ready
        </h2>
        <p className="text-text-tertiary  text-sm">Copy it — you'll need it in the next step.</p>
      </div>

      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 p-3 g-input rounded-lg">
          <code className="flex-1 text-xs text-text-primary font-mono truncate">
            {key}
          </code>
          <button
            onClick={copy}
            className="shrink-0 p-1.5 rounded-md hover:bg-surface-hover text-text-secondary transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      <button
        onClick={() => onDone(key)}
        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl btn-primary text-[#fff] text-sm font-semibold transition-colors"
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
  const appHost = import.meta.env.DEV
    ? import.meta.env.VITE_PUBLIC_API_ORIGIN || window.location.origin
    : window.location.origin;
  const snippet = `curl -X POST '${appHost}/api/inquiries' \\
  -H 'Content-Type: application/json' \\
  -H 'X-API-Key: ${apiKey}' \\
  -d '{"name":"Jane Doe","email":"jane@example.com","company":"Acme","message":"Request a demo"}'`;

  const copy = () => {
    navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col items-center text-center gap-6">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent to-accent-2 dark-ctx flex items-center justify-center">
        <Code2 className="w-6 h-6 text-[#fff] " strokeWidth={1.5} />
      </div>
      <div>
        <h2 className="text-2xl font-bold text-text-primary  tracking-tight mb-2">
          Connect your server
        </h2>
        <p className="text-text-tertiary  text-sm leading-relaxed max-w-xs mx-auto">
          Send inquiries from your server or trusted automation tool. Keep the API key out of public HTML and browser JavaScript.
        </p>
      </div>

      <div className="w-full max-w-sm">
        <div className="relative rounded-lg bg-neutral-900  border border-border-strong text-left overflow-hidden dark-ctx">
          <div className="flex items-center justify-between px-4 py-2 border-b border-border-strong">
            <span className="text-[10px] text-text-secondary font-mono">Server request</span>
            <button
              onClick={copy}
              className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-neutral-300 hover:text-white transition-colors"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <pre className="px-4 py-3 text-xs text-neutral-200 font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap break-all">
            {snippet}
          </pre>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
        <button
          onClick={onDone}
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl btn-primary text-[#fff] text-sm font-semibold transition-colors"
        >
          Continue to test
          <ArrowRight className="w-4 h-4" />
        </button>
        <button
          onClick={onDone}
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg g-chip text-text-primary text-sm font-semibold hover:border-accent transition-colors"
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
      const baseUrl = import.meta.env.DEV
        ? import.meta.env.VITE_PUBLIC_API_ORIGIN || window.location.origin
        : window.location.origin;
      const res = await fetch(`${baseUrl}/api/inquiries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
        body: JSON.stringify(TEST_PAYLOAD),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.accepted !== true) throw new Error(data.error || `Server returned ${res.status}`);
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
    return (
      <div className="flex flex-col items-center text-center gap-6">
        <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
          <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" strokeWidth={1.5} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-text-primary  tracking-tight mb-2">
            It works.
          </h2>
          <p className="text-text-tertiary  text-sm">
            The test inquiry was stored in your dashboard. AI processing status: {result.processingStatus.replaceAll('_', ' ')}.
          </p>
        </div>

        <div className="w-full max-w-sm g-card rounded-2xl overflow-hidden text-left">
          <div className="px-4 py-3 border-b border-border bg-surface">
            <p className="text-xs font-semibold text-text-tertiary ">Inquiry from Sarah K. · Meridian Group</p>
          </div>
          <div className="p-4 text-xs text-text-secondary">Inquiry ID: {result.id}</div>
        </div>

        <button
          onClick={onDone}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl btn-primary text-[#fff] text-sm font-semibold transition-colors"
        >
          Go to my dashboard
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center text-center gap-6">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent to-accent-2 dark-ctx flex items-center justify-center">
        <Zap className="w-6 h-6 text-[#fff] " strokeWidth={1.5} />
      </div>
      <div>
        <h2 className="text-2xl font-bold text-text-primary  tracking-tight mb-2">
          See it work in 10 seconds
        </h2>
        <p className="text-text-tertiary  text-sm leading-relaxed max-w-xs mx-auto">
          Send a test inquiry and confirm NodalX stores it in your dashboard.
        </p>
      </div>

      {/* Preview of the test inquiry */}
      <div className="w-full max-w-sm g-card rounded-2xl p-4 text-left space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">Test inquiry</p>
        <p className="text-sm font-semibold text-text-primary">Sarah K. · Meridian Group</p>
        <p className="text-xs text-text-tertiary  leading-relaxed line-clamp-2">
          "{TEST_PAYLOAD.message}"
        </p>
      </div>

      {error && <p className="text-xs text-rose-600 ">{error}</p>}

      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
        <button
          onClick={send}
          disabled={loading}
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl btn-primary text-[#fff] text-sm font-semibold transition-colors disabled:opacity-60"
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
          className="flex-1 inline-flex items-center justify-center px-4 py-2.5 rounded-lg g-chip text-text-primary text-sm font-semibold hover:border-accent transition-colors"
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
    <div className="fixed inset-0 z-50 flex flex-col bg-bg overflow-y-auto">
      {/* Top bar */}
      <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-border">
        <NodalXLogo className="w-8 h-8" />
        <ProgressBar step={step} />
        <button
          onClick={skip}
          className="text-xs text-text-secondary hover:text-text-primary transition-colors flex items-center gap-1"
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
