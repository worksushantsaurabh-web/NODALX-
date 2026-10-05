import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, ArrowRight, Check, Copy, CreditCard, Inbox, LayoutDashboard, Link2, LogOut, Mail, Menu, Moon, RefreshCw, Repeat, Search, Settings2, Sun } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { NodalXLogo } from '../components/Navbar';
import ImportWorkspace, { WorkspaceConnections } from '../components/workspace/ImportWorkspace';
import WorkspacePipeline from '../components/workspace/WorkspacePipeline';
import AutomationWorkspace from '../components/workspace/AutomationWorkspace';
import { WorkspaceOverview, WorkspaceBilling, WorkspaceSettings, InquiryActivity } from '../components/workspace/WorkspaceViews';
import { useResource, Usage, downloadCsv, PageTitle } from '../components/workspace/ui';
import OnboardingWizard from '../components/OnboardingWizard';
import { apiRequest } from '../src/services/api';
import { activityTime, matchesFilter, normalize, parseInquiryPage, appendInquiryPage, priorityReasons, queueFilters, queueRules, selectQueue, settleSource } from './inquiryDesk';
import { resolveDashboardTab, type DashboardTab } from './dashboardTabs';
import type { Inquiry, InquirySource, QueueFilter, QueueSort, SourceSnapshot } from './inquiryDesk';
import { useTheme } from '../contexts/ThemeContext';

const PAGE_SIZE = 20;
const control = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border-strong bg-surface px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40';
const eyebrow = 'text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary';
const sourceLabels: Record<InquirySource, string> = { backend: 'NodalX', 'apps-script': 'Apps Script' };
const emptySource: SourceSnapshot = { records: [], fetchedAt: null, warning: null };

const tabLabels: Array<{ id: DashboardTab; label: string; icon: React.ElementType }> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'inquiries', label: 'Inquiry Desk', icon: Inbox },
  { id: 'connections', label: 'Sources & connections', icon: Link2 },
  { id: 'connectors', label: 'Imports & processing', icon: Inbox },
  { id: 'automation', label: 'Automation', icon: Repeat },
  { id: 'billing', label: 'Usage & billing', icon: CreditCard },
  { id: 'settings', label: 'Qualification settings', icon: Settings2 },
];

