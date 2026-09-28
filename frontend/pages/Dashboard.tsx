import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Copy, Inbox, LogOut, Mail, Menu, Moon, RefreshCw, Search, Settings2, Sun, User as UserIcon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useUserTier } from '../hooks/useUserTier';
import { NodalXLogo } from '../components/Navbar';
import IntegrationSetup from '../components/IntegrationSetup';
import CustomerOnboarding from '../components/CustomerOnboarding';
import UserProfilePage from '../components/UserProfile';
import DataConnectors from '../components/DataConnectors';
import GoogleSheetsModal from '../components/GoogleSheetsModal';
import OnboardingWizard from '../components/OnboardingWizard';
import { apiRequest } from '../src/services/api';
import { activityTime, matchesFilter, normalize, parseInquiries, priorityReasons, queueFilters, queueRules, selectQueue, settleSource } from './inquiryDesk';
import type { Inquiry, InquirySource, QueueFilter, QueueSort, SourceSnapshot } from './inquiryDesk';
import { useTheme } from '../contexts/ThemeContext';
import { BorderBeam } from '../ui/BorderBeam';
import { MagicCard } from '../ui/MagicCard';
import { NumberTicker } from '../ui/NumberTicker';

const PAGE_SIZE = 20;
const control = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border-strong px-4 py-2 text-sm font-semibold transition hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40';
const sourceLabels: Record<InquirySource, string> = { backend: 'NodalX', 'apps-script': 'Apps Script' };
const emptySource: SourceSnapshot = { records: [], fetchedAt: null, warning: null };

type DashboardTab = 'inquiries' | 'integration' | 'connectors' | 'profile';
const tabLabels: Array<{ id: DashboardTab; label: string; icon: React.ElementType }> = [
  { id: 'inquiries', label: 'Inquiry Desk', icon: Inbox },
  { id: 'integration', label: 'Connect pipeline', icon: Settings2 },
  { id: 'connectors', label: 'Import data', icon: Settings2 },
  { id: 'profile', label: 'Your profile', icon: UserIcon },
];

