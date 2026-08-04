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
import { api } from '../src/services/api';
import { flowsService, Flow } from '../src/services/flows';

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

function statusBadge(status: string) {
  const normalized = status.toLowerCase();
  if (['qualified', 'active', 'completed', 'routed'].some(v => normalized.includes(v))) {
    return 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-500/20';
  }
  if (['pending', 'new', 'review'].some(v => normalized.includes(v))) {
    return 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200/60 dark:border-amber-500/20';
  }
  return 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700';
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

  const loadWorkspace = useCallback(async (refresh = false) => {
    if (refresh) setIsRefreshing(true);
    setIsLoading(true);
    const [inquiryResult, flowResult] = await Promise.allSettled([
      api.get<Inquiry[]>('/api/customers'),
      flowsService.getAll(),
    ]);

    if (inquiryResult.status === 'fulfilled') {
      setInquiries(Array.isArray(inquiryResult.value) ? inquiryResult.value : []);
      setInquiryError(null);
    } else {
      setInquiries([]);
      setInquiryError('Connect your inquiry source to start receiving live business inquiries.');
    }
    if (flowResult.status === 'fulfilled') setFlows(flowResult.value);
    else setFlows([]);
    setIsLoading(false);
    setIsRefreshing(false);
  }, []);

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

      {/* Tier banner */}
      {tierLoading ? (
        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
          <RefreshCw className="h-4 w-4 animate-spin" /> Checking your plan…
        </div>
      ) : !isPremium ? (
        <div className="space-y-3">
          <div className="flex flex-col gap-4 rounded-2xl border border-teal-300/60 bg-teal-50 p-5 dark:border-teal-500/20 dark:bg-teal-500/10 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-teal-600 dark:text-teal-400" />
              <div>
                <p className="font-semibold text-teal-900 dark:text-teal-200">Upgrade to Full Access</p>
                <p className="mt-1 text-sm text-teal-800/80 dark:text-teal-200/70">Unlock bulk analysis, advanced AI scoring, and priority support.</p>
              </div>
            </div>
            <button onClick={() => openTab('onboarding')} className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-bold text-white hover:bg-teal-700 transition">
              Upgrade <ArrowRight className="h-4 w-4" />
            </button>
          </div>
          <AccessKeyRedemption onRedemptionSuccess={refetchTier} />
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-200/60 bg-emerald-50 px-5 py-3 text-sm font-semibold text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4" /> Full Access — all premium features are enabled.
        </div>
      )}

      {/* Stat Cards - Matching Landing Page Preview Style */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { title: "Today's Leads", value: inquiries.length, trend: inquiries.length > 0 ? `+${inquiries.length}` : '0', isPositive: true, icon: Users, color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-50 dark:bg-blue-500/10', borderColor: 'border-blue-100 dark:border-blue-500/20' },
          { title: 'Hot Leads', value: hotInquiries.length, trend: hotInquiries.length > 0 ? `+${hotInquiries.length}` : '0', isPositive: true, icon: Flame, color: 'text-orange-600 dark:text-orange-400', bgColor: 'bg-orange-50 dark:bg-orange-500/10', borderColor: 'border-orange-100 dark:border-orange-500/20' },
          { title: 'Pending', value: pendingInquiries.length, trend: pendingInquiries.length > 0 ? `${pendingInquiries.length}` : '0', isPositive: pendingInquiries.length === 0, icon: Clock, color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-50 dark:bg-amber-500/10', borderColor: 'border-amber-100 dark:border-amber-500/20' },
          { title: 'Qualified', value: qualifiedInquiries.length, trend: qualifiedInquiries.length > 0 ? `+${qualifiedInquiries.length}` : '0', isPositive: true, icon: CheckCircle2, color: 'text-emerald-600 dark:text-emerald-400', bgColor: 'bg-emerald-50 dark:bg-emerald-500/10', borderColor: 'border-emerald-100 dark:border-emerald-500/20' },
        ].map(stat => (
          <div key={stat.title} className="bg-white dark:bg-white/5 rounded-2xl p-5 border border-slate-200/80 dark:border-white/10 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className={`w-10 h-10 rounded-lg ${stat.bgColor} border ${stat.borderColor} flex items-center justify-center`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-md ${stat.isPositive ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400'}`}>
                {stat.isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {stat.trend}
              </div>
            </div>
            <h4 className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1">{stat.title}</h4>
            <div className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">{isLoading ? '—' : stat.value}</div>
          </div>
        ))}
      </div>

      {/* Recent Inquiries Table - Matching Landing Page Preview Style */}
      <div className="bg-white dark:bg-white/5 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200/80 dark:border-white/10 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Recent Inquiries</h3>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">Live records from your connected pipeline</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-sm text-slate-400 dark:text-slate-500">
              <Search className="w-3.5 h-3.5" />
              <input
                type="text"
                placeholder="Search leads..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent outline-none text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 w-32"
              />
            </div>
            <button onClick={() => setActiveTab('inquiries')} className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300 px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 shadow-sm hover:border-teal-400 transition">
              <Filter className="w-3.5 h-3.5" />
              View all
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="p-12 text-center">
            <div className="inline-flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <RefreshCw className="w-4 h-4 animate-spin" />
              Loading live inquiries…
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
                  <tr className="bg-slate-50/80 dark:bg-white/[0.02] text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200/80 dark:border-white/10">
                    <th className="px-6 py-3.5">Customer</th>
                    <th className="px-6 py-3.5">Intent</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5">Time</th>
                    <th className="px-6 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {filteredInquiries.slice(0, 8).map((inquiry, index) => (
                    <tr key={inquiry.id} className="bg-white dark:bg-transparent hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors animate-fade-in-up" style={{ animationDelay: `${index * 0.05}s` }}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                            {getInitials(inquiry.name)}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 dark:text-white text-sm truncate">{inquiry.name}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate">{inquiry.company || inquiry.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {(inquiry.intent?.toLowerCase() === 'high' || inquiry.urgency?.toLowerCase() === 'high') && <Flame className="w-4 h-4 text-orange-500 dark:text-orange-400" />}
                          <span className={`text-sm font-semibold capitalize ${intentColor(inquiry.intent || inquiry.urgency)}`}>
                            {inquiry.intent || inquiry.urgency || '—'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold border ${statusBadge(inquiry.status)}`}>
                          {inquiry.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-500 dark:text-slate-400">
                        {timeAgo(inquiry.last_active)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button
                          onClick={() => setSelectedInquiry(inquiry)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-teal-700 bg-teal-50 dark:bg-teal-500/10 dark:text-teal-300 rounded-lg hover:bg-teal-100 dark:hover:bg-teal-500/20 transition border border-teal-200/60 dark:border-teal-500/20"
                          title="View Inquiry Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {inquiries.length > 8 && (
              <div className="px-6 py-3.5 border-t border-slate-200/80 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.01] text-center">
                <button onClick={() => setActiveTab('inquiries')} className="text-xs font-bold text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 transition">
                  View all {inquiries.length} inquiries &rarr;
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* AI Pipeline Status Card */}
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-white/5">
          <div className="flex items-center gap-3"><div className="rounded-xl bg-teal-500/10 p-2.5"><Bot className="h-5 w-5 text-teal-600 dark:text-teal-400" /></div><div><h2 className="font-bold text-slate-950 dark:text-white">AI Pipeline Status</h2><p className="text-xs text-slate-500 dark:text-slate-400">The operating loop</p></div></div>
          <div className="mt-6 space-y-5">
            {['Capture the inquiry from your form or webhook', 'Analyze intent, urgency, and fit with AI', 'Route the next action to your team or CRM'].map((step, index) => <div key={step} className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600 dark:bg-white/10 dark:text-slate-300">{index + 1}</span><p className="pt-0.5 text-sm text-slate-600 dark:text-slate-300">{step}</p></div>)}
          </div>
          <button onClick={() => openTab('integration')} className="mt-7 inline-flex items-center gap-2 text-sm font-bold text-teal-700 dark:text-teal-400">Configure the loop <ArrowRight className="h-4 w-4" /></button>
        </div>

        {/* Active Automation Card */}
        <div className="relative overflow-hidden rounded-2xl border border-teal-500/30 bg-white p-6 shadow-sm dark:border-teal-500/20 dark:bg-white/5">
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
            <span>Last inquiry: {inquiries.length > 0 ? timeAgo(inquiries[0].last_active) : 'Waiting for connection...'}</span>
            <span className="font-medium text-teal-600 dark:text-teal-400">{inquiries.length} inquiries processed</span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderInquiries = () => <div className="space-y-6"><PageHeading title="Inquiry queue" description="Review the business inquiries coming through your connected source." action={<button onClick={() => loadWorkspace(true)} className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-bold text-white"><RefreshCw className="h-4 w-4" /> Refresh</button>} /><InquiryQueue inquiries={inquiries} isLoading={isLoading} onSelectInquiry={(inquiry) => setSelectedInquiry(inquiry)} /></div>;

  const renderAutomations = () => (
    <div className="space-y-6">
      <PageHeading
        title="Automations"
        description="Keep the AI workflows that turn inquiries into action visible and accountable."
        action={<button onClick={() => openTab('onboarding')} className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-bold text-white">Get your API key <ArrowRight className="h-4 w-4" /></button>}
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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-white overflow-x-hidden w-full">
      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 z-30 bg-slate-950/60 backdrop-blur-xs md:hidden animate-fade-in"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside className={`fixed inset-y-0 left-0 z-40 w-72 border-r border-slate-200 bg-white p-5 transition-transform dark:border-white/10 dark:bg-slate-950 ${mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <NodalXLogo className="h-9 w-9" />
            <span className="text-lg font-extrabold tracking-tight">NODALxAI</span>
          </div>
          <button onClick={() => setMobileOpen(false)} className="md:hidden">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-10 px-3 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Workspace</p>
        <nav className="mt-3 space-y-1">
          {tabLabels.map(tab => (
            <button key={tab.id} onClick={() => openTab(tab.id)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${activeTab === tab.id ? 'bg-teal-500/10 text-teal-700 dark:text-teal-300' : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5'}`}>
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </nav>
        <div className="mt-auto hidden border-t border-slate-200 pt-5 dark:border-white/10 md:block">
          <button onClick={() => openTab('profile')} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-slate-100 dark:hover:bg-white/5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-teal-500 to-cyan-500 text-xs font-bold text-white">
              {user?.photoURL ? <img src={user.photoURL} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" /> : (user?.displayName || 'U').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-700 dark:text-slate-200">{user?.displayName || 'User'}</p>
              <p className="truncate text-xs text-slate-400">{user?.email}</p>
            </div>
          </button>
        </div>
      </aside>

      <div className="md:pl-72">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-5 backdrop-blur md:px-8 dark:border-white/10 dark:bg-slate-950/90">
          <button onClick={() => setMobileOpen(true)} className="md:hidden">
            <Menu className="h-5 w-5" />
          </button>
          <div className="hidden text-sm font-semibold text-slate-500 md:block">
            {user?.displayName ? `Welcome, ${user.displayName.split(' ')[0]}` : 'Workspace'}
          </div>
          <div className="ml-auto flex items-center gap-4">
            <ThemeToggle />
            <span className="hidden text-sm text-slate-500 sm:block">{user?.email}</span>
            <button onClick={logout} className="text-slate-400 hover:text-rose-600 md:hidden">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-7xl p-5 md:p-8">{content}</main>
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
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border ${statusBadge(selectedInquiry.status)}`}>
                    {selectedInquiry.status}
                  </span>
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
    </div>
  );
}

function PageHeading({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-600 dark:text-teal-400">NodalX operations</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 dark:text-white">{title}</h1><p className="mt-2 text-slate-500 dark:text-slate-400">{description}</p></div>{action}</div>;
}

function InquiryQueue({ inquiries, isLoading, onViewAll, onSelectInquiry }: { inquiries: Inquiry[]; isLoading: boolean; onViewAll?: () => void; onSelectInquiry?: (inquiry: Inquiry) => void }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-white/5">
      <div className="flex items-center justify-between border-b border-slate-200 p-6 dark:border-white/10">
        <div>
          <h2 className="font-bold text-slate-950 dark:text-white">Recent inquiries</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Live records from your connected workflow</p>
        </div>
        {onViewAll && (
          <button onClick={onViewAll} className="inline-flex items-center gap-1 text-sm font-bold text-teal-700 dark:text-teal-400">
            View queue <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>
      {isLoading ? (
        <div className="p-10 text-center text-sm text-slate-500">Loading live inquiries…</div>
      ) : inquiries.length === 0 ? (
        <EmptyState title="No inquiries yet" description="When your form or webhook receives an inquiry, it will appear here for triage." />
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-white/5">
          {inquiries.map(inquiry => (
            <div key={inquiry.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between hover:bg-slate-50/60 dark:hover:bg-white/[0.02] transition-colors">
              <div className="min-w-0 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                  {getInitials(inquiry.name)}
                </div>
                <div>
                  <p className="truncate font-semibold text-slate-900 dark:text-white">{inquiry.name}</p>
                  <p className="truncate text-sm text-slate-500 dark:text-slate-400">{inquiry.company || inquiry.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold border ${statusBadge(inquiry.status)}`}>{inquiry.status}</span>
                <span className="hidden text-xs text-slate-400 sm:block">{timeAgo(inquiry.last_active)}</span>
                {onSelectInquiry && (
                  <button
                    onClick={() => onSelectInquiry(inquiry)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-teal-700 bg-teal-50 dark:bg-teal-500/10 dark:text-teal-300 rounded-lg hover:bg-teal-100 transition border border-teal-200/60 dark:border-teal-500/20"
                  >
                    <Eye className="w-3.5 h-3.5" />
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
  return <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center dark:border-white/15"><Sparkles className="mx-auto h-7 w-7 text-teal-500" /><h3 className="mt-4 font-bold text-slate-900 dark:text-white">{title}</h3><p className="mx-auto mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">{description}</p>{action && actionLabel && <button onClick={action} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-bold text-white">{actionLabel}<ArrowRight className="h-4 w-4" /></button>}</div>;
}
