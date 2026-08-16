import React, { useState, useEffect } from 'react';
import { Bell, Webhook, Mail, RefreshCw, CheckCircle2, AlertCircle, Save, Send } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { auth } from '../lib/firebase';
import { Button } from '../ui';

interface NotificationSettingsData {
  slackWebhookUrl: string;
  emailAlerts: boolean;
}

export default function NotificationSettings() {
  const { firebaseUser } = useAuth();

  const [slackWebhookUrl, setSlackWebhookUrl] = useState('');
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    fetchSettings();
  }, [firebaseUser]);

  const getAuthToken = async (): Promise<string | null> => {
    const currentUser = firebaseUser || auth.currentUser;
    if (!currentUser) {
      setError('You must be signed in to manage notification settings.');
      return null;
    }
    try {
      return await currentUser.getIdToken(true);
    } catch (err) {
      console.error('[NotificationSettings] Failed to get auth token:', err);
      setError('Authentication error. Please sign out and sign back in.');
      return null;
    }
  };

  const fetchSettings = async () => {
    setIsLoading(true);
    setError('');

    const token = await getAuthToken();
    if (!token) {
      setIsLoading(false);
      return;
    }

    try {
      const apiBase = import.meta.env.VITE_API_BASE_URL || '';
      const url = `${apiBase}/api/integrations/notifications`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          setError('Authentication required. Please sign in again.');
        } else {
          const data = await response.json().catch(() => ({}));
          console.error('[NotificationSettings] Fetch failed:', response.status, data);
          setError(data.error || 'Failed to load notification settings.');
        }
        setIsLoading(false);
        return;
      }

      const data: NotificationSettingsData = await response.json();
      setSlackWebhookUrl(data.slackWebhookUrl || '');
      setEmailAlerts(data.emailAlerts !== false);
    } catch (err: any) {
      console.error('[NotificationSettings] Fetch network error:', err?.message || err);
      setError('Network error. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError('');
    setSuccessMessage('');

    const token = await getAuthToken();
    if (!token) {
      setIsSaving(false);
      return;
    }

    try {
      const apiBase = import.meta.env.VITE_API_BASE_URL || '';
      const url = `${apiBase}/api/integrations/notifications`;

      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          slackWebhookUrl: slackWebhookUrl.trim(),
          emailAlerts,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        console.error('[NotificationSettings] Save failed:', response.status, data);
        setError(data.error || 'Failed to save notification settings.');
        return;
      }

      setSuccessMessage('Settings saved successfully!');
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err: any) {
      console.error('[NotificationSettings] Save network error:', err?.message || err);
      setError('Network error. Please check your connection and try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const isSlackConfigured = slackWebhookUrl.trim().startsWith('https://hooks.slack.com/');

  const handleSendTestAlert = async () => {
    if (!isSlackConfigured) {
      setError('Please configure a valid Slack webhook URL first and save your settings.');
      return;
    }

    setIsSendingTest(true);
    setError('');
    setSuccessMessage('');

    const token = await getAuthToken();
    if (!token) {
      setIsSendingTest(false);
      return;
    }

    try {
      const apiBase = import.meta.env.VITE_API_BASE_URL || '';
      const url = `${apiBase}/api/integrations/notifications/test`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          slackWebhookUrl: slackWebhookUrl.trim(),
        }),
      });

      let data: any = {};
      try {
        data = await response.json();
      } catch (parseErr) {
        console.error('[NotificationSettings] Failed to parse response:', parseErr);
      }

      if (!response.ok) {
        const errorMsg = data.error || `Failed to send test alert (status ${response.status}). Please try again.`;
        console.error('[NotificationSettings] Test alert failed:', response.status, errorMsg, data);
        setError(errorMsg);
        return;
      }

      setSuccessMessage(data.message || 'Test alert sent! Check your Slack channel for the notification.');
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err: any) {
      console.error('[NotificationSettings] Test Alert Error:', err);
      console.error('[NotificationSettings] Error details:', {
        message: err?.message,
        stack: err?.stack,
        url: `${import.meta.env.VITE_API_BASE_URL || ''}/api/integrations/notifications/test`,
      });
      setError(`Network error: ${err?.message || 'Please check your connection and try again.'}`);
    } finally {
      setIsSendingTest(false);
    }
  };

  if (isLoading) {
    return (
      <div className="glass-card rounded-2xl p-8">
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="skeleton skeleton-circle w-12 h-12" />
            <div className="space-y-2 flex-1">
              <div className="skeleton skeleton-text w-48" />
              <div className="skeleton skeleton-text-sm w-64" />
            </div>
          </div>
          <div className="space-y-4">
            <div className="skeleton w-full h-12 rounded-xl" />
            <div className="skeleton w-full h-24 rounded-xl" />
          </div>
          <div className="flex gap-3">
            <div className="skeleton w-32 h-12 rounded-xl" />
            <div className="skeleton w-36 h-12 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-7 py-6 border-b border-neutral-200/60 dark:border-white/5 bg-neutral-50/30 dark:bg-white/[0.02]">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/15 to-violet-500/15 dark:from-purple-500/20 dark:to-violet-500/20 flex items-center justify-center">
            <Bell className="w-6 h-6 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-neutral-900 dark:text-white tracking-tight">Notification Settings</h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
              Configure how you receive alerts for new leads
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <form onSubmit={handleSave} className="p-7 space-y-7">
        {/* Error Message */}
        {error && (
          <div className="p-4 bg-rose-50/80 dark:bg-rose-500/10 backdrop-blur-sm border border-rose-200/60 dark:border-rose-500/20 rounded-xl flex items-start gap-3 animate-shake">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            </div>
            <p className="text-sm font-medium text-rose-700 dark:text-rose-400 pt-1.5">{error}</p>
          </div>
        )}

        {/* Success Message */}
        {successMessage && (
          <div className="p-4 bg-emerald-50/80 dark:bg-emerald-500/10 backdrop-blur-sm border border-emerald-200/60 dark:border-emerald-500/20 rounded-xl flex items-start gap-3 animate-fade-in">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400 pt-1.5">{successMessage}</p>
          </div>
        )}

        {/* Slack Webhook Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-neutral-100 dark:bg-white/5 flex items-center justify-center">
                <Webhook className="w-4.5 h-4.5 text-neutral-600 dark:text-neutral-400" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-neutral-900 dark:text-white">Slack Notifications</h4>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Receive real-time alerts in your Slack channel
                </p>
              </div>
            </div>
            {isSlackConfigured && (
              <span className="px-2.5 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-bold rounded-full flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Configured
              </span>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-2">
              Slack Webhook URL
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400">
                <Webhook className="w-4 h-4" />
              </span>
              <input
                type="url"
                value={slackWebhookUrl}
                onChange={(e) => setSlackWebhookUrl(e.target.value)}
                placeholder="https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXX"
                className="w-full pl-10 pr-4 py-3 bg-white dark:bg-black/20 border border-neutral-200 dark:border-white/10 rounded-xl text-sm text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50 transition-all"
              />
            </div>
            <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-2">
              Create an Incoming Webhook in your Slack workspace settings to get this URL.
            </p>
          </div>

          {/* Slack Setup Instructions */}
          <div className="p-4 bg-neutral-50/80 dark:bg-neutral-800/40 rounded-xl border border-neutral-200/60 dark:border-neutral-700/40">
            <p className="text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-2">
              How to set up Slack webhooks:
            </p>
            <ol className="space-y-1.5 text-xs text-neutral-500 dark:text-neutral-400 list-decimal list-inside">
              <li>Go to your Slack workspace settings</li>
              <li>Navigate to "Apps" &rarr; "Manage" &rarr; "Custom Integrations"</li>
              <li>Click "Incoming Webhooks" and create a new webhook</li>
              <li>Choose the channel for notifications and copy the webhook URL</li>
            </ol>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-neutral-200 dark:border-white/10"></div>

        {/* Email Alerts Section */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-neutral-100 dark:bg-white/5 flex items-center justify-center">
              <Mail className="w-4.5 h-4.5 text-neutral-600 dark:text-neutral-400" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-neutral-900 dark:text-white">Email Alerts</h4>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Receive email notifications for high-priority leads
              </p>
            </div>
          </div>

          {/* Toggle Switch */}
          <button
            type="button"
            role="switch"
            aria-checked={emailAlerts}
            onClick={() => setEmailAlerts(!emailAlerts)}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-neutral-900 ${
              emailAlerts
                ? 'bg-purple-600'
                : 'bg-neutral-300 dark:bg-neutral-700'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                emailAlerts ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Action Buttons */}
        <div className="pt-6 border-t border-neutral-200/60 dark:border-white/5 flex flex-col sm:flex-row gap-4">
          <Button type="submit" variant="primary" disabled={isSaving} loading={isSaving}>
            {!isSaving && <Save className="w-4 h-4" />}
            {isSaving ? 'Saving...' : 'Save Settings'}
          </Button>

          <Button
            type="button"
            variant="secondary"
            onClick={handleSendTestAlert}
            disabled={isSendingTest || !isSlackConfigured}
            loading={isSendingTest}
            title={!isSlackConfigured ? 'Configure and save a Slack webhook URL first' : 'Send a test notification to your Slack channel'}
          >
            {!isSendingTest && <Send className="w-4 h-4" />}
            {isSendingTest ? 'Sending...' : 'Send Test Alert'}
          </Button>
        </div>

        {/* Test Alert Info */}
        {isSlackConfigured && (
          <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">
            Send a test lead notification to verify your Slack integration is working correctly.
          </p>
        )}
      </form>
    </div>
  );
}