function formatActivity(value: string) {
  const time = activityTime(value);
  return time === null ? 'Unknown' : new Date(time).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export default function Dashboard({ defaultTab = 'inquiries' }: { defaultTab?: string }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { tier, loading: tierLoading } = useUserTier();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const activeTab: DashboardTab = tabLabels.some(tab => tab.id === requestedTab)
    ? requestedTab as DashboardTab
    : tabLabels.some(tab => tab.id === defaultTab) ? defaultTab as DashboardTab : 'inquiries';
  const [showWizard, setShowWizard] = useState(() => localStorage.getItem('nodalx_wizard') === '1');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isSheetsModalOpen, setIsSheetsModalOpen] = useState(false);
  const [sheetNotice, setSheetNotice] = useState('');
  const [sources, setSources] = useState<Record<InquirySource, SourceSnapshot>>({ backend: emptySource, 'apps-script': emptySource });
  const [isRefreshing, setIsRefreshing] = useState(true);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [filter, setFilter] = useState<QueueFilter>('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<QueueSort>('priority');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<{ key: string; pending: boolean; error?: string; message?: string } | null>(null);
  const [copyState, setCopyState] = useState<{ key: string; pending: boolean; error?: string; message?: string } | null>(null);
  const saving = useRef(false);
  const copying = useRef(false);
  const detailHeading = useRef<HTMLHeadingElement>(null);
  const queueHeading = useRef<HTMLHeadingElement>(null);
  const mainHeading = useRef<HTMLElement>(null);
  const selectedButton = useRef<HTMLButtonElement | null>(null);
  const focusDetail = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]);
    // Firebase Functions/backend is the canonical dashboard source. Apps Script
    // remains available for legacy integrations but is not queried here.
    const configured: InquirySource[] = ['backend'];
    setIsRefreshing(true);
    const requests = configured.map(async source => {
      return parseInquiries(await apiRequest<unknown>('/api/customers', { signal }), source);
    });
    void Promise.allSettled(requests).then(results => {
      if (controller.signal.aborted) return;
      const now = Date.now();
      setSources(previous => {
        const next = { ...previous };
        configured.forEach((source, index) => { next[source] = settleSource(previous[source], results[index], now); });
        return next;
      });
      setIsRefreshing(false);
    });
    return () => controller.abort();
  }, [refreshVersion]);

  const inquiries = [...sources.backend.records, ...sources['apps-script'].records];
  const queue = selectQueue(inquiries, filter, search, sort);
  const visibleQueue = queue.slice(0, visibleCount);
  // Keep the detail open even if a successful status change moves it out of this filter.
  const selected = inquiries.find(inquiry => inquiry.key === selectedKey) || null;
  const configuredSources: InquirySource[] = ['backend'];
  const hasFetched = configuredSources.some(source => sources[source].fetchedAt !== null);
  const hasWarnings = configuredSources.some(source => sources[source].warning);
  const isDesk = activeTab === 'inquiries';

  useEffect(() => {
    if (focusDetail.current && selected) {
      detailHeading.current?.focus({ preventScroll: true });
      if (!window.matchMedia('(min-width: 1024px)').matches) {
        detailHeading.current?.closest('section')?.scrollIntoView({ block: 'start' });
      }
      focusDetail.current = false;
    }
  }, [selectedKey, selected, isDesk]);

  useEffect(() => {
    if (selectedKey && !selected && !isRefreshing) {
      setSelectedKey(null);
      queueHeading.current?.focus();
    }
  }, [selectedKey, selected, isRefreshing]);

  const openTab = (tab: DashboardTab) => {
    setMobileOpen(false);
    setSearchParams(tab === 'inquiries' ? {} : { tab });
    requestAnimationFrame(() => mainHeading.current?.focus());
  };

  const refresh = () => {
    if (isRefreshing || saving.current) return;
    setIsRefreshing(true);
    setRefreshVersion(version => version + 1);
  };

  const chooseFilter = (next: QueueFilter) => {
    setFilter(next);
    setVisibleCount(PAGE_SIZE);
  };

  const backToQueue = () => {
    setSelectedKey(null);
    requestAnimationFrame(() => {
      if (selectedButton.current?.isConnected) selectedButton.current.focus();
      else queueHeading.current?.focus();
    });
  };

  const copyEmail = async (inquiry: Inquiry) => {
    if (copying.current || !inquiry.email) return;
    copying.current = true;
    setCopyState({ key: inquiry.key, pending: true });
    try {
      if (!navigator.clipboard) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(inquiry.email);
      setCopyState({ key: inquiry.key, pending: false, message: 'Email copied.' });
    } catch {
      setCopyState({ key: inquiry.key, pending: false, error: 'Could not copy. Select and copy the email address above manually.' });
    } finally {
      copying.current = false;
    }
  };

  const updateStatus = async (inquiry: Inquiry, status: string) => {
    if (inquiry.source !== 'backend' || saving.current || isRefreshing || normalize(inquiry.status) === normalize(status)) return;
    saving.current = true;
    setSaveState({ key: inquiry.key, pending: true });
    try {
      const response = await apiRequest<{ success?: boolean; error?: string } | undefined>(`/api/inquiries/${encodeURIComponent(inquiry.id)}/status`, {
        method: 'PATCH', body: JSON.stringify({ status }), signal: AbortSignal.timeout(20000),
      });
      if (response?.success === false || response?.error) throw new Error(response.error || 'The server declined the change.');
      setSources(previous => ({
        ...previous,
        backend: { ...previous.backend, records: previous.backend.records.map(record => record.key === inquiry.key ? { ...record, status } : record) },
      }));
      setSaveState({ key: inquiry.key, pending: false, message: `Status saved as ${status}.` });
    } catch (error) {
      setSaveState({ key: inquiry.key, pending: false, error: `Status was not saved. ${error instanceof Error ? error.message : 'Request failed.'} Your displayed status is unchanged.` });
    } finally {
      saving.current = false;
    }
  };

  const desk = (
    <div className="space-y-7">
      <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-neutral-400">Inquiry Desk / Your next conversation</p>
          <h1 className="mt-3 max-w-2xl text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">Know who needs a reply.</h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-neutral-400">Find the opportunity. Read the context. Make the next move.</p>
        </div>
        <button onClick={refresh} disabled={isRefreshing || saveState?.pending} className={`${control} shrink-0 self-start lg:self-auto`}>
          <RefreshCw aria-hidden="true" className={`h-4 w-4 ${isRefreshing ? 'animate-spin motion-reduce:animate-none' : ''}`} />
          {isRefreshing ? 'Refreshing...' : 'Refresh inquiries'}
        </button>
      </div>

       <div className="border-y border-border py-3 text-xs leading-relaxed text-neutral-400" aria-live="polite" aria-atomic="true">
         <p className="font-semibold text-neutral-200">{isRefreshing ? 'Refreshing your inquiry desk. Existing records remain visible.' : hasWarnings ? 'The latest refresh had a source issue; review details before acting.' : 'Showing the latest records returned by your backend.'}</p>
         <details className="mt-1">
           <summary className="w-fit cursor-pointer text-text-secondary hover:text-text-primary">View source details</summary>
           {configuredSources.map(source => (
             <p key={source} className="mt-1">
               {sourceLabels[source]}: last successful fetch {sources[source].fetchedAt === null ? 'not yet available' : new Date(sources[source].fetchedAt!).toLocaleString()}.
               {sources[source].warning && <span className="ml-1 text-text-primary">{sources[source].warning}</span>}
             </p>
           ))}
           <p className="mt-1">The backend returns up to 100 records. Source activity is not a verified receipt time.</p>
         </details>
       </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5" aria-label="Filter by loaded inquiry counts">
        {queueFilters.map(item => (
          <MagicCard key={item.id} className={`min-h-28 ${filter === item.id ? 'ring-2 ring-accent' : ''}`}>
            <button onClick={() => chooseFilter(item.id)} aria-pressed={filter === item.id} className="w-full min-h-28 p-4 text-left transition sm:p-5">
              <span className={`block text-xs font-semibold ${filter === item.id ? 'text-accent' : 'text-text-secondary'}`}>{item.id === 'all' ? 'All loaded' : item.label}</span>
              <NumberTicker value={hasFetched ? inquiries.filter(inquiry => matchesFilter(inquiry, item.id)).length : 0} className={`mt-3 block text-3xl font-semibold tracking-tight ${filter === item.id ? 'text-accent' : 'text-text-primary'}`} />
            </button>
          </MagicCard>
        ))}
      </div>

      <section aria-label="Inquiry workspace" className="glass-panel rounded-2xl overflow-hidden">
        <div className="space-y-4 border-b border-border p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="min-w-0 flex-1">
              <label htmlFor="inquiry-search" className="mb-2 block text-xs font-semibold text-neutral-300">Search inquiries</label>
              <div className="relative">
                <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-neutral-400" />
                <input id="inquiry-search" type="search" value={search} onChange={event => { setSearch(event.target.value); setVisibleCount(PAGE_SIZE); }} placeholder="Name, email, company or message" className="min-h-11 w-full rounded-lg border border-border-strong bg-bg py-2 pl-10 pr-3 text-sm text-text-primary placeholder:text-neutral-500" />
              </div>
            </div>
            <div>
              <label htmlFor="inquiry-sort" className="mb-2 block text-xs font-semibold text-neutral-300">Sort by</label>
                <select id="inquiry-sort" value={sort} onChange={event => { setSort(event.target.value as QueueSort); setVisibleCount(PAGE_SIZE); }} className="min-h-11 w-full rounded-lg border border-border-strong bg-bg px-3 text-sm text-text-primary sm:w-auto">
                <option value="priority">Priority first</option>
                <option value="newest">Newest source activity</option>
                <option value="oldest">Oldest source activity</option>
              </select>
            </div>
          </div>
          <div className="flex flex-wrap gap-2" aria-label="Inquiry filters">
            {queueFilters.map(item => <button key={item.id} onClick={() => chooseFilter(item.id)} aria-pressed={filter === item.id} className={`${control} ${filter === item.id ? 'border-transparent bg-accent text-[#fff] hover:brightness-110' : 'text-text-secondary'}`}>{item.label}</button>)}
          </div>
          <details className="text-xs leading-relaxed text-neutral-400">
            <summary className="w-fit cursor-pointer py-2 text-neutral-300">How this queue is ordered</summary>
            <p className="mt-2 max-w-4xl">{queueRules}</p>
            <p className="mt-2">These are deterministic queue rules, not AI evidence or a prediction of conversion. Metric counts use all loaded records, ignore search, and may overlap.</p>
          </details>
        </div>

        <div className="grid items-start lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
           <div className="min-w-0 bg-surface-hover/40">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-4">
              <h2 ref={queueHeading} tabIndex={-1} className="scroll-mt-24 text-sm font-semibold">{queueFilters.find(item => item.id === filter)?.label} inquiries</h2>
              <p role="status" className="text-xs text-neutral-400">{visibleQueue.length} shown / {queue.length} results</p>
            </div>
            {visibleQueue.length ? (
              <ul className="divide-y divide-border">
                {visibleQueue.map(inquiry => {
                  const reasons = priorityReasons(inquiry);
                  return <li key={inquiry.key}>
              <MagicCard className={`w-full border-l-2 ${selectedKey === inquiry.key ? 'border-accent' : 'border-transparent'}`}>
              <button onClick={event => { selectedButton.current = event.currentTarget; focusDetail.current = true; setSelectedKey(inquiry.key); if (selectedKey === inquiry.key) detailHeading.current?.focus(); }} aria-pressed={selectedKey === inquiry.key} aria-controls="inquiry-detail" className="group w-full p-5 text-left transition">
                      <span className="flex items-start justify-between gap-3">
                        <span className="min-w-0">
                          <span className="block truncate text-base font-semibold">{inquiry.name}</span>
                          <span className="mt-1 block truncate text-xs text-neutral-400">{inquiry.company || inquiry.email || 'No company or email provided'}</span>
                        </span>
                        <ArrowRight aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-neutral-400 group-hover:text-accent" />
                      </span>
                      <span className="mt-3 line-clamp-2 break-words text-sm leading-relaxed text-neutral-300">{inquiry.message || 'Original message not provided by this source.'}</span>
                      <span className="mt-3 flex flex-wrap gap-2 text-[11px] font-medium">
                        <span className="rounded border border-border-strong px-2 py-1">{inquiry.status || 'Status unknown'}</span>
                        {reasons.length > 0 && <span className="rounded bg-accent px-2 py-1 text-[#fff]">High priority</span>}
                      </span>
                      <span className="mt-3 block text-xs text-neutral-400">{sourceLabels[inquiry.source]} / Activity: {formatActivity(inquiry.last_active)}</span>
                     </button>
                     </MagicCard>
                  </li>;
                })}
              </ul>
            ) : (
              <div className="px-6 py-14 text-center">
                <Inbox aria-hidden="true" className="mx-auto mb-4 h-7 w-7 text-neutral-400" />
                <h3 className="text-lg font-semibold">{isRefreshing && !hasFetched ? 'Loading your desk...' : !hasFetched ? 'Inquiries could not be loaded' : inquiries.length ? 'No matching inquiries' : hasWarnings ? 'No records available from these sources' : 'Your desk is clear'}</h3>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-neutral-400">{!hasFetched || hasWarnings ? 'Check the source warnings above and retry. This is not a confirmed empty inbox.' : inquiries.length ? 'Try a different filter or search. Other loaded records are still available.' : 'No inquiries were returned. Manage your sources in setup when you are ready.'}</p>
                {(search || filter !== 'all') && <button onClick={() => { setSearch(''); chooseFilter('all'); }} className={`${control} mt-5`}>Clear search & filters</button>}
                {!inquiries.length && <button onClick={() => openTab('connectors')} className={`${control} mt-5`}>Manage sources <ArrowRight aria-hidden="true" className="h-4 w-4" /></button>}
              </div>
            )}
            {visibleCount < queue.length && <div className="border-t border-border p-4"><button onClick={() => setVisibleCount(count => count + PAGE_SIZE)} className={`${control} w-full`}>Load {Math.min(PAGE_SIZE, queue.length - visibleCount)} more <span className="text-neutral-400">({queue.length - visibleCount} remaining)</span></button></div>}
          </div>

            <section id="inquiry-detail" aria-label="Inquiry detail" className="glass-panel relative min-w-0 scroll-mt-24 border-t border-border lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:border-l lg:border-t-0">
             {selected && <BorderBeam />}
            {selected ? (
              <div className="space-y-6 p-5 sm:p-6">
                <button onClick={backToQueue} className={control}><ArrowLeft aria-hidden="true" className="h-4 w-4" /> Back to queue</button>
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-neutral-400">{sourceLabels[selected.source]} / Inquiry detail</p>
                  <h2 ref={detailHeading} tabIndex={-1} className="mt-2 scroll-mt-24 break-words text-2xl font-semibold tracking-tight">{selected.name}</h2>
                  <p className="mt-2 break-words text-sm text-neutral-400">{selected.company || 'Company not provided'}</p>
                  <p className="mt-1 select-text break-all text-sm">{selected.email || 'Email not provided'}</p>
                  {selected.phone && <p className="mt-1 select-text text-sm">{selected.phone}</p>}
                  {!queue.some(inquiry => inquiry.key === selected.key) && <p className="mt-3 border-l-2 border-accent pl-3 text-xs text-text-secondary">This inquiry is outside your current search or filter. Its detail stays open until you select another or go back.</p>}
                </div>

                <div className="border-y border-border py-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Why this priority?</h3>
                  <p className="mt-2 text-sm leading-relaxed">{priorityReasons(selected).length ? `${priorityReasons(selected).join('; ')}. Matches the high-priority rule.` : matchesFilter(selected, 'spam') ? 'Spam status excludes this inquiry from high priority and puts it last in priority sort.' : matchesFilter(selected, 'review') ? `Status "${selected.status}" matches Needs review. No high-priority intent or urgency rule matches.` : 'No high-priority or needs-review rule matches. This does not establish whether a reply is needed.'}</p>
                  <p className="mt-2 text-xs leading-relaxed text-neutral-400">Based only on the source fields below, not message analysis. Priority sort uses source activity for ties; fit score is not used.</p>
                </div>

                <dl className="grid grid-cols-2 gap-4 text-sm">
                  {[['Status', selected.status], ['Intent', selected.intent], ['Urgency', selected.urgency], ['Category', selected.category], ['Service', selected.service], ['Industry', selected.industry], ['Fit score (source value)', selected.fit_score], ['Source activity', formatActivity(selected.last_active)]].map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-xs text-neutral-400">{label}</dt><dd className="mt-1 break-words font-medium">{value || 'Unknown'}</dd></div>)}
                </dl>
                {selected.processing_status && selected.processing_status !== 'unknown' && <p className="text-xs text-neutral-400">AI processing: {selected.processing_status.replaceAll('_', ' ')}</p>}
                <p className="text-xs leading-relaxed text-neutral-400">Missing classifications are unknown, not low priority. Score scale and classification method are not verified by this desk.</p>

                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Original message</h3>
                  <p className="mt-3 whitespace-pre-wrap break-words rounded-lg border border-border-strong bg-bg p-4 text-sm leading-relaxed">{selected.message || 'No original message was returned by this source.'}</p>
                </div>
                {selected.summary && <div><h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Source-provided summary</h3><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed">{selected.summary}</p></div>}
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Suggested action / {selected.suggested_action ? 'From source' : 'Desk rule'}</h3>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed">{selected.suggested_action || (matchesFilter(selected, 'spam') ? 'Review the original message before deciding whether to respond. This record is marked spam.' : matchesFilter(selected, 'contacted') ? 'Check your email history before following up. Contacted status does not verify delivery or a reply.' : 'Read the original message and confirm the request before drafting a response.')}</p>
                </div>

                <div className="space-y-3 border-t border-border pt-5">
                  <div className="flex flex-wrap gap-2">
                    {selected.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(selected.email) && <a href={`mailto:${encodeURIComponent(selected.email)}?subject=${encodeURIComponent(`Re: Inquiry from ${selected.name}`)}`} className={`${control} border-transparent bg-accent text-[#fff] hover:brightness-110`}><Mail aria-hidden="true" className="h-4 w-4" /> Open email draft</a>}
                    <button onClick={() => copyEmail(selected)} disabled={!selected.email || copyState?.pending} className={control}><Copy aria-hidden="true" className="h-4 w-4" /> {copyState?.key === selected.key && copyState.pending ? 'Copying...' : 'Copy email'}</button>
                  </div>
                  <p className="text-xs leading-relaxed text-neutral-400">Opening your email app does not send a reply or mark this inquiry contacted. A valid email is required to open a draft.</p>
                  {copyState?.key === selected.key && <p role={copyState.error ? 'alert' : 'status'} className="text-sm">{copyState.error || copyState.message}</p>}
                </div>

                <div className="space-y-3 border-t border-border pt-5">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Update status</h3>
                  <p id="status-help" className="text-xs leading-relaxed text-neutral-400">{selected.source === 'apps-script' ? 'Apps Script records are read-only here. Edit status in the source sheet.' : 'Mark Contacted only after you actually contact the sender.'}</p>
                  <fieldset disabled={selected.source === 'apps-script' || !!saveState?.pending || isRefreshing} aria-describedby="status-help" className="flex flex-wrap gap-2">
                    <legend className="sr-only">Choose a status to save</legend>
                    {['Qualified', 'Contacted', 'Pending', 'Spam'].map(status => <button key={status} onClick={() => updateStatus(selected, status)} disabled={normalize(selected.status) === normalize(status)} aria-pressed={normalize(selected.status) === normalize(status)} className={`${control} ${normalize(selected.status) === normalize(status) ? 'border-transparent bg-accent text-[#fff]' : ''}`}>{status}</button>)}
                  </fieldset>
                  {saveState?.key === selected.key && <p role={saveState.error ? 'alert' : 'status'} className="text-sm leading-relaxed">{saveState.pending ? 'Saving status...' : saveState.error || saveState.message}</p>}
                </div>
              </div>
            ) : (
              <div className="flex min-h-72 flex-col justify-center p-8">
                <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">Context before contact</p>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight">A better reply starts here.</h2>
                <p className="mt-3 max-w-sm text-sm leading-relaxed text-neutral-400">Select an inquiry to read its original message, inspect the source fields, and choose your next action.</p>
              </div>
            )}
          </section>
        </div>
      </section>
    </div>
  );

  let content: React.ReactNode = desk;
  if (activeTab === 'connectors') content = <DataConnectors />;
  if (activeTab === 'integration') content = <div className="space-y-6"><IntegrationSetup /><CustomerOnboarding /><section className="rounded-xl border border-border bg-surface p-5"><h2 className="text-lg font-semibold">Google Sheets setup</h2><p className="mt-2 text-sm text-neutral-400">Connect a sheet for import and optional inquiry export. Access verification does not confirm that records were processed.</p><button onClick={() => setIsSheetsModalOpen(true)} className={`${control} mt-4`}>Configure Google Sheets</button>{sheetNotice && <p role="status" className="mt-3 text-sm text-neutral-300">{sheetNotice}</p>}</section></div>;
  if (activeTab === 'profile') content = <UserProfilePage />;

  if (showWizard) return <OnboardingWizard userName={user?.displayName || 'there'} onComplete={() => setShowWizard(false)} />;

  return (
    <div className="dashboard-shell min-h-screen w-full bg-bg text-text-primary [&_:focus-visible]:outline [&_:focus-visible]:outline-2 [&_:focus-visible]:outline-offset-[-2px] [&_:focus-visible]:outline-accent">
      <a href="#dashboard-content" onClick={event => { event.preventDefault(); mainHeading.current?.focus(); }} className="sr-only z-50 rounded bg-accent p-3 text-[#fff] focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Skip to workspace</a>
       <aside className="glass-panel fixed inset-y-0 left-0 z-40 hidden w-64 flex-col overflow-y-auto border-r border-border bg-bg/70 p-5 md:flex">
        <div className="flex items-center gap-3"><NodalXLogo className="h-9 w-9" /><span className="text-lg font-bold tracking-tight">NodalX</span></div>
        <nav aria-label="Workspace" className="mt-10 space-y-1">
          {tabLabels.map((tab, index) => <React.Fragment key={tab.id}>
            {index === 1 && <p className="px-3 pb-3 pt-8 text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-500">Setup & account</p>}
            <button onClick={() => openTab(tab.id)} aria-current={activeTab === tab.id ? 'page' : undefined} className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium ${activeTab === tab.id ? 'bg-accent text-[#fff]' : 'text-neutral-400 hover:bg-surface-hover hover:text-white'}`}><tab.icon aria-hidden="true" className="h-4 w-4 shrink-0" />{tab.label}</button>
          </React.Fragment>)}
        </nav>
        <div className="mt-auto border-t border-border pt-5">
          <button onClick={() => openTab('profile')} className="mt-6 flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-surface-hover">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-hover text-sm font-semibold">{user?.photoURL ? <img src={user.photoURL} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" /> : (user?.displayName || 'U').charAt(0).toUpperCase()}</div>
            <div className="min-w-0"><p className="truncate text-sm font-semibold">{user?.displayName || 'Your profile'}</p><p className="truncate text-xs text-neutral-400">{tierLoading ? 'Checking access' : tier === 'full' ? 'Full Access' : 'Basic access'}</p></div>
          </button>
        </div>
      </aside>

      <div className="md:pl-64">
         <header className="glass-panel sticky top-0 z-30 border-b border-border bg-bg/70">
          <div className="flex min-h-[72px] items-center justify-between gap-3 px-4 sm:px-7">
            <button onClick={() => setMobileOpen(open => !open)} aria-expanded={mobileOpen} aria-controls="mobile-workspace-nav" className={`${control} md:hidden`}><Menu aria-hidden="true" className="h-4 w-4" /> {mobileOpen ? 'Close menu' : 'Menu'}</button>
            <p className="hidden text-xs font-medium text-neutral-400 md:block">Workspace <span className="px-2 text-neutral-600">/</span> {isDesk ? 'Inquiry Desk' : tabLabels.find(tab => tab.id === activeTab)?.label}</p>
            <div className="ml-auto flex min-w-0 items-center gap-2 sm:gap-4"><span className="hidden max-w-64 truncate text-xs text-neutral-400 sm:block">{user?.email}</span><button onClick={toggleTheme} className={control} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>{theme === 'dark' ? <Sun aria-hidden="true" className="h-4 w-4" /> : <Moon aria-hidden="true" className="h-4 w-4" />}<span className="sr-only sm:not-sr-only">{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span></button><button onClick={logout} className={control}><LogOut aria-hidden="true" className="h-4 w-4" /><span className="sr-only sm:not-sr-only">Sign out</span></button></div>
          </div>
          {mobileOpen && <nav id="mobile-workspace-nav" aria-label="Mobile workspace" onKeyDown={event => { if (event.key === 'Escape') { setMobileOpen(false); document.querySelector<HTMLButtonElement>('[aria-controls="mobile-workspace-nav"]')?.focus(); } }} className="max-h-[70vh] space-y-1 overflow-y-auto border-t border-border p-4 md:hidden">
            {tabLabels.map(tab => <button key={tab.id} onClick={() => openTab(tab.id)} aria-current={activeTab === tab.id ? 'page' : undefined} className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm ${activeTab === tab.id ? 'bg-accent text-[#fff]' : 'text-neutral-300 hover:bg-surface-hover'}`}><tab.icon aria-hidden="true" className="h-4 w-4" />{tab.label}</button>)}
          </nav>}
        </header>
        <main id="dashboard-content" ref={mainHeading} tabIndex={-1} className="mx-auto max-w-[1500px] px-4 py-7 sm:px-7 lg:py-10">{content}</main>
      </div>
      <GoogleSheetsModal isOpen={isSheetsModalOpen} onClose={() => setIsSheetsModalOpen(false)} onSuccess={title => setSheetNotice(`Connection settings saved for ${title}. Sync execution has not been verified.`)} />
    </div>
  );
}
