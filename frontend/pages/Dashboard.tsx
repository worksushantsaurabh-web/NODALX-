import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  Bot,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Clock3,
  Copy,
  ExternalLink,
  Eye,
  Filter,
  Flame,
  Inbox,
  Key,
  LogOut,
  Mail,
  Menu,
  MoreHorizontal,
  RefreshCw,
  Search,
  Settings2,
  Sheet,
  Sparkles,
  User as UserIcon,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useUserTier } from '../hooks/useUserTier';
import AccessKeyRedemption from '../components/AccessKeyRedemption';
import ThemeToggle from '../components/ThemeToggle';
import { NodalXLogo } from '../components/Navbar';
import IntegrationSetup from '../components/IntegrationSetup';
import CustomerOnboarding from '../components/CustomerOnboarding';
import UserProfilePage from '../components/UserProfile';
import DataConnectors from '../components/DataConnectors';
import GoogleSheetsModal from '../components/GoogleSheetsModal';
import NotificationSettings from '../components/NotificationSettings';
import { api } from '../src/services/api';
import { flowsService, Flow } from '../src/services/flows';
import { Badge, StatCard } from '../ui';
import OnboardingWizard from '../components/OnboardingWizard';

const APPSCRIPT_URL = import.meta.env.VITE_APPSCRIPT_WEBHOOK_URL || '';

interface Inquiry {
  id: string;
  name: string;
  email: string;
  company?: string;
  message?: string;
  status: string;
  intent?: string;
  urgency?: string;
  fit_score?: string;
  category?: string;
  summary?: string;
  suggested_action?: string;
  last_active: string;
}

type DashboardTab = 'overview' | 'inquiries' | 'automations' | 'integration' | 'onboarding' | 'connectors' | 'profile';

const tabLabels: Array<{ id: DashboardTab; label: string; icon: React.ElementType }> = [
  { id: 'overview', label: 'Command center', icon: Activity },
  { id: 'inquiries', label: 'Inquiry queue', icon: Inbox },
  { id: 'automations', label: 'Automations', icon: Zap },
  { id: 'connectors', label: 'Data Connectors', icon: Settings2 },
  { id: 'onboarding', label: 'Your API key', icon: Key },
  { id: 'integration', label: 'Connect pipeline', icon: Sparkles },
  { id: 'profile', label: 'Your profile', icon: UserIcon },
];

function getStatusVariant(status: string): 'success' | 'warning' | 'neutral' {
  const normalized = status.toLowerCase();
  if (['qualified', 'active', 'completed', 'routed'].some(v => normalized.includes(v))) return 'success';
  if (['pending', 'new', 'review'].some(v => normalized.includes(v))) return 'warning';
  return 'neutral';
}

function intentColor(intent?: string) {
  if (!intent) return 'text-slate-600 dark:text-slate-400';
  const lower = intent.toLowerCase();
  if (lower === 'high' || lower === 'purchase' || lower === 'partnership') return 'text-orange-600 dark:text-orange-400';
  if (lower === 'medium') return 'text-amber-600 dark:text-amber-400';
  return 'text-slate-600 dark:text-slate-400';
}

function getInitials(name: string) {
  if (!name) return 'U';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function timeAgo(dateStr: string) {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  } catch {
    return dateStr;
  }
}

