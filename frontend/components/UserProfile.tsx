import React, { useCallback, useEffect, useState } from 'react';
import {
  Bell,
  Building2,
  Camera,
  Check,
  Clock,
  Globe,
  Loader2,
  LogOut,
  Mail,
  Save,
  Shield,
  Sparkles,
  User as UserIcon,
  Zap,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { userService, UserProfile, UpdateProfileData } from '../src/services/user';

const TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Paris',
  'Asia/Kolkata',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Australia/Sydney',
];

const TIER_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  trial: { label: 'Trial', color: 'text-text-primary', bg: 'bg-surface-hover' },
  starter: { label: 'Starter', color: 'text-text-primary', bg: 'bg-surface-hover' },
  growth: { label: 'Growth', color: 'text-text-primary', bg: 'bg-surface-hover' },
  free: { label: 'Free', color: 'text-text-tertiary ', bg: 'bg-surface-hover ' },
  pro: { label: 'Pro', color: 'text-text-primary ', bg: 'bg-surface-hover ' },
  enterprise: { label: 'Enterprise', color: 'text-indigo-700 ', bg: 'bg-indigo-500/10' },
};

export default function UserProfilePage() {
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Editable fields
  const [displayName, setDisplayName] = useState('');
  const [workspace, setWorkspace] = useState('');
  const [role, setRole] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [notifications, setNotifications] = useState({
    flowFailure: true,
    weeklySummary: true,
    securityAlerts: true,
  });

  const loadProfile = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await userService.getProfile();
      setProfile(data);
      setDisplayName(data.displayName || '');
      setWorkspace(data.workspace || '');
      setRole(data.role || '');
      setTimezone(data.timezone || 'UTC');
      setNotifications(data.notifications || { flowFailure: true, weeklySummary: true, securityAlerts: true });
    } catch (err) {
      console.error('Failed to load profile:', err);
      setError('Unable to load your profile. Please try again.');
      if (user) {
        setDisplayName(user.displayName || '');
      }
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    setError(null);
    try {
      const updates: UpdateProfileData = {
        displayName,
        workspace,
        role,
        timezone,
        notifications,
      };
      const updated = await userService.updateProfile(updates);
      setProfile(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to save profile:', err);
      setError('Failed to save your changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const tierInfo = TIER_LABELS[profile?.subscription?.tier || 'free'] || TIER_LABELS.free;
  const executionsUsed = profile?.subscription?.executionsUsed || 0;
  const executionsLimit = profile?.subscription?.executionsLimit || 1000;
  const usagePercent = Math.min(Math.round((executionsUsed / executionsLimit) * 100), 100);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
        <span className="ml-3 text-sm text-text-tertiary">Loading profile…</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in pb-16">
      {/* Page header */}
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">Account</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-text-primary">Your profile</h1>
        <p className="mt-2 text-text-tertiary ">Manage your account settings, preferences, and subscription.</p>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4">
          <p className="text-sm font-semibold text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {saveSuccess && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <Check className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Profile saved successfully.</p>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        {/* Left column – editable details */}
        <div className="space-y-6">

          {/* Identity card */}
          <div className="g-card rounded-2xl p-6">
            <h2 className="mb-6 flex items-center gap-2.5 text-lg font-bold text-text-primary">
              <UserIcon className="h-5 w-5 text-accent" /> Personal info
            </h2>

            <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
              {/* Avatar */}
              <div className="group relative flex-shrink-0">
                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-accent to-accent-2 text-2xl font-bold text-[#fff] shadow-lg shadow-accent/20">
                  {user?.photoURL ? (
                    <img src={user.photoURL} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    (displayName || 'U').charAt(0).toUpperCase()
                  )}
                </div>
                <div className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-border bg-accent text-[#fff]">
                  <Camera className="h-3 w-3" />
                </div>
              </div>

              <div className="flex-1 space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-text-secondary">Display name</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    className="g-input w-full px-4 py-2.5 text-sm font-medium text-text-primary"
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-text-secondary">Email</label>
                  <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-hover/40 px-4 py-2.5">
                    <Mail className="h-4 w-4 text-text-secondary" />
                    <span className="text-sm text-text-tertiary ">{user?.email || profile?.email || '—'}</span>
                  </div>
                  <p className="mt-1 text-xs text-text-secondary">Email is managed by your sign-in provider.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Workspace card */}
          <div className="g-card rounded-2xl p-6">
            <h2 className="mb-6 flex items-center gap-2.5 text-lg font-bold text-text-primary">
              <Building2 className="h-5 w-5 text-accent" /> Workspace
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-text-secondary">Workspace name</label>
                <input
                  type="text"
                  value={workspace}
                  onChange={e => setWorkspace(e.target.value)}
                  className="g-input w-full px-4 py-2.5 text-sm font-medium text-text-primary"
                  placeholder="My Workspace"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-text-secondary">Your role</label>
                <input
                  type="text"
                  value={role}
                  onChange={e => setRole(e.target.value)}
                  className="g-input w-full px-4 py-2.5 text-sm font-medium text-text-primary"
                  placeholder="Founder"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-text-secondary">
                  <Globe className="mr-1 inline h-3.5 w-3.5" /> Timezone
                </label>
                <select
                  value={timezone}
                  onChange={e => setTimezone(e.target.value)}
                  className="g-input w-full px-4 py-2.5 text-sm font-medium text-text-primary"
                >
                  {TIMEZONES.map(tz => (
                    <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Notifications card */}
          <div className="g-card rounded-2xl p-6">
            <h2 className="mb-6 flex items-center gap-2.5 text-lg font-bold text-text-primary">
              <Bell className="h-5 w-5 text-accent" /> Notifications
            </h2>
            <div className="space-y-4">
              {([
                { key: 'flowFailure' as const, label: 'Flow failures', desc: 'Get notified when an automation workflow fails.', icon: Zap },
                { key: 'weeklySummary' as const, label: 'Weekly summary', desc: 'Receive a digest of your inquiry activity each week.', icon: Clock },
                { key: 'securityAlerts' as const, label: 'Security alerts', desc: 'Important security notifications for your account.', icon: Shield },
              ]).map(item => (
                <label key={item.key} className="flex cursor-pointer items-start gap-4 rounded-xl p-3 transition hover:bg-surface-hover/40">
                  <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-hover">
                    <item.icon className="h-4 w-4 text-text-tertiary " />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-text-primary">{item.label}</p>
                    <p className="mt-0.5 text-xs text-text-tertiary ">{item.desc}</p>
                  </div>
                  <div className="mt-1">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={notifications[item.key]}
                      onClick={() => setNotifications(prev => ({ ...prev, [item.key]: !prev[item.key] }))}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                        notifications[item.key] ? 'bg-accent border-transparent' : 'bg-surface-hover border-border-strong'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-surface border border-border-strong shadow ring-0 transition duration-200 ease-in-out ${
                          notifications[item.key] ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Save button */}
          <div className="flex items-center gap-4">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="btn-primary inline-flex items-center gap-2.5 rounded-xl px-6 py-3 text-sm font-bold text-[#fff] transition disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {isSaving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>

        {/* Right column — subscription & danger zone */}
        <div className="space-y-6">
          {/* Subscription card */}
          <div className="g-card rounded-2xl p-6">
            <h2 className="mb-5 flex items-center gap-2.5 text-lg font-bold text-text-primary">
              <Sparkles className="h-5 w-5 text-accent" /> Subscription
            </h2>
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${tierInfo.bg} ${tierInfo.color}`}>
                  {tierInfo.label} plan
                </span>
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                  profile?.subscription?.status === 'active'
                    ? 'bg-emerald-500/10 text-emerald-700 '
                    : 'bg-amber-500/10 text-amber-700 '
                }`}>
                  {profile?.subscription?.status || 'active'}
                </span>
              </div>

              {/* Usage bar */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-text-tertiary ">Executions this month</span>
                  <span className="text-xs font-bold text-text-primary">{executionsUsed.toLocaleString()} / {executionsLimit.toLocaleString()}</span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-hover">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      usagePercent > 85 ? 'bg-rose-500' : usagePercent > 60 ? 'bg-amber-500' : 'bg-accent'
                    }`}
                    style={{ width: `${usagePercent}%` }}
                  />
                </div>
                <p className="mt-1.5 text-xs text-text-secondary">{usagePercent}% of monthly limit used</p>
              </div>

              {profile?.subscription?.nextInvoiceDate && (
                <p className="text-xs text-text-secondary">
                  Next invoice: <span className="font-semibold text-text-tertiary ">{profile.subscription.nextInvoiceDate}</span>
                </p>
              )}
            </div>
          </div>

          {/* Quick info card */}
          <div className="g-card rounded-2xl p-6">
            <h3 className="mb-4 text-sm font-bold text-text-primary">Account details</h3>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-text-tertiary ">User ID</dt>
                <dd className="font-mono text-xs text-text-tertiary ">{user?.uid?.slice(0, 12)}…</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-tertiary ">API keys</dt>
                <dd className="font-semibold text-text-primary">{profile?.apiKeys?.length || 0}</dd>
              </div>
            </dl>
          </div>

          {/* Sign out / danger zone */}
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6">
            <h3 className="mb-3 text-sm font-bold text-red-700 dark:text-red-400">Danger zone</h3>
            <button
              onClick={logout}
              className="inline-flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm font-bold text-red-600 dark:text-red-400 transition hover:brightness-110"
            >
              <LogOut className="h-4 w-4" />
              Sign out of NodalX
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