function formatActivity(value: string) {
  const time = activityTime(value);
  return time === null ? 'Unknown' : new Date(time).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export default function Dashboard({ defaultTab = 'overview' }: { defaultTab?: string }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const workspaceUsage = useResource<Usage>('/api/workspace/usage');
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const activeTab = resolveDashboardTab(requestedTab, defaultTab);
  const [showWizard, setShowWizard] = useState(() => localStorage.getItem('nodalx_wizard') === '1');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sources, setSources] = useState<Record<InquirySource, SourceSnapshot>>({ backend: emptySource, 'apps-script': emptySource });
  const [isRefreshing, setIsRefreshing] = useState(true);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [filter, setFilter] = useState<QueueFilter>('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<QueueSort>('priority');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const olderController = useRef<AbortController | null>(null);
  const previousOwner = useRef(user?.uid);
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
    olderController.current?.abort();
    setIsLoadingOlder(false);
    if (previousOwner.current !== user?.uid) {
      previousOwner.current = user?.uid;
      setSources({backend: emptySource, 'apps-script': emptySource});
      setNextCursor(null);
      setSelectedKey(null);
    }
    setIsRefreshing(true);
    void apiRequest<unknown>('/api/workspace/inquiries?limit=100', {signal}).then(parseInquiryPage).then(page => {
      if (controller.signal.aborted) return;
      setSources(previous => ({...previous, backend: settleSource(previous.backend, {status: 'fulfilled', value: page}, Date.now())}));
      setNextCursor(page.nextCursor);
    }).catch(() => {
      if (!controller.signal.aborted) setSources(previous => ({...previous, backend: settleSource(previous.backend, {status: 'rejected', reason: 'Fetch failed'}, Date.now())}));
    }).finally(() => {
      if (!controller.signal.aborted) setIsRefreshing(false);
    });
    return () => { controller.abort(); olderController.current?.abort(); };
  }, [refreshVersion, user?.uid]);

  const loadOlder = async () => {
    if (!nextCursor || isRefreshing || isLoadingOlder || saving.current) return;
    const controller = new AbortController();
    olderController.current = controller;
    setIsLoadingOlder(true);
    try {
      const page = parseInquiryPage(await apiRequest<unknown>(`/api/workspace/inquiries?limit=100&cursor=${encodeURIComponent(nextCursor)}`, {
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]),
      }));
      if (controller.signal.aborted) return;
      setSources(previous => ({...previous, backend: {
        records: appendInquiryPage(previous.backend.records, page.records), fetchedAt: Date.now(),
        warning: page.skipped ? `${page.skipped} unusable records were omitted from this page.` : null,
      }}));
      setNextCursor(page.nextCursor);
      setVisibleCount(count => count + PAGE_SIZE);
    } catch {
      if (!controller.signal.aborted) setSources(previous => ({...previous, backend: {
        ...previous.backend, warning: 'Older inquiries could not be loaded. Your loaded records remain visible; retry loading older inquiries.',
      }}));
    } finally {
      if (!controller.signal.aborted) setIsLoadingOlder(false);
    }
  };

  const currentOwner = previousOwner.current === user?.uid;
  const inquiries = currentOwner ? [...sources.backend.records, ...sources['apps-script'].records] : [];
  const queue = selectQueue(inquiries, filter, search, sort);
  const visibleQueue = queue.slice(0, visibleCount);
  // Keep the detail open even if a successful status change moves it out of this filter.
  const selected = inquiries.find(inquiry => inquiry.key === selectedKey) || null;
  const configuredSources: InquirySource[] = ['backend'];
  const hasFetched = currentOwner && configuredSources.some(source => sources[source].fetchedAt !== null);
  const hasWarnings = currentOwner && configuredSources.some(source => sources[source].warning);
  const isDesk = activeTab === 'inquiries';
  const activeFilterLabel = queueFilters.find(item => item.id === filter)?.label || 'All';

  useEffect(() => {
    if (focusDetail.current && selected) {
      detailHeading.current?.focus({ preventScroll: true });
      if (!window.matchMedia('(min-width: 1280px)').matches) {
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
    setSearchParams({ tab });
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
    <div className="space-y-6 lg:space-y-8">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className={eyebrow}>Workspace / Inquiry Desk</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Inquiries</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-text-secondary">Review loaded records, read the original message, and update their status.</p>
        </div>
        <button onClick={refresh} disabled={isRefreshing || saveState?.pending} className={`${control} shrink-0 self-start sm:self-auto`}>
          <RefreshCw aria-hidden="true" className={`h-4 w-4 ${isRefreshing ? 'animate-spin motion-reduce:animate-none' : ''}`} />
          {isRefreshing ? 'Refreshing...' : 'Refresh inquiries'}
        </button>
      </div>

       <div className={`rounded-xl border px-4 py-3 text-sm leading-relaxed ${hasWarnings ? 'border-border-strong bg-surface' : 'border-border bg-surface'}`}>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {hasWarnings ? <AlertCircle className="h-4 w-4 shrink-0 text-text-primary" aria-hidden="true" /> : <span className="h-2 w-2 shrink-0 rounded-full bg-text-tertiary" aria-hidden="true" />}
            <p role="status" aria-atomic="true" className="min-w-0 flex-1 font-medium text-text-primary">{isRefreshing ? hasFetched ? 'Refreshing inquiries; existing records remain visible.' : 'Loading inquiries from your source…' : (hasWarnings && sources.backend.warning?.includes('SERVICE_UNAVAILABLE')) ? 'Service is temporarily unavailable due to a maintenance hold. Please try again later.' : hasWarnings ? 'Source issue — loaded records may be incomplete or out of date.' : 'Showing records returned by the backend.'}</p>
          </div>
          <details className="mt-2 pl-5 text-xs text-text-secondary">
            <summary className="w-fit cursor-pointer rounded text-text-secondary hover:text-text-primary">Source details</summary>
            {configuredSources.map(source => (
              <p key={source} className="mt-1">
                {sourceLabels[source]}: last successful fetch {sources[source].fetchedAt === null ? 'not yet available' : new Date(sources[source].fetchedAt!).toLocaleString()}.
                {sources[source].warning && <span className="ml-1 font-medium text-text-primary">{sources[source].warning}</span>}
             </p>
           ))}
           <p className="mt-1">The backend returns up to 100 records. Source activity is not a verified receipt time.</p>
         </details>
       </div>

       <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6" role="group" aria-label="Filter by loaded inquiry counts">
         {queueFilters.map(item => (
           <button key={item.id} onClick={() => chooseFilter(item.id)} aria-pressed={filter === item.id} className={`min-h-28 rounded-xl border p-4 text-left transition-colors hover:border-border-strong hover:bg-surface-hover sm:p-5 ${filter === item.id ? 'border-accent bg-surface ring-1 ring-accent' : 'border-border bg-surface'}`}>
             <span className="flex min-h-8 items-start justify-between gap-2 text-xs leading-4 font-medium text-text-secondary"><span>{item.id === 'all' ? 'All loaded' : item.label}</span>{filter === item.id && <Check aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-accent" />}</span>
             <span className="mt-3 block text-3xl font-semibold tabular-nums tracking-tight text-text-primary">{hasFetched ? inquiries.filter(inquiry => matchesFilter(inquiry, item.id)).length : '—'}</span>
           </button>
         ))}
       </div>

       <section aria-label="Inquiry workspace" className="overflow-clip rounded-xl border border-border bg-surface">
         <div className="space-y-4 border-b border-border p-4 sm:p-5">
           <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
             <div className="min-w-0 flex-1">
               <label htmlFor="inquiry-search" className="mb-2 block text-xs font-medium text-text-secondary">Search inquiries</label>
               <div className="relative">
                 <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-text-tertiary" />
                 <input id="inquiry-search" type="search" value={search} onChange={event => { setSearch(event.target.value); setVisibleCount(PAGE_SIZE); }} placeholder="Name, email, company or message" className="min-h-11 w-full rounded-lg border border-border-strong bg-bg py-2 pl-10 pr-3 text-sm text-text-primary placeholder:text-text-tertiary" />
               </div>
             </div>
             <div>
               <label htmlFor="inquiry-sort" className="mb-2 block text-xs font-medium text-text-secondary">Sort by</label>
                 <select id="inquiry-sort" value={sort} onChange={event => { setSort(event.target.value as QueueSort); setVisibleCount(PAGE_SIZE); }} className="min-h-11 w-full rounded-lg border border-border-strong bg-bg px-3 text-sm text-text-primary sm:w-56">
                <option value="priority">Priority first</option>
                <option value="newest">Newest source activity</option>
                <option value="oldest">Oldest source activity</option>
              </select>
            </div>
          </div>
           <details className="text-xs leading-relaxed text-text-secondary">
             <summary className="w-fit cursor-pointer rounded py-1 text-text-secondary hover:text-text-primary">How this queue is ordered</summary>
            <p className="mt-2 max-w-4xl">{queueRules}</p>
            <p className="mt-2">These are deterministic queue rules, not AI evidence or a prediction of conversion. Metric counts use all loaded records, ignore search, and may overlap.</p>
          </details>
          <button className={control} disabled={!queue.length} onClick={() => downloadCsv('nodalx-loaded-inquiries.csv', ['name', 'email', 'company', 'message', 'status', 'intent', 'urgency', 'fit_score', 'last_active'], queue.map(inquiry => ({...inquiry})))}>Export filtered loaded records</button>
        </div>

         <div className={`grid xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] ${!selected && !visibleQueue.length ? 'items-stretch' : 'items-start'}`}>
            <div className="min-w-0">
             <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-4">
               <h2 ref={queueHeading} tabIndex={-1} className="scroll-mt-24 text-sm font-semibold">{activeFilterLabel} inquiries</h2>
               <p role="status" className="text-xs tabular-nums text-text-secondary">{hasFetched ? `${visibleQueue.length} shown / ${queue.length} results` : isRefreshing ? 'Loading records…' : 'Records unavailable'}</p>
            </div>
            {visibleQueue.length ? (
              <ul className="divide-y divide-border">
                {visibleQueue.map(inquiry => {
                  const reasons = priorityReasons(inquiry);
                  return <li key={inquiry.key}>
               <button onClick={event => { selectedButton.current = event.currentTarget; focusDetail.current = true; setSelectedKey(inquiry.key); if (selectedKey === inquiry.key) detailHeading.current?.focus(); }} aria-pressed={selectedKey === inquiry.key} aria-controls="inquiry-detail" className={`group w-full border-l-2 px-5 py-4 text-left transition-colors hover:bg-surface-hover ${selectedKey === inquiry.key ? 'border-accent bg-surface-hover' : 'border-transparent'}`}>
                       <span className="flex items-start justify-between gap-3">
                         <span className="min-w-0">
                           <span className="block truncate text-sm font-semibold text-text-primary sm:text-base">{inquiry.name}</span>
                           <span className="mt-1 block truncate text-xs text-text-secondary">{inquiry.company || inquiry.email || 'No company or email provided'}</span>
                         </span>
                         <ArrowRight aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-text-tertiary group-hover:text-accent" />
                       </span>
                       <span className="mt-3 line-clamp-2 break-words text-sm leading-relaxed text-text-secondary">{inquiry.message || 'Original message not provided by this source.'}</span>
                       <span className="mt-3 flex flex-wrap items-center gap-2 text-xs font-medium">
                         <span className="rounded-md border border-border-strong bg-bg px-2 py-1 text-text-primary">{inquiry.status || 'Status unknown'}</span>
                         {reasons.length > 0 && <span className="rounded-md border border-accent px-2 py-1 text-accent">High priority</span>}
                       </span>
                       <span className="mt-3 block text-xs text-text-secondary">{sourceLabels[inquiry.source]} · Activity: {formatActivity(inquiry.last_active)}</span>
                      </button>
                  </li>;
                })}
              </ul>
            ) : (
              <div className="px-6 py-14 text-center" aria-busy={isRefreshing && !hasFetched}>
                 {isRefreshing && !hasFetched ? <RefreshCw aria-hidden="true" className="mx-auto mb-4 h-7 w-7 animate-spin text-text-tertiary motion-reduce:animate-none" /> : !hasFetched || hasWarnings ? <AlertCircle aria-hidden="true" className="mx-auto mb-4 h-7 w-7 text-text-secondary" /> : <Inbox aria-hidden="true" className="mx-auto mb-4 h-7 w-7 text-text-tertiary" />}
                 <h3 className="text-lg font-semibold">{isRefreshing && !hasFetched ? 'Loading inquiries…' : !hasFetched ? 'Inquiries could not be loaded' : inquiries.length ? 'No matching inquiries' : hasWarnings ? 'No records available from this source' : 'No inquiries returned'}</h3>
                 <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-text-secondary">{isRefreshing && !hasFetched ? 'Waiting for the backend. Counts will appear when records are available.' : !hasFetched || hasWarnings ? 'Check the source details above and retry. This is not a confirmed empty inbox.' : inquiries.length ? 'Try a different filter or search. Other loaded records are still available.' : 'The backend returned no records. Manage your sources in setup if needed.'}</p>
                 <div className="mt-5 flex flex-wrap justify-center gap-2">
                   {(search || filter !== 'all') && <button onClick={() => { setSearch(''); chooseFilter('all'); }} className={control}>Clear search & filters</button>}
                   {!inquiries.length && !isRefreshing && <button onClick={refresh} disabled={isRefreshing} className={control}>Retry refresh</button>}
                   {!inquiries.length && !isRefreshing && <button onClick={() => openTab('connectors')} className={control}>Manage sources <ArrowRight aria-hidden="true" className="h-4 w-4" /></button>}
                 </div>
              </div>
            )}
             {visibleCount < queue.length && <div className="border-t border-border p-4"><button onClick={() => setVisibleCount(count => count + PAGE_SIZE)} className={`${control} w-full`}>Show {Math.min(PAGE_SIZE, queue.length - visibleCount)} more loaded records <span className="text-text-secondary">({queue.length - visibleCount} remaining)</span></button></div>}
             {nextCursor && <div className="space-y-2 border-t border-border p-4"><button onClick={() => void loadOlder()} disabled={isRefreshing || isLoadingOlder || !!saveState?.pending} className={`${control} w-full`}>{isLoadingOlder ? 'Loading older inquiries…' : 'Load older inquiries from server'}</button><p className="text-xs text-text-secondary">Search, filters, and counts apply to loaded inquiries. Older matches may appear after loading another page.</p></div>}
          </div>

             <section id="inquiry-detail" aria-label="Inquiry detail" className={`min-w-0 scroll-mt-24 border-t border-border bg-bg xl:border-l xl:border-t-0 ${selected ? 'xl:sticky xl:top-20 xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto' : 'flex flex-col'}`}>
            {selected ? (
              <div className="space-y-6 p-5 sm:p-6">
                <button onClick={backToQueue} className={control}><ArrowLeft aria-hidden="true" className="h-4 w-4" /> Back to queue</button>
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-text-secondary">{sourceLabels[selected.source]} / Inquiry detail</p>
                  <h2 ref={detailHeading} tabIndex={-1} className="mt-2 scroll-mt-24 break-words text-2xl font-semibold tracking-tight">{selected.name}</h2>
                  <p className="mt-2 break-words text-sm text-text-secondary">{selected.company || 'Company not provided'}</p>
                  <p className="mt-1 select-text break-all text-sm">{selected.email || 'Email not provided'}</p>
                  {selected.phone && <p className="mt-1 select-text break-all text-sm">{selected.phone}</p>}
                  {!queue.some(inquiry => inquiry.key === selected.key) && <p className="mt-3 border-l-2 border-accent pl-3 text-xs text-text-secondary">This inquiry is outside your current search or filter. Its detail stays open until you select another or go back.</p>}
                </div>

                <div>
                  <h3 className={eyebrow}>Original message</h3>
                  <p className="mt-3 whitespace-pre-wrap break-words rounded-lg border border-border bg-surface p-4 text-sm leading-relaxed">{selected.message || 'No original message was returned by this source.'}</p>
                </div>

                <details className="border-y border-border py-4">
                  <summary className="cursor-pointer rounded text-sm font-medium text-text-primary">Why this priority?</summary>
                  <p className="mt-2 text-sm leading-relaxed">{priorityReasons(selected).length ? `${priorityReasons(selected).join('; ')}. Matches the high-priority rule.` : matchesFilter(selected, 'spam') ? 'Spam status excludes this inquiry from high priority and puts it last in priority sort.' : matchesFilter(selected, 'review') ? `Status "${selected.status}" matches Needs review. No high-priority intent or urgency rule matches.` : 'No high-priority or needs-review rule matches. This does not establish whether a reply is needed.'}</p>
                  <p className="mt-2 text-xs leading-relaxed text-text-secondary">Based only on the source fields below, not message analysis. Priority sort uses source activity for ties; fit score is not used.</p>
                </details>

                <dl className="grid grid-cols-1 gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
                  {[['Status', selected.status], ['Intent', selected.intent], ['Urgency', selected.urgency], ['Category', selected.category], ['Service', selected.service], ['Industry', selected.industry], ['Fit score (source value)', selected.fit_score], ['Source activity', formatActivity(selected.last_active)]].map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-xs text-text-secondary">{label}</dt><dd className="mt-1 break-words font-medium">{value || 'Unknown'}</dd></div>)}
                </dl>
                {selected.processing_status && selected.processing_status !== 'unknown' && <p className="text-xs text-text-secondary">AI processing: {selected.processing_status.replaceAll('_', ' ')}</p>}
                {selected.source === 'backend' && ['awaiting_analysis', 'not_configured', 'not_requested', 'failed', 'no_classification'].includes(selected.processing_status) && <button className={control} disabled={!!saveState?.pending || isRefreshing} onClick={async () => {
                  setSaveState({key: selected.key, pending: true});
                  try {await apiRequest(`/api/workspace/inquiries/${encodeURIComponent(selected.id)}/analyze`, {method: 'POST', body: '{}'}); setSaveState({key: selected.key, pending: false, message: 'Analysis queued. Track it in Imports & processing.'}); setRefreshVersion(value => value + 1);} catch (error) {setSaveState({key: selected.key, pending: false, error: error instanceof Error ? error.message : 'Could not start analysis.'});}
                }}>Analyze inquiry · reserve 1 credit</button>}
                <p className="text-xs leading-relaxed text-text-secondary">Missing classifications are unknown, not low priority. Score scale and classification method are not verified by this desk.</p>

                {selected.summary && <div><h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Source-provided summary</h3><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed">{selected.summary}</p></div>}
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Suggested action / {selected.suggested_action ? 'From source' : 'Desk rule'}</h3>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed">{selected.suggested_action || (matchesFilter(selected, 'spam') ? 'Review the original message before deciding whether to respond. This record is marked spam.' : matchesFilter(selected, 'contacted') ? 'Check your email history before following up. Contacted status does not verify delivery or a reply.' : 'Read the original message and confirm the request before drafting a response.')}</p>
                </div>

                <div className="space-y-3 border-t border-border pt-5">
                  <div className="flex flex-wrap gap-2">
                    {selected.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(selected.email) && <a href={`mailto:${encodeURIComponent(selected.email)}?subject=${encodeURIComponent(`Re: Inquiry from ${selected.name}`)}`} className={control}><Mail aria-hidden="true" className="h-4 w-4 text-accent" /> Open email draft</a>}
                    <button onClick={() => copyEmail(selected)} disabled={!selected.email || copyState?.pending} className={control}><Copy aria-hidden="true" className="h-4 w-4" /> {copyState?.key === selected.key && copyState.pending ? 'Copying...' : 'Copy email'}</button>
                  </div>
                  <p className="text-xs leading-relaxed text-text-secondary">Opening your email app does not send a reply or mark this inquiry contacted. A valid email is required to open a draft.</p>
                  {copyState?.key === selected.key && <p role={copyState.error ? 'alert' : 'status'} className={`text-sm leading-relaxed ${copyState.error ? 'border-l-2 border-border-strong pl-3 font-medium' : 'text-text-secondary'}`}>{copyState.error || copyState.message}</p>}
                </div>

                <div className="space-y-3 border-t border-border pt-5">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Update status</h3>
                  <p id="status-help" className="text-xs leading-relaxed text-text-secondary">{selected.source === 'apps-script' ? 'Apps Script records are read-only here. Edit status in the source sheet.' : 'Mark Contacted only after you actually contact the sender.'}</p>
                  <fieldset disabled={selected.source === 'apps-script' || !!saveState?.pending || isRefreshing} aria-describedby="status-help" className="flex flex-wrap gap-2">
                    <legend className="sr-only">Choose a status to save</legend>
                    {['Qualified', 'Contacted', 'Pending', 'Spam', 'Won', 'Lost'].map(status => <button key={status} onClick={() => updateStatus(selected, status)} disabled={normalize(selected.status) === normalize(status)} aria-pressed={normalize(selected.status) === normalize(status)} className={`${control} ${normalize(selected.status) === normalize(status) ? '!border-accent bg-surface-hover disabled:opacity-100' : ''}`}>{normalize(selected.status) === normalize(status) && <Check aria-hidden="true" className="h-4 w-4 text-accent" />}{status}</button>)}
                  </fieldset>
                  {saveState?.key === selected.key && <p role={saveState.error ? 'alert' : 'status'} className={`text-sm leading-relaxed ${saveState.error ? 'border-l-2 border-border-strong pl-3 font-medium' : 'text-text-secondary'}`}>{saveState.pending ? 'Saving status...' : saveState.error || saveState.message}</p>}
                </div>
                {selected.source === 'backend' && <InquiryActivity key={`${selected.id}:${selected.status}`} id={selected.id} />}
              </div>
            ) : (
              <>
                <div className="flex items-center border-b border-border px-5 py-4">
                  <h2 className="text-sm font-semibold">Inquiry detail</h2>
                </div>
                <div className="flex min-h-72 flex-1 flex-col items-center px-6 py-14 text-center">
                  <Inbox aria-hidden="true" className="mb-4 h-7 w-7 shrink-0 text-text-tertiary" />
                  <h3 className="text-lg font-semibold">Select an inquiry</h3>
                  <p className="mt-2 max-w-sm text-sm leading-relaxed text-text-secondary">Select an inquiry to read its original message, inspect the source fields, and choose your next action.</p>
                </div>
              </>
            )}
          </section>
        </div>
      </section>
    </div>
  );

  let content: React.ReactNode = desk;
  if (activeTab === 'overview') content = <WorkspaceOverview onOpenDesk={() => openTab('inquiries')} onOpenImports={() => openTab('connectors')} />;
  if (activeTab === 'connectors') content = <ImportWorkspace onConnections={() => openTab('connections')} />;
  if (activeTab === 'automation') content = <AutomationWorkspace />;
  if (activeTab === 'connections') content = <div className="space-y-8"><PageTitle title="Sources & connections" description="Connect your website or automation platform and import inquiry spreadsheets you control." /><WorkspacePipeline compact /><WorkspaceConnections compact /></div>;
  if (activeTab === 'billing') content = <WorkspaceBilling />;
  if (activeTab === 'settings') content = <WorkspaceSettings />;

  if (showWizard) return <OnboardingWizard userName={user?.displayName || 'there'} onComplete={() => setShowWizard(false)} />;

  return (
    <div style={{ backgroundImage: 'none' }} className="dashboard-shell before:!hidden min-h-screen w-full bg-bg text-text-primary [&_:focus-visible]:outline [&_:focus-visible]:outline-2 [&_:focus-visible]:outline-offset-[-2px] [&_:focus-visible]:outline-accent">
      <a href="#dashboard-content" onClick={event => { event.preventDefault(); mainHeading.current?.focus(); }} className="sr-only z-50 rounded bg-accent p-3 text-[#fff] focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Skip to workspace</a>
       <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col overflow-y-auto border-r border-border bg-bg p-5 md:flex">
        <div className="flex items-center gap-3"><NodalXLogo className="h-9 w-9" /><span className="text-lg font-bold tracking-tight">NodalX</span></div>
        <nav aria-label="Workspace" className="mt-10 space-y-1">
          {tabLabels.map((tab, index) => <React.Fragment key={tab.id}>
            {index === 4 && <p className="px-3 pb-3 pt-6 text-[10px] font-semibold uppercase tracking-[0.2em] text-text-tertiary">Setup & account</p>}
            <button onClick={() => openTab(tab.id)} aria-current={activeTab === tab.id ? 'page' : undefined} className={`flex min-h-11 w-full items-center gap-3 rounded-lg border-l-2 px-3 py-3 text-left text-sm font-medium ${activeTab === tab.id ? 'border-accent bg-surface-hover text-text-primary' : 'border-transparent text-text-secondary hover:bg-surface-hover hover:text-text-primary'}`}><tab.icon aria-hidden="true" className="h-4 w-4 shrink-0" />{tab.label}</button>
          </React.Fragment>)}
        </nav>
        <div className="mt-auto border-t border-border pt-5">
          <div className="mt-6 flex w-full items-center gap-3 rounded-lg p-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-hover text-sm font-semibold">{user?.photoURL ? <img src={user.photoURL} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" /> : (user?.displayName || 'U').charAt(0).toUpperCase()}</div>
            <div className="min-w-0"><p className="truncate text-sm font-semibold">{user?.displayName || 'Your profile'}</p><p className="truncate text-xs capitalize text-text-secondary">{workspaceUsage.loading ? 'Checking plan' : workspaceUsage.data ? `${workspaceUsage.data.plan} · ${workspaceUsage.data.status}` : 'Plan unavailable'}</p></div>
          </div>
        </div>
      </aside>

      <div className="md:pl-64">
         <header className="sticky top-0 z-30 border-b border-border bg-bg">
          <div className="mx-auto flex min-h-[72px] w-full max-w-[1500px] items-center justify-between gap-3 px-4 sm:px-7">
            <button onClick={() => setMobileOpen(open => !open)} aria-expanded={mobileOpen} aria-controls="mobile-workspace-nav" className={`${control} md:hidden`}><Menu aria-hidden="true" className="h-4 w-4" /> {mobileOpen ? 'Close menu' : 'Menu'}</button>
            <p className="hidden min-w-0 truncate text-xs font-medium text-text-secondary md:block">Workspace <span className="px-2 text-text-tertiary">/</span> {isDesk ? 'Inquiry Desk' : tabLabels.find(tab => tab.id === activeTab)?.label}</p>
            <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3"><span className="hidden max-w-48 truncate text-xs text-text-secondary xl:block">{user?.email}</span><button onClick={toggleTheme} className={control} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>{theme === 'dark' ? <Sun aria-hidden="true" className="h-4 w-4" /> : <Moon aria-hidden="true" className="h-4 w-4" />}<span className="sr-only lg:not-sr-only">{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span></button><button onClick={logout} className={control}><LogOut aria-hidden="true" className="h-4 w-4" /><span className="sr-only lg:not-sr-only">Sign out</span></button></div>
          </div>
          {mobileOpen && <nav id="mobile-workspace-nav" aria-label="Mobile workspace" onKeyDown={event => { if (event.key === 'Escape') { setMobileOpen(false); document.querySelector<HTMLButtonElement>('[aria-controls="mobile-workspace-nav"]')?.focus(); } }} className="max-h-[70vh] space-y-1 overflow-y-auto border-t border-border p-4 md:hidden">
            {tabLabels.map(tab => <button key={tab.id} onClick={() => openTab(tab.id)} aria-current={activeTab === tab.id ? 'page' : undefined} className={`flex min-h-11 w-full items-center gap-3 rounded-lg border-l-2 px-3 text-left text-sm ${activeTab === tab.id ? 'border-accent bg-surface-hover text-text-primary' : 'border-transparent text-text-secondary hover:bg-surface-hover hover:text-text-primary'}`}><tab.icon aria-hidden="true" className="h-4 w-4" />{tab.label}</button>)}
          </nav>}
        </header>
        <main id="dashboard-content" ref={mainHeading} tabIndex={-1} className="mx-auto max-w-[1500px] px-4 py-7 sm:px-7 lg:py-10">{content}</main>
      </div>
    </div>
  );
}
