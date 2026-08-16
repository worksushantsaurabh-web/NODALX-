import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../src/services/api';
import AccessKeyRedemption from './AccessKeyRedemption';
import { useUserTier } from '../hooks/useUserTier';
import {
  Key, Copy, Check, Send, Terminal, Code2, Activity, Globe, ArrowRight,
  Pencil, Sparkles, Shield, RefreshCw, Zap, Eye, EyeOff, Loader2
} from 'lucide-react';
import { Analytics } from '../lib/analytics';

export default function CustomerOnboarding() {
  const { user } = useAuth();
  const { refetch: refetchUserTier } = useUserTier();
  
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState('');
  const [plan, setPlan] = useState('starter');
  const [totalInquiries, setTotalInquiries] = useState(0);
  const [lastUsedAt, setLastUsedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [updateNameError, setUpdateNameError] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [activeTab, setActiveTab] = useState<'widget' | 'html' | 'curl' | 'python' | 'react'>('widget');
  const [showKey, setShowKey] = useState(false);
  const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({});
  
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await api.get<{
          hasApiKey: boolean;
          apiKey?: string;
          businessName?: string;
          plan?: string;
          totalInquiries?: number;
          lastUsedAt?: string;
        }>('/api/onboarding/status');
        
        if (response.hasApiKey) {
          setApiKey(response.apiKey || null);
          setBusinessName(response.businessName || 'My Company');
          setPlan(response.plan || 'starter');
          setTotalInquiries(response.totalInquiries || 0);
          setLastUsedAt(response.lastUsedAt || null);
        }
      } catch (error) {
        console.error('Error fetching onboarding status:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    if (user) {
      fetchStatus();
    } else {
      setIsLoading(false);
    }
  }, [user]);

  const handleGenerateKey = async () => {
    setIsGenerating(true);
    setGenerateError(null);
    try {
      const response = await api.post<{
        apiKey: string;
        businessName: string;
        plan: string;
        createdAt: string;
      }>('/api/onboarding/generate-key', { businessName: 'My Company' });

      setApiKey(response.apiKey);
      setBusinessName(response.businessName);
      setPlan(response.plan);
      Analytics.apiKeyGenerated();
    } catch (error: any) {
      setGenerateError(error?.message || 'Failed to generate API key. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdateNameError(null);
    try {
      await api.put('/api/onboarding/business-name', { businessName });
      setIsEditingName(false);
    } catch (error: any) {
      setUpdateNameError(error?.message || 'Failed to update name. Please try again.');
    }
  };

  const handleTestInquiry = async () => {
    if (!apiKey) return;
    
    setIsTesting(true);
    setTestResult(null);
    try {
      const baseUrl = import.meta.env.VITE_APP_HOST || window.location.origin;
        
      const response = await fetch(`${baseUrl}/api/inquiries`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
        body: JSON.stringify({
          name: 'Test Lead',
          email: 'test@example.com',
          company: 'Test Company',
          message: 'This is a test inquiry from the NodalX dashboard.',
        }),
      });

      if (response.ok) {
        setTestResult({ success: true, message: 'Test inquiry received successfully!' });
        setTotalInquiries(prev => prev + 1);
        setLastUsedAt(new Date().toISOString());
      } else {
        const errData = await response.json().catch(() => ({}));
        setTestResult({ success: false, message: errData.error || 'Failed to send test inquiry.' });
      }
    } catch (error) {
      console.error('Error sending test inquiry:', error);
      setTestResult({ success: false, message: 'Network error while sending test inquiry.' });
    } finally {
      setIsTesting(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedStates(prev => ({ ...prev, [id]: true }));
    setTimeout(() => {
      setCopiedStates(prev => ({ ...prev, [id]: false }));
    }, 2000);
  };

  const maskedKey = apiKey 
    ? `${apiKey.substring(0, 12)}...${apiKey.substring(apiKey.length - 4)}` 
    : '';

  const renderCodeSnippet = () => {
    const snippets = {
      widget: `<!-- 1-Line NODALxAI Form Widget Script -->
<script
  src="${import.meta.env.VITE_APP_HOST}/widget.js"
  data-api-key="${apiKey || 'nxk_live_...'}"
></script>

<!-- Attach to any existing HTML form by adding id="nodalx-form" -->
<form id="nodalx-form">
  <input type="text" name="name" placeholder="Full Name" required />
  <input type="email" name="email" placeholder="Email Address" required />
  <input type="text" name="company" placeholder="Company Name" />
  <textarea name="message" placeholder="How can we help?"></textarea>
  <button type="submit">Submit Inquiry</button>
</form>`,
      html: `<form id="contact-form">
  <input type="text" id="name" placeholder="Full Name" required />
  <input type="email" id="email" placeholder="Email Address" required />
  <input type="text" id="company" placeholder="Company Name" />
  <textarea id="message" placeholder="How can we help?"></textarea>
  <button type="submit">Submit Inquiry</button>
</form>

<script>
document.getElementById('contact-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const data = {
    name: document.getElementById('name').value,
    email: document.getElementById('email').value,
    company: document.getElementById('company').value,
    message: document.getElementById('message').value,
  };

  try {
    const response = await fetch(\`\${import.meta.env.VITE_APP_HOST}/api/inquiries\`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': '${apiKey || 'nxk_live_...'}'
      },
      body: JSON.stringify(data)
    });
    
    if (response.ok) alert('Success!');
  } catch (error) {
    console.error('Error:', error);
  }
});
</script>`,
      curl: `curl -X POST ${import.meta.env.VITE_APP_HOST}/api/inquiries \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ${apiKey || 'nxk_live_...'}" \\
  -d '{
    "name": "Jane Doe",
    "email": "jane@example.com",
    "message": "Interested in your AI services."
  }'`,
      python: `import requests

url = "${import.meta.env.VITE_APP_HOST}/api/inquiries"
headers = {
    "Content-Type": "application/json",
    "X-API-Key": "${apiKey || 'nxk_live_...'}"
}
data = {
    "name": "Jane Doe",
    "email": "jane@example.com",
    "message": "Interested in your AI services."
}

response = requests.post(url, json=data, headers=headers)
print(response.json())`,
      react: `import { useState } from 'react';

export function ContactForm() {
  const [status, setStatus] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('sending');
    
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());

    try {
      const res = await fetch('${import.meta.env.VITE_APP_HOST}/api/inquiries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': '${apiKey || 'nxk_live_...'}'
        },
        body: JSON.stringify(data)
      });
      
      setStatus(res.ok ? 'success' : 'error');
    } catch (err) {
      setStatus('error');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Add your inputs here */}
      <button type="submit" disabled={status === 'sending'}>
        {status === 'sending' ? 'Sending...' : 'Send'}
      </button>
    </form>
  );
}`
    };

    return snippets[activeTab];
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="h-8 w-8 text-black dark:text-white animate-spin mb-4" />
        <p className="text-neutral-500 dark:text-neutral-400">Loading your integration status...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
          <Zap className="h-4 w-4 text-black dark:text-white" />
          <span className="text-xs font-semibold text-black dark:text-white tracking-wider">INTEGRATION</span>
        </div>
        <h1 className="text-3xl font-bold text-neutral-900 dark:text-white tracking-tight">Your API Key</h1>
        <p className="text-neutral-600 dark:text-neutral-400 text-lg max-w-2xl">
          Use this key to connect your website or app to the NodalX AI pipeline.
        </p>
      </div>

      {/* API Key Card */}
      <div className="bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-6 md:p-8 space-y-6">
          {!apiKey ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-6 text-center">
              <div className="h-16 w-16 bg-neutral-50 dark:bg-neutral-800 rounded-full flex items-center justify-center">
                <Key className="h-8 w-8 text-black dark:text-white" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-neutral-900 dark:text-white mb-2">Generate Your API Key</h3>
                <p className="text-neutral-500 dark:text-neutral-400 max-w-md mx-auto">
                  Create a unique API key to securely send leads and inquiries directly into your NodalX AI pipeline.
                </p>
              </div>
              <button
                onClick={handleGenerateKey}
                disabled={isGenerating}
                className="inline-flex items-center gap-2 px-6 py-3 bg-black hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-200 dark:text-black text-white rounded-lg font-medium transition-colors disabled:opacity-70"
              >
                {isGenerating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
                {isGenerating ? 'Generating...' : 'Generate API Key'}
              </button>
              {generateError && (
                <p className="mt-3 text-sm text-rose-600 dark:text-rose-400">{generateError}</p>
              )}
            </div>
          ) : (
            <div className="space-y-8">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                <div className="space-y-4 flex-1">
                  <div className="flex items-center gap-3">
                    {isEditingName ? (
                      <form onSubmit={handleUpdateName} className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={businessName}
                            onChange={(e) => setBusinessName(e.target.value)}
                            className="px-3 py-1 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-md text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-neutral-400"
                            autoFocus
                          />
                          <button type="submit" className="p-1.5 bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-700">
                            <Check className="h-4 w-4" />
                          </button>
                        </div>
                        {updateNameError && (
                          <p className="text-xs text-rose-600 dark:text-rose-400">{updateNameError}</p>
                        )}
                      </form>
                    ) : (
                      <div className="flex items-center gap-2">
                        <h3 className="text-xl font-semibold text-neutral-900 dark:text-white">{businessName}</h3>
                        <button 
                          onClick={() => setIsEditingName(true)}
                          className="p-1 text-neutral-400 hover:text-black dark:hover:text-white transition-colors"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                    <span className="px-2.5 py-0.5 bg-neutral-100 dark:bg-white/10 text-neutral-600 dark:text-neutral-300 rounded-md text-xs font-medium capitalize">
                      {plan} Plan
                    </span>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 flex items-center gap-2">
                      <Shield className="h-4 w-4 text-black dark:text-white" />
                      Live API Key
                    </label>
                    <div className="flex items-center gap-2 max-w-lg">
                      <div className="flex-1 flex items-center justify-between bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-4 py-3 font-mono text-sm text-neutral-800 dark:text-neutral-200">
                        <span>{showKey ? apiKey : maskedKey}</span>
                        <button 
                          onClick={() => setShowKey(!showKey)}
                          className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 focus:outline-none"
                        >
                          {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <button 
                        onClick={() => copyToClipboard(apiKey, 'main-key')}
                        className="p-3 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-lg transition-colors flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-neutral-400"
                        title="Copy API Key"
                      >
                        {copiedStates['main-key'] ? <Check className="h-5 w-5 text-black dark:text-white" /> : <Copy className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 md:flex-col md:w-48 pt-2">
                  <div className="bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-800 rounded-xl p-4 flex-1">
                    <div className="text-sm text-neutral-500 dark:text-neutral-400 mb-1 flex items-center gap-2">
                      <Activity className="h-4 w-4" />
                      Total Inquiries
                    </div>
                    <div className="text-2xl font-bold text-neutral-900 dark:text-white">{totalInquiries}</div>
                  </div>
                  <div className="bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-800 rounded-xl p-4 flex-1">
                    <div className="text-sm text-neutral-500 dark:text-neutral-400 mb-1 flex items-center gap-2">
                      <RefreshCw className="h-4 w-4" />
                      Last Used
                    </div>
                    <div className="text-sm font-medium text-neutral-900 dark:text-white truncate">
                      {lastUsedAt ? new Date(lastUsedAt).toLocaleDateString() : 'Never'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Test Button Section */}
              <div className="pt-6 border-t border-neutral-100 dark:border-white/10">
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <button 
                    onClick={handleTestInquiry}
                    disabled={isTesting}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 bg-black hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-200 dark:text-black text-white rounded-lg font-medium transition-colors disabled:opacity-70 focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:ring-offset-2 dark:focus:ring-offset-neutral-900"
                  >
                    {isTesting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                    {isTesting ? 'Sending...' : 'Send Test Inquiry'}
                  </button>
                  
                  {testResult && (
                    <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm w-full sm:w-auto ${
                      testResult.success 
                        ? 'bg-neutral-50 dark:bg-neutral-800 text-black dark:text-white border border-neutral-200 dark:border-neutral-700' 
                        : 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/20'
                    }`}>
                      {testResult.success ? <Check className="h-4 w-4 shrink-0" /> : <Activity className="h-4 w-4 shrink-0" />}
                      {testResult.message}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick Integration Guide */}
      {apiKey && (
        <div className="bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-6 md:p-8 border-b border-neutral-100 dark:border-white/10">
            <h2 className="text-xl font-bold text-neutral-900 dark:text-white flex items-center gap-2">
              <Code2 className="h-6 w-6 text-black dark:text-white" />
              Quick Integration Guide
            </h2>
            <p className="text-neutral-500 dark:text-neutral-400 mt-2">
              Copy these snippets to easily integrate the NodalX AI pipeline into your application.
            </p>
          </div>
          
          <div className="flex flex-col md:flex-row">
            <div className="w-full md:w-48 bg-neutral-50 dark:bg-neutral-900/50 border-r border-neutral-200 dark:border-neutral-800">
              <div className="flex md:flex-col p-2 gap-1 overflow-x-auto">
                {[
                  { id: 'widget', label: '1-Line Widget', icon: Zap },
                  { id: 'html', label: 'HTML / JS', icon: Globe },
                  { id: 'curl', label: 'cURL', icon: Terminal },
                  { id: 'python', label: 'Python', icon: Code2 },
                  { id: 'react', label: 'React', icon: Code2 }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                      activeTab === tab.id
                        ? 'bg-white dark:bg-neutral-800 text-black dark:text-white shadow-sm border border-neutral-200 dark:border-neutral-700'
                        : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800/80'
                    }`}
                  >
                    <tab.icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 relative bg-neutral-900">
              <div className="absolute top-4 right-4 z-10">
                <button
                  onClick={() => copyToClipboard(renderCodeSnippet(), 'snippet')}
                  className="flex items-center gap-2 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-md transition-colors border border-neutral-700 text-sm"
                >
                  {copiedStates['snippet'] ? (
                    <>
                      <Check className="h-4 w-4 text-neutral-400" />
                      <span className="text-neutral-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      <span>Copy Code</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="p-6 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] text-sm font-mono text-neutral-300 h-full w-full min-h-[300px] whitespace-pre-wrap break-all md:break-normal md:whitespace-pre">
                <code>{renderCodeSnippet()}</code>
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Access Key Redemption */}
      <div className="bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-2xl p-6 md:p-8 shadow-sm space-y-4">
        <div>
          <h2 className="text-xl font-bold text-neutral-900 dark:text-white">Have an access key?</h2>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Redeem it below to instantly upgrade your account to full plan.
          </p>
        </div>
        <AccessKeyRedemption onRedemptionSuccess={refetchUserTier} />
      </div>

      {/* What Happens Next - Pipeline Visualization */}
      <div className="bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-2xl p-6 md:p-8 shadow-sm">
        <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-8">What Happens Next?</h2>
        
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 md:gap-2">
          {[
            { step: 1, title: 'Inquiry Arrives', desc: 'Customer submits form', icon: Globe },
            { step: 2, title: 'NodalX Receives', desc: 'Via secure API', icon: Shield },
            { step: 3, title: 'AI Processes', desc: 'Classification & parsing', icon: Sparkles },
            { step: 4, title: 'Result Stored', desc: 'Ready for action', icon: Check }
          ].map((item, index, arr) => (
            <React.Fragment key={item.step}>
              <div className="flex flex-col items-center text-center space-y-3 w-full md:w-1/4">
                <div className="h-12 w-12 rounded-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center text-black dark:text-white relative z-10">
                  <item.icon className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="font-semibold text-neutral-900 dark:text-white text-sm">{item.title}</h4>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">{item.desc}</p>
                </div>
              </div>
              {index < arr.length - 1 && (
                <div className="hidden md:flex w-full md:w-auto flex-1 items-center justify-center">
                  <div className="h-[2px] w-full bg-neutral-200 dark:bg-neutral-700 relative flex items-center justify-center">
                    <ArrowRight className="h-4 w-4 text-neutral-300 dark:text-neutral-600 absolute bg-white dark:bg-[#121827] px-1" />
                  </div>
                </div>
              )}
              {index < arr.length - 1 && (
                <div className="md:hidden flex h-8 items-center justify-center">
                  <ArrowRight className="h-4 w-4 text-neutral-300 dark:text-neutral-600 rotate-90" />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
