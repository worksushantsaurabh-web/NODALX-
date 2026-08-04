import React, { useMemo, useState } from 'react';
import { 
  Globe, Copy, Check, Settings2, Activity, MessageSquare, Database,
  Code2, Send, ArrowRight, Terminal, ExternalLink, Webhook
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-teal-700 dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400"
    >
      {copied ? <><Check className="h-3.5 w-3.5" /><span>Copied!</span></> : <><Copy className="h-3.5 w-3.5" /><span>{label}</span></>}
    </button>
  );
}

export default function IntegrationSetup() {
  const { user } = useAuth();
  const [activeExample, setActiveExample] = useState<'curl' | 'js' | 'make'>('curl');

  // Build the real endpoint URLs dynamically
  const baseUrl = useMemo(() => {
    if (import.meta.env.PROD) {
      return window.location.origin;
    }
    return import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001';
  }, []);

  const inquiryEndpoint = `${baseUrl}/api/inquiries`;
  const webhookEndpoint = `${baseUrl}/api/webhook/${user?.uid || '<your-user-id>'}`;

  const curlExample = `curl -X POST ${inquiryEndpoint} \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Jane Smith",
    "email": "jane@acme.com",
    "company": "Acme Corp",
    "message": "Interested in your enterprise plan"
  }'`;

  const jsExample = `const response = await fetch("${inquiryEndpoint}", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    name: "Jane Smith",
    email: "jane@acme.com",
    company: "Acme Corp",
    message: "Interested in your enterprise plan"
  })
});

const result = await response.json();
console.log(result); // { accepted: true, workflowResponse: ... }`;

  const makeExample = `1. In Make.com, create a new Scenario
2. Add a "Custom Webhook" module to receive payloads
3. Add your AI processing modules (e.g., Google Gemini)
4. Connect your output (Airtable, Slack, Email)
5. Copy the Make.com webhook URL
6. Set it as MAKE_WEBHOOK_URL in your backend:

   MAKE_WEBHOOK_URL="https://hook.us2.make.com/xxx"`;

  const exampleTabs = [
    { id: 'curl' as const, label: 'cURL', icon: Terminal },
    { id: 'js' as const, label: 'JavaScript', icon: Code2 },
    { id: 'make' as const, label: 'Make.com Setup', icon: Activity },
  ];

  return (
    <div className="space-y-10 animate-fade-in pb-16">
      {/* Header */}
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-600 dark:text-teal-400">Integration</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 dark:text-white">Pipeline Setup</h1>
        <p className="mt-2 max-w-2xl text-slate-500 dark:text-slate-400">
          Connect your forms, CRMs, and automation tools to route business inquiries through NodalX.
        </p>
      </div>

      {/* Live endpoints section */}
      <div className="rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-white/5">
        <div className="border-b border-slate-200 p-6 dark:border-white/10">
          <h2 className="flex items-center gap-2.5 text-lg font-bold text-slate-950 dark:text-white">
            <Send className="h-5 w-5 text-teal-600 dark:text-teal-400" />
            Live API Endpoints
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            These are your real, production-ready endpoints hosted on Firebase.
          </p>
        </div>

        <div className="space-y-6 p-6">
          {/* Primary inquiry endpoint */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">POST</span>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Submit inquiry</h3>
              <span className="text-xs text-slate-400">— primary inbound endpoint</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-black/20">
                <code className="block truncate px-4 py-3 text-sm text-slate-700 dark:text-slate-300">{inquiryEndpoint}</code>
              </div>
              <CopyButton text={inquiryEndpoint} />
            </div>
            <p className="text-xs text-slate-400">
              POST JSON with <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-600 dark:bg-white/10 dark:text-slate-300">name</code>, <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-600 dark:bg-white/10 dark:text-slate-300">email</code>, <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-600 dark:bg-white/10 dark:text-slate-300">company</code>, and <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-600 dark:bg-white/10 dark:text-slate-300">message</code> fields.
            </p>
          </div>

          {/* Generic webhook endpoint */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-blue-500/10 px-2 py-0.5 text-xs font-bold text-blue-700 dark:text-blue-300">POST</span>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Generic webhook</h3>
              <span className="text-xs text-slate-400">— for custom integrations</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-black/20">
                <code className="block truncate px-4 py-3 text-sm text-slate-700 dark:text-slate-300">{webhookEndpoint}</code>
              </div>
              <CopyButton text={webhookEndpoint} />
            </div>
            <p className="text-xs text-slate-400">
              Accepts any JSON payload. Use this for Zapier, Make, or custom webhook integrations.
            </p>
          </div>
        </div>
      </div>



      {/* How it flows */}
      <div className="rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-white/5">
        <div className="border-b border-slate-200 p-6 dark:border-white/10">
          <h2 className="flex items-center gap-2.5 text-lg font-bold text-slate-950 dark:text-white">
            <Webhook className="h-5 w-5 text-teal-600 dark:text-teal-400" />
            How the Pipeline Works
          </h2>
        </div>
        <div className="p-6">
          <div className="grid gap-4 sm:grid-cols-4">
            {[
              { step: '1', title: 'Inquiry arrives', desc: 'Your form or CRM posts data to the inquiry endpoint.', icon: Globe, color: 'text-teal-500', bg: 'bg-teal-500/10' },
              { step: '2', title: 'NodalX receives', desc: 'Firebase Cloud Function validates and forwards to Make.com.', icon: Send, color: 'text-blue-500', bg: 'bg-blue-500/10' },
              { step: '3', title: 'AI processes', desc: 'Make.com scenario classifies intent, urgency, and fit.', icon: Activity, color: 'text-rose-500', bg: 'bg-rose-500/10' },
              { step: '4', title: 'Action routed', desc: 'Result goes to Slack, CRM, email, or your dashboard.', icon: ArrowRight, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
            ].map((item, index) => (
              <div key={item.step} className="relative flex flex-col items-center text-center">
                {index < 3 && (
                  <div className="absolute left-[calc(50%+28px)] top-6 hidden h-0.5 w-[calc(100%-56px)] bg-slate-200 sm:block dark:bg-white/10" />
                )}
                <div className={`relative z-10 flex h-12 w-12 items-center justify-center rounded-2xl ${item.bg} ${item.color}`}>
                  <item.icon className="h-5 w-5" />
                </div>
                <h4 className="mt-3 text-sm font-bold text-slate-900 dark:text-white">{item.title}</h4>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Supported integrations */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-white/5">
        <h2 className="mb-6 text-lg font-bold text-slate-950 dark:text-white">Supported Integrations</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { name: 'Make.com Scenario', desc: 'AI-powered inquiry processing', icon: Activity, color: 'text-rose-500', bg: 'bg-rose-500/10', link: 'https://make.com' },
            { name: 'Airtable / CRM', desc: 'Sync and store customer data', icon: Database, color: 'text-emerald-500', bg: 'bg-emerald-500/10', link: 'https://airtable.com' },
            { name: 'Slack Alerts', desc: 'Real-time team notifications', icon: MessageSquare, color: 'text-indigo-500', bg: 'bg-indigo-500/10', link: 'https://slack.com' },
          ].map(tool => (
            <a
              key={tool.name}
              href={tool.link}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-start gap-4 rounded-2xl border border-slate-100 bg-slate-50/50 p-4 transition hover:border-teal-300 hover:shadow-sm dark:border-white/5 dark:bg-white/5 dark:hover:border-teal-500/30"
            >
              <div className={`shrink-0 rounded-xl p-2.5 ${tool.bg} ${tool.color}`}>
                <tool.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h5 className="flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-white">
                  {tool.name}
                  <ExternalLink className="h-3 w-3 text-slate-400 opacity-0 transition group-hover:opacity-100" />
                </h5>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{tool.desc}</p>
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
