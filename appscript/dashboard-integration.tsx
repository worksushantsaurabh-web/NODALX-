/**
 * NODALxAI — Dashboard Integration for Apps Script
 * 
 * This shows how to update your Dashboard.tsx to fetch inquiry data
 * from the Google Apps Script GET endpoint instead of /api/customers.
 * 
 * Use this if you want to fully replace your backend's inquiry storage
 * with Google Sheets (managed by Apps Script).
 */

import { useState, useEffect } from 'react';

const APPSCRIPT_WEBHOOK_URL = import.meta.env.VITE_APPSCRIPT_WEBHOOK_URL || '';

interface Inquiry {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  industry: string;
  service: string;
  message: string;
  status: string;
  intent: string;
  urgency: string;
  fit_score: number;
  summary: string;
  suggested_action: string;
  category: string;
  last_active: string;
}

interface InquiryStats {
  total: number;
  byIntent: Record<string, number>;
  byUrgency: Record<string, number>;
  byCategory: Record<string, number>;
  avgFitScore: string;
}

// ═══════════════════════════════════════════════════════════════
// CUSTOM HOOK: Fetch Inquiries from Apps Script
// ═══════════════════════════════════════════════════════════════

export function useAppsScriptInquiries() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [stats, setStats] = useState<InquiryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInquiries = async () => {
    if (!APPSCRIPT_WEBHOOK_URL) {
      setError('Apps Script URL not configured');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch inquiries list
      const listResponse = await fetch(`${APPSCRIPT_WEBHOOK_URL}?action=list`);
      if (!listResponse.ok) throw new Error('Failed to fetch inquiries');
      
      const listData = await listResponse.json();
      if (!listData.success) throw new Error(listData.error || 'Unknown error');
      
      setInquiries(listData.customers || []);

      // Fetch stats
      const statsResponse = await fetch(`${APPSCRIPT_WEBHOOK_URL}?action=stats`);
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        if (statsData.success) {
          setStats(statsData.stats);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInquiries();
  }, []);

  return { inquiries, stats, loading, error, refetch: fetchInquiries };
}

// ═══════════════════════════════════════════════════════════════
// EXAMPLE: Inquiry Card Component
// ═══════════════════════════════════════════════════════════════

export function InquiryCard({ inquiry }: { inquiry: Inquiry }) {
  const getUrgencyBadge = (urgency: string) => {
    const styles = {
      high: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800',
      medium: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800',
      low: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800',
    };
    return styles[urgency as keyof typeof styles] || styles.medium;
  };

  const getIntentBadge = (intent: string) => {
    const styles = {
      purchase: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
      partnership: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
      support: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      spam: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400',
      general: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400',
    };
    return styles[intent as keyof typeof styles] || styles.general;
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="font-bold text-slate-900 dark:text-white">{inquiry.name}</h4>
          <p className="text-sm text-slate-500 dark:text-slate-400">{inquiry.email}</p>
        </div>
        <span className={`px-2 py-1 rounded-lg text-xs font-bold border ${getUrgencyBadge(inquiry.urgency)}`}>
          {inquiry.urgency}
        </span>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${getIntentBadge(inquiry.intent)}`}>
          {inquiry.intent}
        </span>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {inquiry.company}
        </span>
      </div>

      <p className="text-sm text-slate-600 dark:text-slate-400 mb-3 line-clamp-2">
        {inquiry.summary || inquiry.message}
      </p>

      <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-16 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-teal-500 rounded-full"
              style={{ width: `${(inquiry.fit_score || 0) * 10}%` }}
            />
          </div>
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {inquiry.fit_score}/10
          </span>
        </div>
        <span className="text-xs text-slate-400 dark:text-slate-500">
          {new Date(inquiry.last_active).toLocaleDateString()}
        </span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// EXAMPLE: Stats Overview Component
// ═══════════════════════════════════════════════════════════════

export function InquiryStatsOverview({ stats }: { stats: InquiryStats | null }) {
  if (!stats) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
        <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.total}</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">Total Inquiries</p>
      </div>
      
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
        <p className="text-2xl font-bold text-teal-600 dark:text-teal-400">{stats.avgFitScore}</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">Avg Fit Score</p>
      </div>
      
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
        <p className="text-2xl font-bold text-red-600 dark:text-red-400">
          {stats.byUrgency?.high || 0}
        </p>
        <p className="text-sm text-slate-500 dark:text-slate-400">High Urgency</p>
      </div>
      
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
        <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
          {stats.byIntent?.purchase || 0}
        </p>
        <p className="text-sm text-slate-500 dark:text-slate-400">Purchase Intent</p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// EXAMPLE: Usage in Dashboard Page
// ═══════════════════════════════════════════════════════════════

/*
// In your Dashboard.tsx, replace the existing customer fetch with:

import { useAppsScriptInquiries, InquiryCard, InquiryStatsOverview } from './dashboard-integration';

function InquiriesTab() {
  const { inquiries, stats, loading, error, refetch } = useAppsScriptInquiries();

  if (loading) return <div>Loading inquiries...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <InquiryStatsOverview stats={stats} />
      
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold">Recent Inquiries</h3>
        <button 
          onClick={refetch}
          className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700"
        >
          Refresh
        </button>
      </div>
      
      <div className="space-y-4">
        {inquiries.map(inquiry => (
          <InquiryCard key={inquiry.id} inquiry={inquiry} />
        ))}
      </div>
    </div>
  );
}
*/