export default function Dashboard({ defaultTab = 'overview' }: { defaultTab?: string }) {
  const { user, logout } = useAuth();
  const { tier, loading: tierLoading, refetch: refetchTier } = useUserTier();
  const isPremium = tier === 'full';
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<DashboardTab>((defaultTab as DashboardTab) || 'overview');
  const [showWizard, setShowWizard] = useState(() => localStorage.getItem('nodalx_wizard') === '1');
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [flows, setFlows] = useState<Flow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [inquiryError, setInquiryError] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Selected inquiry for detail modal
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null);
  const [copiedEmail, setCopiedEmail] = useState(false);

  // Google Sheets modal state
  const [isSheetsModalOpen, setIsSheetsModalOpen] = useState(false);
  const [googleSheetsConnected, setGoogleSheetsConnected] = useState(false);
  const [connectedSheetTitle, setConnectedSheetTitle] = useState('');

  const loadWorkspace = useCallback(async (refresh = false) => {
    if (refresh) setIsRefreshing(true);
    setIsLoading(true);

    // ── Fetch inquiries from Apps Script (if configured) ──
    let appsScriptInquiries: Inquiry[] = [];
    let appsScriptSuccess = false;

    if (APPSCRIPT_URL) {
      try {
        const res = await fetch(`${APPSCRIPT_URL}?action=list`);
        const data = await res.json();
        if (data.success && Array.isArray(data.customers)) {
          appsScriptInquiries = data.customers.map((c: any) => ({
            id: c.id || String(Math.random()),
            name: c.name || 'Unknown',
            email: c.email || '',
            company: c.company || '',
            message: c.message || '',
            status: c.status || 'New',
            intent: c.intent || '',
            urgency: c.urgency || '',
            fit_score: String(c.fit_score || '0'),
            category: c.category || '',
            summary: c.summary || '',
            suggested_action: c.suggested_action || '',
            last_active: c.last_active || new Date().toISOString(),
          }));
          appsScriptSuccess = true;
          setInquiryError(null);
        }
      } catch (err) {
        console.warn('Apps Script fetch failed:', err);
      }
    }

    // ── Fallback: fetch from backend ──
    const [backendInquiryResult, flowResult, dataSourcesResult] = await Promise.allSettled([
      api.get<Inquiry[]>('/api/customers'),
      flowsService.getAll(),
      api.get<any[]>('/api/connectors'),
    ]);

    let mergedInquiries = appsScriptInquiries;

    if (!appsScriptSuccess && backendInquiryResult.status === 'fulfilled') {
      mergedInquiries = Array.isArray(backendInquiryResult.value) ? backendInquiryResult.value : [];
      setInquiryError(null);
    } else if (!appsScriptSuccess && backendInquiryResult.status === 'rejected') {
      setInquiryError('Connect your inquiry source to start receiving live business inquiries.');
    }

    // Merge: Apps Script inquiries take priority, backend fills gaps
    if (appsScriptSuccess && backendInquiryResult.status === 'fulfilled') {
      const backendInquiries = Array.isArray(backendInquiryResult.value) ? backendInquiryResult.value : [];
      const existingIds = new Set(appsScriptInquiries.map(i => i.id));
      const newBackendInquiries = backendInquiries.filter(i => !existingIds.has(i.id));
      mergedInquiries = [...appsScriptInquiries, ...newBackendInquiries];
    }

    setInquiries(mergedInquiries);
    if (flowResult.status === 'fulfilled') setFlows(flowResult.value);
    else setFlows([]);

    // Check Google Sheets connection status
    if (dataSourcesResult.status === 'fulfilled' && Array.isArray(dataSourcesResult.value)) {
      const sheetsSource = dataSourcesResult.value.find((s: any) => s.id === 'google-sheets');
      if (sheetsSource?.connected && sheetsSource?.config?.spreadsheetId) {
        setGoogleSheetsConnected(true);
        setConnectedSheetTitle(sheetsSource.name || 'Google Sheet');
      }
    }

    setIsLoading(false);
    setIsRefreshing(false);
  }, []);

  const handleSheetsConnected = (sheetTitle: string, spreadsheetId: string) => {
    setGoogleSheetsConnected(true);
    setConnectedSheetTitle(sheetTitle);
  };

  useEffect(() => {
    setActiveTab((defaultTab as DashboardTab) || 'overview');
  }, [defaultTab]);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  const openTab = (tab: DashboardTab) => {
    setMobileOpen(false);
    setActiveTab(tab);
    navigate('/dashboard');
  };

  const copyEmailToClipboard = (email: string) => {
    navigator.clipboard.writeText(email);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  const updateInquiryStatus = async (inquiryId: string, newStatus: string) => {
    try {
      await api.patch(`/api/inquiries/${inquiryId}/status`, { status: newStatus });
      setInquiries(prev => prev.map(i => i.id === inquiryId ? { ...i, status: newStatus } : i));
      if (selectedInquiry && selectedInquiry.id === inquiryId) {
        setSelectedInquiry({ ...selectedInquiry, status: newStatus });
      }
    } catch (err) {
      console.error('Failed to update inquiry status', err);
    }
  };

  const pendingInquiries = useMemo(
    () => inquiries.filter(inquiry => !['qualified', 'routed', 'completed', 'active'].some(value => inquiry.status.toLowerCase().includes(value))),
    [inquiries],
  );

  const qualifiedInquiries = useMemo(
    () => inquiries.filter(inquiry => ['qualified', 'routed', 'completed', 'active'].some(value => inquiry.status.toLowerCase().includes(value))),
    [inquiries],
  );

  const hotInquiries = useMemo(
    () => inquiries.filter(inquiry => {
      const intent = (inquiry.intent || inquiry.urgency || '').toLowerCase();
      return intent === 'high' || intent === 'purchase';
    }),
    [inquiries],
  );

  const filteredInquiries = useMemo(() => {
    if (!searchQuery.trim()) return inquiries;
    const q = searchQuery.toLowerCase();
    return inquiries.filter(i =>
      i.name.toLowerCase().includes(q) ||
      i.email.toLowerCase().includes(q) ||
      (i.company || '').toLowerCase().includes(q)
    );
  }, [inquiries, searchQuery]);

  const renderOverview = () => (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-600 dark:text-teal-400">Command Center</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 dark:text-white">Manage Your Pipeline</h1>
          <p className="mt-3 max-w-2xl text-slate-500 dark:text-slate-400">Track incoming leads, monitor AI qualification status, and close deals faster.</p>
        </div>
        <button onClick={() => loadWorkspace(true)} disabled={isRefreshing} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-teal-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} /> Refresh live data
        </button>
      </div>

      {/* Connection Warning */}
      {inquiryError && (
        <div className="flex flex-col gap-4 rounded-2xl border border-amber-300/60 bg-amber-50 p-5 dark:border-amber-400/20 dark:bg-amber-400/10 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3"><Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" /><div><p className="font-semibold text-amber-900 dark:text-amber-200">Your inquiry pipeline is waiting for a connection.</p><p className="mt-1 text-sm text-amber-800/80 dark:text-amber-200/70">NodalX will show real records here after the Make.com webhook is configured.</p></div></div>
          <button onClick={() => openTab('integration')} className="inline-flex shrink-0 items-center gap-2 text-sm font-bold text-amber-900 dark:text-amber-200">Connect source <ArrowRight className="h-4 w-4" /></button>
        </div>
      )}

      {/* Tier banner - Glassmorphism */}
      {tierLoading ? (
        <div className="glass-card flex items-center gap-3 rounded-2xl px-6 py-4 animate-pulse">
          <div className="skeleton skeleton-circle w-8 h-8" />
          <div className="skeleton skeleton-text w-40" />
        </div>
      ) : !isPremium ? (
        <div className="space-y-4">
          <div className="relative glass-card rounded-2xl p-6 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-teal-500/10 via-transparent to-cyan-500/10" />
            <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500/20 to-cyan-500/20 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="h-6 w-6 text-teal-600 dark:text-teal-400" />
                </div>
                <div>
                  <p className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Upgrade to Full Access</p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">Unlock bulk analysis, advanced AI scoring, and priority support.</p>
                </div>
              </div>
              <button onClick={() => openTab('onboarding')} className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-700 hover:to-teal-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-teal-600/20 hover:shadow-teal-600/30 transition-all duration-200 hover:-translate-y-0.5 group">
                Upgrade
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
              </button>
            </div>
          </div>
          <AccessKeyRedemption onRedemptionSuccess={refetchTier} />
        </div>
      ) : (
        <div className="glass-card flex items-center gap-3 rounded-2xl px-6 py-4">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">Full Access — all premium features are enabled.</span>
        </div>
      )}

      {/* Analytics Cards */}
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { title: "Today's Leads", value: inquiries.length,          trend: inquiries.length > 0 ? `+${inquiries.length}` : '0',           isPositive: true,                           icon: Users,       color: 'text-blue-600 dark:text-blue-400',    iconBg: 'bg-blue-500/10 dark:bg-blue-400/10' },
          { title: 'Hot Leads',     value: hotInquiries.length,       trend: hotInquiries.length > 0 ? `+${hotInquiries.length}` : '0',     isPositive: true,                           icon: Flame,       color: 'text-orange-600 dark:text-orange-400', iconBg: 'bg-orange-500/10 dark:bg-orange-400/10' },
          { title: 'Pending',       value: pendingInquiries.length,   trend: pendingInquiries.length > 0 ? `${pendingInquiries.length}` : '0', isPositive: pendingInquiries.length === 0, icon: Clock,       color: 'text-amber-600 dark:text-amber-400',  iconBg: 'bg-amber-500/10 dark:bg-amber-400/10' },
          { title: 'Qualified',     value: qualifiedInquiries.length, trend: qualifiedInquiries.length > 0 ? `+${qualifiedInquiries.length}` : '0', isPositive: true,                   icon: CheckCircle2, color: 'text-emerald-600 dark:text-emerald-400', iconBg: 'bg-emerald-500/10 dark:bg-emerald-400/10' },
        ].map((stat, index) => (
          <StatCard
            key={stat.title}
            label={stat.title}
            value={stat.value}
            icon={<stat.icon className={`w-6 h-6 ${stat.color}`} />}
            iconBg={stat.iconBg}
            trend={{ value: stat.trend, direction: stat.isPositive ? 'up' : 'down' }}
            loading={isLoading}
            className="cursor-default animate-fade-in-up"
            style={{ animationDelay: `${index * 0.1}s` }}
          />
        ))}
      </div>

      {/* Recent Inquiries Table - Glassmorphism Design */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-200/60 dark:border-white/5 flex items-center justify-between bg-slate-50/30 dark:bg-white/[0.02]">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Recent Inquiries</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Live records from your connected pipeline</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2.5 px-4 py-2.5 glass-card-subtle rounded-xl text-sm">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search leads..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent outline-none text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 w-36 font-medium"
              />
            </div>
            <button onClick={() => setActiveTab('inquiries')} className="btn-glass flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 px-4 py-2.5 rounded-xl">
              <Filter className="w-4 h-4" />
              View all
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="p-6">
            {/* Skeleton Table Rows */}
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-slate-50/50 dark:bg-white/[0.02] animate-fade-in" style={{ animationDelay: `${i * 0.1}s` }}>
                  <div className="flex items-center gap-4">
                    <div className="skeleton skeleton-circle w-10 h-10" />
                    <div className="space-y-2">
                      <div className="skeleton skeleton-text w-32" />
                      <div className="skeleton skeleton-text-sm w-24" />
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="skeleton w-16 h-6 rounded-full" />
                    <div className="skeleton w-20 h-6 rounded-lg" />
                    <div className="skeleton skeleton-text-sm w-16" />
                    <div className="skeleton w-16 h-8 rounded-lg" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : filteredInquiries.length === 0 ? (
          <div className="p-12 text-center">
            <Sparkles className="mx-auto h-8 w-8 text-teal-500 mb-4" />
            <h3 className="font-bold text-slate-900 dark:text-white mb-2">No inquiries yet</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-5">When your form or webhook receives an inquiry, it will appear here with AI classification.</p>
            <button onClick={() => openTab('integration')} className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-700 transition">
              Connect pipeline <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 dark:bg-white/[0.02] text-[11px] uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200/60 dark:border-white/5">
                    <th className="px-6 py-4">Customer</th>
                    <th className="px-6 py-4">Intent</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Time</th>
                    <th className="px-6 py-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/80 dark:divide-white/5">
                  {filteredInquiries.slice(0, 8).map((inquiry, index) => (
                    <tr key={inquiry.id} className="group bg-transparent hover:bg-slate-50/70 dark:hover:bg-white/[0.03] transition-all duration-200 animate-fade-in-up" style={{ animationDelay: `${index * 0.05}s` }}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3.5">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center text-xs font-bold text-white flex-shrink-0 shadow-sm group-hover:shadow-md transition-shadow duration-200">
                            {getInitials(inquiry.name)}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 dark:text-white text-sm truncate tracking-tight">{inquiry.name}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate mt-0.5">{inquiry.company || inquiry.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {(inquiry.intent?.toLowerCase() === 'high' || inquiry.urgency?.toLowerCase() === 'high') && (
                            <div className="w-6 h-6 rounded-lg bg-orange-500/10 flex items-center justify-center">
                              <Flame className="w-3.5 h-3.5 text-orange-500 dark:text-orange-400" />
                            </div>
                          )}
                          <span className={`text-sm font-semibold capitalize ${intentColor(inquiry.intent || inquiry.urgency)}`}>
                            {inquiry.intent || inquiry.urgency || '—'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge variant={getStatusVariant(inquiry.status)} size="md">{inquiry.status}</Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-500 dark:text-slate-400 tabular-nums">
                        {timeAgo(inquiry.last_active)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button
                          onClick={() => setSelectedInquiry(inquiry)}
                          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-teal-700 dark:text-teal-300 bg-teal-50/80 dark:bg-teal-500/10 rounded-xl hover:bg-teal-100 dark:hover:bg-teal-500/20 transition-all duration-200 border border-teal-200/60 dark:border-teal-500/20 hover:border-teal-300 dark:hover:border-teal-500/40 hover-scale"
                          title="View Inquiry Details"
                        >
                          <Eye className="w-4 h-4" />
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {inquiries.length > 8 && (
              <div className="px-6 py-4 border-t border-slate-200/60 dark:border-white/5 bg-slate-50/30 dark:bg-white/[0.01] text-center">
                <button onClick={() => setActiveTab('inquiries')} className="text-sm font-bold text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 transition-colors duration-200 inline-flex items-center gap-1.5">
                  View all {inquiries.length} inquiries
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* AI Pipeline Status Cards - Glassmorphism */}
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="glass-card rounded-2xl p-6 hover-lift">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500/15 to-cyan-500/15 dark:from-teal-500/20 dark:to-cyan-500/20 flex items-center justify-center">
              <Bot className="h-6 w-6 text-teal-600 dark:text-teal-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">AI Pipeline Status</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">The operating loop</p>
            </div>
          </div>
          <div className="mt-7 space-y-4">
            {['Capture the inquiry from your form or webhook', 'Analyze intent, urgency, and fit with AI', 'Route the next action to your team or CRM'].map((step, index) => (
              <div key={step} className="flex gap-4 items-start group">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100/80 dark:bg-white/10 text-sm font-bold text-slate-700 dark:text-slate-300 group-hover:bg-teal-500/10 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors duration-200">{index + 1}</span>
                <p className="pt-1.5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{step}</p>
              </div>
            ))}
          </div>
          <button onClick={() => openTab('integration')} className="mt-8 inline-flex items-center gap-2 text-sm font-bold text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 transition-colors duration-200 group">
            Configure the loop
            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
          </button>
        </div>

        {/* Active Automation Card - Enhanced */}
        <div className="group relative overflow-hidden glass-card rounded-2xl p-6 hover-lift">
          {/* Accent gradient border */}
          <div className="absolute right-0 top-0 bottom-0 w-1 bg-gradient-to-b from-teal-400 via-emerald-500 to-teal-600" />
          <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 via-transparent to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          <div className="relative flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-teal-500/10 dark:bg-teal-500/15 flex items-center justify-center">
                  <Bot className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">AI Lead Scoring Pipeline</h3>
              </div>
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">Classifies and routes incoming sales inquiries using advanced AI models.</p>
            </div>
            <span className="flex items-center gap-2 rounded-full bg-emerald-100/80 dark:bg-emerald-500/15 px-3.5 py-2 text-xs font-bold text-emerald-700 dark:text-emerald-400 shadow-sm">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              Active
            </span>
          </div>
          <div className="relative mt-6 flex items-center justify-between border-t border-slate-200/60 dark:border-white/5 pt-5 text-sm">
            <span className="text-slate-500 dark:text-slate-400 font-medium">
              Last inquiry: <span className="text-slate-700 dark:text-slate-300">{inquiries.length > 0 ? timeAgo(inquiries[0].last_active) : 'Waiting...'}</span>
            </span>
            <span className="font-bold text-teal-600 dark:text-teal-400 tabular-nums">{inquiries.length} processed</span>
          </div>
        </div>
      </div>

      {/* Data Sources Quick Connect - Glassmorphism */}
      <div className="glass-card rounded-2xl p-7">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/15 to-teal-500/15 dark:from-emerald-500/20 dark:to-teal-500/20 flex items-center justify-center">
              <Settings2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Data Sources</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Connect your tools to sync leads automatically</p>
            </div>
          </div>
          <button onClick={() => openTab('connectors')} className="btn-glass text-sm font-bold text-teal-600 dark:text-teal-400 px-4 py-2 rounded-xl inline-flex items-center gap-1.5 hover:text-teal-700 dark:hover:text-teal-300">
            View all
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          {/* Google Sheets Card - Modernized */}
          <button
            onClick={() => setIsSheetsModalOpen(true)}
            className="group relative text-left glass-card rounded-2xl p-5 hover-lift overflow-hidden"
          >
            {/* Subtle gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-teal-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

            <div className="relative flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className={`h-12 w-12 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:scale-110 ${googleSheetsConnected ? 'bg-emerald-500/15 dark:bg-emerald-400/15' : 'bg-slate-100 dark:bg-white/10'}`}>
                  <Sheet className={`h-6 w-6 transition-colors duration-300 ${googleSheetsConnected ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400'}`} />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-base tracking-tight group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors duration-200">
                    Google Sheets
                  </h4>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                    {googleSheetsConnected ? connectedSheetTitle : 'Sync leads automatically'}
                  </p>
                </div>
              </div>
              {googleSheetsConnected ? (
                <div className="flex flex-col items-end gap-2">
                  <span className="px-3 py-1.5 bg-emerald-100/80 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-bold rounded-full flex items-center gap-1.5 shadow-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Synced
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">Click to manage</span>
                </div>
              ) : (
                <span className="px-3 py-1.5 bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-400 text-xs font-bold rounded-full group-hover:bg-emerald-100 group-hover:text-emerald-700 dark:group-hover:bg-emerald-500/20 dark:group-hover:text-emerald-400 transition-colors duration-200">
                  Connect
                </span>
              )}
            </div>

            {/* Connection indicator line */}
            {googleSheetsConnected && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-500" />
            )}
          </button>

          {/* Webhook Card - Modernized */}
          <button
            onClick={() => openTab('integration')}
            className="group relative text-left glass-card rounded-2xl p-5 hover-lift overflow-hidden"
          >
            {/* Subtle gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 via-transparent to-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

            <div className="relative flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-teal-500/10 dark:bg-teal-400/10 flex items-center justify-center transition-all duration-300 group-hover:scale-110">
                  <Zap className="h-6 w-6 text-teal-600 dark:text-teal-400" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-base tracking-tight group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors duration-200">
                    Webhooks & API
                  </h4>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                    Connect forms and tools
                  </p>
                </div>
              </div>
              <span className="px-3 py-1.5 bg-teal-100/80 dark:bg-teal-500/20 text-teal-700 dark:text-teal-400 text-xs font-bold rounded-full group-hover:bg-teal-200 dark:group-hover:bg-teal-500/30 transition-colors duration-200">
                Configure
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* Notifications & Alerts */}
      <NotificationSettings />
    </div>
  );

  const renderInquiries = () => <div className="space-y-6"><PageHeading title="Inquiry queue" description="Review the business inquiries coming through your connected source." action={<button onClick={() => loadWorkspace(true)} className="inline-flex items-center gap-2 rounded-xl bg-teal-600 hover:bg-teal-700 px-4 py-2.5 text-sm font-bold text-white transition-colors"><RefreshCw className="h-4 w-4" /> Refresh</button>} /><InquiryQueue inquiries={inquiries} isLoading={isLoading} onSelectInquiry={(inquiry) => setSelectedInquiry(inquiry)} /></div>;

  const renderAutomations = () => (
    <div className="space-y-6">
      <PageHeading
        title="Automations"
        description="Keep the AI workflows that turn inquiries into action visible and accountable."
        action={<button onClick={() => openTab('onboarding')} className="inline-flex items-center gap-2 rounded-xl bg-teal-600 hover:bg-teal-700 px-4 py-2.5 text-sm font-bold text-white transition-colors">Get your API key <ArrowRight className="h-4 w-4" /></button>}
      />
      {!isPremium && (
        <div className="flex flex-col gap-4 rounded-2xl border border-teal-300/60 bg-teal-50 p-5 dark:border-teal-500/20 dark:bg-teal-500/10 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-teal-600 dark:text-teal-400" />
            <div>
              <p className="font-semibold text-teal-900 dark:text-teal-200">Premium feature — Upgrade to Full Access</p>
              <p className="mt-1 text-sm text-teal-800/80 dark:text-teal-200/70">Advanced automations are available on the full plan.</p>
            </div>
          </div>
          <button onClick={() => openTab('onboarding')} className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-bold text-white hover:bg-teal-700 transition">
            Upgrade <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="relative overflow-hidden rounded-2xl border border-teal-500/30 bg-white p-5 shadow-sm dark:border-teal-500/20 dark:bg-white/5">
          <div className="absolute right-0 top-0 h-full w-1 bg-teal-500"></div>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                <h3 className="font-bold text-slate-950 dark:text-white">AI Lead Scoring Pipeline</h3>
              </div>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Classifies and routes incoming sales inquiries using advanced AI models.</p>
            </div>
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500"></span>
              Active
            </span>
          </div>
          <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-xs text-slate-500 dark:border-white/5 dark:text-slate-400">
            <span>Last inquiry: {inquiries.length > 0 ? new Date(inquiries[0].last_active).toLocaleDateString() : 'Waiting for connection...'}</span>
            <span className="font-medium text-teal-600 dark:text-teal-400">{inquiries.length} inquiries processed</span>
          </div>
        </div>
      </div>
    </div>
  );

  const content = activeTab === 'inquiries' ? renderInquiries() : activeTab === 'automations' ? renderAutomations() : activeTab === 'onboarding' ? <CustomerOnboarding /> : activeTab === 'connectors' ? <DataConnectors /> : activeTab === 'integration' ? <IntegrationSetup /> : activeTab === 'profile' ? <UserProfilePage /> : renderOverview();

  if (showWizard) {
    return (
      <OnboardingWizard
        userName={user?.displayName || 'there'}
        onComplete={() => setShowWizard(false)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 text-slate-900 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 dark:text-white overflow-x-hidden w-full">
      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-950/60 backdrop-blur-sm md:hidden animate-fade-in"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside className={`fixed inset-y-0 left-0 z-40 w-72 border-r border-slate-200/80 bg-white/80 backdrop-blur-xl p-6 transition-transform duration-300 dark:border-white/5 dark:bg-slate-950/90 ${mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <NodalXLogo className="h-10 w-10" />
            <span className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">NODALxAI</span>
          </div>
          <button onClick={() => setMobileOpen(false)} className="md:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-10 px-3 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Workspace</p>
        <nav className="mt-4 space-y-1.5">
          {tabLabels.map(tab => (
            <button
              key={tab.id}
              onClick={() => openTab(tab.id)}
              className={`group flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold transition-all duration-200 ${
                activeTab === tab.id
                  ? 'bg-teal-500/10 text-teal-700 dark:text-teal-300 shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100/80 dark:text-slate-400 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <tab.icon className={`h-[18px] w-[18px] transition-transform duration-200 ${activeTab === tab.id ? '' : 'group-hover:scale-110'}`} />
              {tab.label}
              {activeTab === tab.id && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-teal-500" />
              )}
            </button>
          ))}
        </nav>
        <div className="absolute bottom-6 left-6 right-6 border-t border-slate-200/80 dark:border-white/5 pt-5 hidden md:block">
          <button onClick={() => openTab('profile')} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-all duration-200 hover:bg-slate-100/80 dark:hover:bg-white/5 group">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 text-sm font-bold text-white shadow-sm group-hover:shadow-md transition-shadow duration-200">
              {user?.photoURL ? <img src={user.photoURL} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" /> : (user?.displayName || 'U').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-slate-800 dark:text-slate-200 tracking-tight">{user?.displayName || 'User'}</p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400 font-medium">{user?.email}</p>
            </div>
          </button>
        </div>
      </aside>

      <div className="md:pl-72">
        <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between border-b border-slate-200/60 bg-white/70 backdrop-blur-xl px-6 md:px-8 dark:border-white/5 dark:bg-slate-950/80">
          <button onClick={() => setMobileOpen(true)} className="md:hidden p-2 -ml-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition-colors">
            <Menu className="h-5 w-5" />
          </button>
          <div className="hidden md:block">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
              {user?.displayName ? `Welcome back, ${user.displayName.split(' ')[0]}` : 'Welcome to your workspace'}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-5">
            <ThemeToggle />
            <div className="hidden sm:flex items-center gap-3 px-4 py-2 rounded-xl bg-slate-100/60 dark:bg-white/5">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400">{user?.email}</span>
            </div>
            <button onClick={logout} className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors md:hidden">
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-6 py-8 md:px-8 md:py-10">{content}</main>
      </div>

      {/* Inquiry Detail Modal */}
      {selectedInquiry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between bg-slate-50/50 dark:bg-slate-950/50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center text-sm font-bold text-white shadow-md">
                  {getInitials(selectedInquiry.name)}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    {selectedInquiry.name}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                    {selectedInquiry.company ? `${selectedInquiry.company} • ` : ''}{selectedInquiry.email}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedInquiry(null)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Classification Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5">
                  <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Intent</span>
                  <span className={`text-sm font-bold capitalize flex items-center gap-1 ${intentColor(selectedInquiry.intent || selectedInquiry.urgency)}`}>
                    {(selectedInquiry.intent?.toLowerCase() === 'high' || selectedInquiry.urgency?.toLowerCase() === 'high') && <Flame className="w-3.5 h-3.5 text-orange-500" />}
                    {selectedInquiry.intent || 'General'}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5">
                  <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Urgency</span>
                  <span className="text-sm font-bold text-slate-900 dark:text-white capitalize">
                    {selectedInquiry.urgency || 'Normal'}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5">
                  <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Fit Score</span>
                  <span className="text-sm font-bold text-teal-600 dark:text-teal-400">
                    {selectedInquiry.fit_score ? `${selectedInquiry.fit_score}/10` : 'N/A'}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5">
                  <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Status</span>
                  <Badge variant={getStatusVariant(selectedInquiry.status)}>{selectedInquiry.status}</Badge>
                </div>
              </div>

              {/* Message */}
              {selectedInquiry.message && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Original Inquiry</h4>
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                    "{selectedInquiry.message}"
                  </div>
                </div>
              )}

              {/* AI Summary */}
              {selectedInquiry.summary && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400 mb-2 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    AI Summary
                  </h4>
                  <div className="p-4 rounded-xl bg-teal-50/50 dark:bg-teal-950/20 border border-teal-100 dark:border-teal-900/30 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                    {selectedInquiry.summary}
                  </div>
                </div>
              )}

              {/* Suggested Action */}
              {selectedInquiry.suggested_action && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-2 flex items-center gap-1.5">
                    <Bot className="w-3.5 h-3.5" />
                    Recommended Action
                  </h4>
                  <div className="p-4 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                    {selectedInquiry.suggested_action}
                  </div>
                </div>
              )}
            </div>

              {/* Quick Status Triage */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Triage Status</h4>
                <div className="flex flex-wrap gap-2">
                  {['Qualified', 'Contacted', 'Pending', 'Spam'].map((st) => (
                    <button
                      key={st}
                      onClick={() => updateInquiryStatus(selectedInquiry.id, st)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition border ${
                        selectedInquiry.status === st
                          ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                          : 'bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10'
                      }`}
                    >
                      {st === selectedInquiry.status ? `✓ ${st}` : st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Footer Action Buttons */}
              <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex items-center justify-between gap-3">
                <button
                  onClick={() => copyEmailToClipboard(selectedInquiry.email)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-white/10 rounded-lg transition border border-slate-200 dark:border-white/10"
                >
                  {copiedEmail ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  {copiedEmail ? 'Copied!' : 'Copy Email'}
                </button>

                <div className="flex items-center gap-2">
                  <a
                    href={`mailto:${selectedInquiry.email}?subject=Re: Inquiry from ${encodeURIComponent(selectedInquiry.name)}`}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-sm transition"
                  >
                    <Mail className="w-4 h-4" />
                    Reply via Email
                    <ExternalLink className="w-3 h-3 ml-0.5" />
                  </a>
                </div>
              </div>
          </div>
        </div>
      )}

      {/* Google Sheets Connection Modal */}
      <GoogleSheetsModal
        isOpen={isSheetsModalOpen}
        onClose={() => setIsSheetsModalOpen(false)}
        onSuccess={handleSheetsConnected}
      />
    </div>
  );
}

function PageHeading({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-600 dark:text-teal-400">NodalX operations</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 dark:text-white">{title}</h1><p className="mt-2 text-slate-500 dark:text-slate-400">{description}</p></div>{action}</div>;
}

function InquiryQueue({ inquiries, isLoading, onViewAll, onSelectInquiry }: { inquiries: Inquiry[]; isLoading: boolean; onViewAll?: () => void; onSelectInquiry?: (inquiry: Inquiry) => void }) {
  return (
    <section className="glass-card rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-white/5 p-6 bg-slate-50/30 dark:bg-white/[0.02]">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Recent inquiries</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Live records from your connected workflow</p>
        </div>
        {onViewAll && (
          <button onClick={onViewAll} className="btn-glass inline-flex items-center gap-1.5 text-sm font-bold text-teal-600 dark:text-teal-400 px-4 py-2 rounded-xl hover:text-teal-700 dark:hover:text-teal-300 transition-colors">
            View queue <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>
      {isLoading ? (
        <div className="p-6 space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-slate-50/50 dark:bg-white/[0.02]" style={{ animationDelay: `${i * 0.1}s` }}>
              <div className="flex items-center gap-4">
                <div className="skeleton skeleton-circle w-10 h-10" />
                <div className="space-y-2">
                  <div className="skeleton skeleton-text w-32" />
                  <div className="skeleton skeleton-text-sm w-24" />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="skeleton w-20 h-7 rounded-full" />
                <div className="skeleton w-16 h-8 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      ) : inquiries.length === 0 ? (
        <EmptyState title="No inquiries yet" description="When your form or webhook receives an inquiry, it will appear here for triage." />
      ) : (
        <div className="divide-y divide-slate-100/80 dark:divide-white/5">
          {inquiries.map((inquiry, index) => (
            <div key={inquiry.id} className="group flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between hover:bg-slate-50/70 dark:hover:bg-white/[0.03] transition-all duration-200 animate-fade-in" style={{ animationDelay: `${index * 0.05}s` }}>
              <div className="min-w-0 flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center text-sm font-bold text-white flex-shrink-0 shadow-sm group-hover:shadow-md transition-shadow duration-200">
                  {getInitials(inquiry.name)}
                </div>
                <div>
                  <p className="truncate font-bold text-slate-900 dark:text-white tracking-tight">{inquiry.name}</p>
                  <p className="truncate text-sm text-slate-500 dark:text-slate-400 mt-0.5 font-medium">{inquiry.company || inquiry.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Badge variant={getStatusVariant(inquiry.status)} size="md">{inquiry.status}</Badge>
                <span className="hidden text-sm text-slate-500 dark:text-slate-400 font-medium tabular-nums sm:block">{timeAgo(inquiry.last_active)}</span>
                {onSelectInquiry && (
                  <button
                    onClick={() => onSelectInquiry(inquiry)}
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-teal-700 dark:text-teal-300 bg-teal-50/80 dark:bg-teal-500/10 rounded-xl hover:bg-teal-100 dark:hover:bg-teal-500/20 transition-all duration-200 border border-teal-200/60 dark:border-teal-500/20 hover-scale"
                  >
                    <Eye className="w-4 h-4" />
                    View
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function EmptyState({ title, description, action, actionLabel }: { title: string; description: string; action?: () => void; actionLabel?: string }) {
  return (
    <div className="relative rounded-2xl border border-dashed border-slate-300/80 dark:border-white/10 p-12 text-center overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 via-transparent to-cyan-500/5" />
      <div className="relative">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-teal-500/10 dark:bg-teal-500/15 flex items-center justify-center mb-5">
          <Sparkles className="h-8 w-8 text-teal-500" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">{title}</h3>
        <p className="mx-auto mt-3 max-w-md text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{description}</p>
        {action && actionLabel && (
          <button onClick={action} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-700 hover:to-teal-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-teal-600/20 hover:shadow-teal-600/30 transition-all duration-200 hover:-translate-y-0.5">
            {actionLabel}
            <ArrowRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
