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
  free: { label: 'Free', color: 'text-slate-600 dark:text-slate-300', bg: 'bg-slate-100 dark:bg-white/10' },
  pro: { label: 'Pro', color: 'text-teal-700 dark:text-teal-300', bg: 'bg-teal-500/10' },
  enterprise: { label: 'Enterprise', color: 'text-indigo-700 dark:text-indigo-300', bg: 'bg-indigo-500/10' },
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
        <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
        <span className="ml-3 text-sm text-slate-500">Loading profile…</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in pb-16">
      {/* Page header */}
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-600 dark:text-teal-400">Account</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 dark:text-white">Your profile</h1>
        <p className="mt-2 text-slate-500 dark:text-slate-400">Manage your account settings, preferences, and subscription.</p>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-300/60 bg-rose-50 p-4 dark:border-rose-400/20 dark:bg-rose-400/10">
          <p className="text-sm font-semibold text-rose-800 dark:text-rose-200">{error}</p>
        </div>
      )}

      {saveSuccess && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-300/60 bg-emerald-50 p-4 dark:border-emerald-400/20 dark:bg-emerald-400/10">
          <Check className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">Profile saved successfully.</p>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        {/* Left column – editable details */}
        <div className="space-y-6">

          {/* Identity card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-white/5">
            <h2 className="mb-6 flex items-center gap-2.5 text-lg font-bold text-slate-950 dark:text-white">
              <UserIcon className="h-5 w-5 text-teal-600 dark:text-teal-400" /> Personal info
            </h2>

            <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
              {/* Avatar */}
              <div className="group relative flex-shrink-0">
                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-500 text-2xl font-bold text-white shadow-lg shadow-teal-500/20">
                  {user?.photoURL ? (
                    <img src={user.photoURL} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    (displayName || 'U').charAt(0).toUpperCase()
                  )}
                </div>
                <div className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-slate-900 text-white dark:border-slate-950">
                  <Camera className="h-3 w-3" />
                </div>
              </div>

              <div className="flex-1 space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">Display name</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-white/10 dark:bg-white/5 dark:text-white"
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">Email</label>
                  <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-2.5 dark:border-white/10 dark:bg-white/[0.03]">
                    <Mail className="h-4 w-4 text-slate-400" />
                    <span className="text-sm text-slate-500 dark:text-slate-400">{user?.email || profile?.email || '—'}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">Email is managed by your sign-in provider.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Workspace card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-white/5">
            <h2 className="mb-6 flex items-center gap-2.5 text-lg font-bold text-slate-950 dark:text-white">
              <Building2 className="h-5 w-5 text-teal-600 dark:text-teal-400" /> Workspace
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">Workspace name</label>
                <input
                  type="text"
                  value={workspace}
                  onChange={e => setWorkspace(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-white/10 dark:bg-white/5 dark:text-white"
                  placeholder="My Workspace"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">Your role</label>
                <input
                  type="text"
                  value={role}
                  onChange={e => setRole(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-white/10 dark:bg-white/5 dark:text-white"
                  placeholder="Founder"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">
                  <Globe className="mr-1 inline h-3.5 w-3.5" /> Timezone
                </label>
                <select
                  value={timezone}
                  onChange={e => setTimezone(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-white/10 dark:bg-white/5 dark:text-white"
                >
                  {TIMEZONES.map(tz => (
                    <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Notifications card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-white/5">
            <h2 className="mb-6 flex items-center gap-2.5 text-lg font-bold text-slate-950 dark:text-white">
              <Bell className="h-5 w-5 text-teal-600 dark:text-teal-400" /> Notifications
            </h2>
            <div className="space-y-4">
              {([
                { key: 'flowFailure' as const, label: 'Flow failures', desc: 'Get notified when an automation workflow fails.', icon: Zap },
                { key: 'weeklySummary' as const, label: 'Weekly summary', desc: 'Receive a digest of your inquiry activity each week.', icon: Clock },
                { key: 'securityAlerts' as const, label: 'Security alerts', desc: 'Important security notifications for your account.', icon: Shield },
              ]).map(item => (
                <label key={item.key} className="flex cursor-pointer items-start gap-4 rounded-xl p-3 transition hover:bg-slate-50 dark:hover:bg-white/5">
                  <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-white/10">
                    <item.icon className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{item.label}</p>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{item.desc}</p>
                  </div>
                  <div className="mt-1">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={notifications[item.key]}
                      onClick={() => setNotifications(prev => ({ ...prev, [item.key]: !prev[item.key] }))}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
                        notifications[item.key] ? 'bg-teal-600' : 'bg-slate-300 dark:bg-white/20'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
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
              className="inline-flex items-center gap-2.5 rounded-xl bg-teal-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-teal-600/20 transition hover:bg-teal-700 disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {isSaving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>

        {/* Right column — subscription & danger zone */}
        <div className="space-y-6">
          {/* Subscription card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-white/5">
            <h2 className="mb-5 flex items-center gap-2.5 text-lg font-bold text-slate-950 dark:text-white">
              <Sparkles className="h-5 w-5 text-teal-600 dark:text-teal-400" /> Subscription
            </h2>
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${tierInfo.bg} ${tierInfo.color}`}>
                  {tierInfo.label} plan
                </span>
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                  profile?.subscription?.status === 'active'
                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                    : 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
                }`}>
                  {profile?.subscription?.status || 'active'}
                </span>
              </div>

              {/* Usage bar */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Executions this month</span>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{executionsUsed.toLocaleString()} / {executionsLimit.toLocaleString()}</span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      usagePercent > 85 ? 'bg-rose-500' : usagePercent > 60 ? 'bg-amber-500' : 'bg-teal-500'
                    }`}
                    style={{ width: `${usagePercent}%` }}
                  />
                </div>
                <p className="mt-1.5 text-xs text-slate-400">{usagePercent}% of monthly limit used</p>
              </div>

              {profile?.subscription?.nextInvoiceDate && (
                <p className="text-xs text-slate-400">
                  Next invoice: <span className="font-semibold text-slate-600 dark:text-slate-300">{profile.subscription.nextInvoiceDate}</span>
                </p>
              )}
            </div>
          </div>

          {/* Quick info card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-white/5">
            <h3 className="mb-4 text-sm font-bold text-slate-950 dark:text-white">Account details</h3>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500 dark:text-slate-400">User ID</dt>
                <dd className="font-mono text-xs text-slate-600 dark:text-slate-300">{user?.uid?.slice(0, 12)}…</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500 dark:text-slate-400">API keys</dt>
                <dd className="font-semibold text-slate-700 dark:text-slate-200">{profile?.apiKeys?.length || 0}</dd>
              </div>
            </dl>
          </div>

          {/* Sign out / danger zone */}
          <div className="rounded-2xl border border-rose-200/60 bg-rose-50/50 p-6 dark:border-rose-400/10 dark:bg-rose-400/5">
            <h3 className="mb-3 text-sm font-bold text-rose-900 dark:text-rose-300">Danger zone</h3>
            <button
              onClick={logout}
              className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-bold text-rose-700 transition hover:bg-rose-50 dark:border-rose-500/30 dark:bg-transparent dark:text-rose-400 dark:hover:bg-rose-400/10"
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
