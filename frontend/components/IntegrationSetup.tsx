import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function IntegrationSetup() {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const apiOrigin = import.meta.env.DEV
    ? import.meta.env.VITE_PUBLIC_API_ORIGIN || window.location.origin
    : window.location.origin;
  const endpoint = `${apiOrigin}/api/inquiries`;
  const webhookEndpoint = `${apiOrigin}/api/webhook/${user?.uid || '<workspace-id>'}`;
  const copy = async () => {
    await navigator.clipboard.writeText(endpoint);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">Pipeline setup</p>
        <h1 className="mt-2 text-3xl font-semibold">Bring inquiries into one desk</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-400">Connect an existing form or automation using your workspace API key. Each accepted inquiry is saved to your dashboard. AI fields appear when the processing workflow returns them.</p>
      </div>
      <div className="rounded-xl border border-border bg-surface p-6">
        <h2 className="text-lg font-semibold">Form or CRM intake</h2>
        <p className="mt-2 text-sm text-neutral-400">Send a POST request from your server with an <code>X-API-Key</code> header. Keep the key off public pages.</p>
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-border-strong bg-bg p-3">
          <code className="min-w-0 flex-1 truncate text-xs">{endpoint}</code>
          <button type="button" onClick={() => void copy()} className="rounded-lg border border-border-strong p-2" aria-label="Copy inquiry endpoint">{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}</button>
        </div>
        <pre className="mt-4 overflow-x-auto rounded-lg bg-bg p-4 text-xs">{`curl -X POST '${endpoint}' \\
  -H 'Content-Type: application/json' \\
  -H 'X-API-Key: YOUR_WORKSPACE_KEY' \\
  -d '{"name":"Jane Smith","email":"jane@acme.com","company":"Acme","message":"Request a demo"}'`}</pre>
      </div>
      <div className="rounded-xl border border-border bg-surface p-6">
        <h2 className="text-lg font-semibold">Automation webhook</h2>
        <p className="mt-2 text-sm text-neutral-400">Use the same JSON fields and API key when posting from Make or another server. The workspace ID in the URL is checked against the key.</p>
        <code className="mt-4 block overflow-x-auto rounded-lg border border-border-strong bg-bg p-3 text-xs">{webhookEndpoint}</code>
        <p className="mt-3 text-xs text-neutral-400">An accepted response confirms storage. The <code>processingStatus</code> field reports whether AI classification was returned, failed, or is not configured.</p>
      </div>
    </section>
  );
}
