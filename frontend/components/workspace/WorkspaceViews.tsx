import { useEffect, useState } from 'react';
import { ArrowRight, RefreshCw } from 'lucide-react';
import { api } from '../../src/services/api';
import { button, input, panel, Notice, PageTitle, Loading, useResource, Usage } from './ui';

interface Report {days: number; total: number; statuses: Record<string, number>; processing: Record<string, number>; sources: Record<string, number>; overdue: number; generatedAt: number}

export function WorkspaceOverview({onOpenDesk, onOpenImports, reports = false}: {onOpenDesk: () => void; onOpenImports: () => void; reports?: boolean}) {
  const [days, setDays] = useState(30);
  const {data, error, loading, refresh} = useResource<Report>(`/api/workspace/overview?days=${days}`);
  return <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-4"><PageTitle title={reports ? 'Inquiry reports' : 'Workspace overview'} description="A factual view of incoming work, recorded outcomes, and processing health." /><div className="flex flex-wrap items-end gap-2"><label className="text-xs text-text-secondary">Created within<select className={`${input} mt-1`} value={days} onChange={event => setDays(Number(event.target.value))}><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option></select></label><button className={button} onClick={refresh} disabled={loading} aria-label="Refresh overview"><RefreshCw className="h-4 w-4" aria-hidden="true" /></button></div></div>
    {error && <Notice error>{error} {data && 'Previously loaded figures remain visible.'}</Notice>}
    {loading && !data && <Loading />}
    {data && <>
      <p className="text-xs text-text-secondary">Server totals for inquiries created in the selected period. Updated {new Date(data.generatedAt).toLocaleString()}.</p>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{[['Inquiries received', data.total], ['Pending review', data.statuses.Pending || 0], ['Processing failed', data.processing.failed || 0], ['Overdue follow-ups', data.overdue]].map(([label, value]) => <div key={label} className={panel}><p className="min-h-8 text-xs leading-4 text-text-secondary">{label}</p><p className="mt-3 text-3xl font-semibold tabular-nums">{value}</p>{label === 'Overdue follow-ups' && <p className="mt-2 text-xs text-text-secondary">All open inquiries, regardless of creation date.</p>}</div>)}</div>
      <div className="flex flex-wrap gap-3"><button className={button} onClick={onOpenDesk}>Open inquiry desk <ArrowRight className="h-4 w-4" aria-hidden="true" /></button><button className={button} onClick={onOpenImports}>Review processing jobs</button></div>
      <div className="grid gap-5 xl:grid-cols-2">
        <section className={panel}><h2 className="font-semibold">Recorded outcomes</h2><p className="mt-2 text-xs leading-relaxed text-text-secondary">Statuses are recorded by your team. Contacted does not confirm an email was sent or delivered.</p><dl className="mt-5 space-y-3">{Object.entries(data.statuses).map(([name, count]) => <div key={name} className="flex items-center justify-between gap-3 border-b border-border pb-2 text-sm"><dt>{name}</dt><dd className="font-medium tabular-nums">{count}</dd></div>)}</dl></section>
        <section className={panel}><h2 className="font-semibold">Inquiry sources</h2><p className="mt-2 text-xs text-text-secondary">Other includes older records without a source label.</p><dl className="mt-5 space-y-4">{Object.entries(data.sources).map(([name, count]) => <div key={name}><div className="flex justify-between gap-3 text-sm"><dt className="capitalize">{name.replaceAll('_', ' ')}</dt><dd className="tabular-nums">{count}</dd></div><div className="mt-2 h-1.5 rounded bg-surface-hover" aria-hidden="true"><div className="h-full rounded bg-accent" style={{width: `${data.total ? count / data.total * 100 : 0}%`}} /></div></div>)}</dl></section>
      </div>
      <section className={panel}><h2 className="font-semibold">Processing health</h2><div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">{Object.entries(data.processing).map(([name, count]) => <div key={name}><p className="text-xs capitalize text-text-secondary">{name.replaceAll('_', ' ')}</p><p className="mt-2 text-xl font-semibold tabular-nums">{count}</p></div>)}</div><p className="mt-4 text-xs text-text-secondary">Awaiting analysis means the inquiry is saved but has not been processed. Older records may have other processing states.</p></section>
      {!data.total && <Notice>No inquiries were created in this period. Website intake requires a verified source binding. Imports and self-service connections are deferred during the pilot.</Notice>}
    </>}
  </div>;
}

interface Plan {id: string; label: string; inquiries: number; credits: number; batchRows: number; sheets: number; checkoutEnabled: boolean; price: {amount: number; currency: string} | null}

export function WorkspaceBilling() {
  const usage = useResource<Usage>('/api/workspace/usage', 15000);
  const catalog = useResource<{plans: Plan[]}>('/api/workspace/plans');
  const invoices = useResource<{invoices: Array<{id: string; amount: number; currency: string; status: string; url?: string}>}>('/api/workspace/invoices');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [message, setMessage] = useState('');
  const checkout = async (plan: string) => {
    setBusy(plan); setError('');
    try {
      const result = await api.post<{url: string}>('/api/workspace/checkout', {plan});
      const target = new URL(result.url);
      if (target.protocol !== 'https:' || !['rzp.io', 'razorpay.com'].includes(target.hostname)) throw Error('The checkout link is invalid.');
      window.location.assign(target.href);
    } catch (problem) { setError(problem instanceof Error ? problem.message : 'Checkout failed.'); } finally { setBusy(''); }
  };
  const cancel = async () => {
    setBusy('cancel'); setError('');
    try { await api.post('/api/workspace/cancel-subscription', {}); setConfirmCancel(false); setMessage('Cancellation requested for the end of this billing cycle.'); usage.refresh(); } catch (problem) { setError(problem instanceof Error ? problem.message : 'Cancellation failed.'); } finally { setBusy(''); }
  };
  return <div className="space-y-6"><PageTitle title="Usage & billing" description="Understand what your plan includes and how much processing is available." />
    {(usage.error || catalog.error || error) && <Notice error>{error || usage.error || catalog.error}</Notice>}{message && <Notice>{message}</Notice>}
    {usage.loading && !usage.data && <Loading />}
    {usage.data && <section className={panel}>
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold capitalize">{usage.data.plan} · {usage.data.status.replaceAll('_', ' ')}</h2><p className="text-xs text-text-secondary">Period ends {new Date(usage.data.periodEnd).toLocaleDateString()}</p></div>
      {usage.data.legacy && <p className="mt-3 text-sm text-text-secondary">Existing access is on a 30-day transition allowance. Choose a subscription to continue afterward.</p>}
      <div className="mt-5 grid gap-5 sm:grid-cols-2">{[['Inquiries accepted', usage.data.inquiries, usage.data.limits.inquiries], ['Analysis credits consumed', usage.data.used, usage.data.limits.credits]].map(([label, used, limit]) => <div key={label}><div className="flex min-h-10 items-start justify-between gap-3 text-sm"><span className="min-w-0">{label}</span><span className="shrink-0 tabular-nums">{used} / {limit}</span></div><progress className="mt-3 h-2 w-full accent-accent" value={Number(used)} max={Number(limit)} aria-label={String(label)} /></div>)}</div>
      <p className="mt-4 text-sm text-text-secondary">{usage.data.reserved} credits reserved · {usage.data.remaining} available · {usage.data.activeJobs} processing jobs</p>
      <p className="mt-2 text-xs leading-relaxed text-text-secondary">One credit covers one successfully completed inquiry classification. Failed rows and skipped duplicates do not consume credits. Automatic retries do not charge twice. Existing records remain readable when a plan expires.</p>
      {usage.data.cancelAtPeriodEnd && <p role="status" className="mt-4 text-sm">Your subscription will end at the close of this billing period.</p>}
      {usage.data.status === 'active' && !usage.data.cancelAtPeriodEnd && <div className="mt-5">{confirmCancel ? <div className="space-y-3"><p className="text-sm">End your subscription after the current billing cycle?</p><div className="flex flex-wrap gap-2"><button className={button} disabled={!!busy} onClick={cancel}>Confirm cancellation</button><button className={button} onClick={() => setConfirmCancel(false)}>Keep subscription</button></div></div> : <button className={button} onClick={() => setConfirmCancel(true)}>Cancel at period end</button>}</div>}
    </section>}
    <div className="grid gap-4 xl:grid-cols-3">{catalog.data?.plans.map(plan => <section key={plan.id} className={`${panel} flex flex-col`}><h2 className="text-lg font-semibold">{plan.label}</h2><p className="mt-2 min-h-10 text-sm text-text-secondary">{plan.id === 'trial' ? '14 days, once per workspace' : plan.price ? `${new Intl.NumberFormat(undefined, {style: 'currency', currency: plan.price.currency}).format(plan.price.amount / 100)} / month` : 'Pricing not configured'}</p><ul className="my-5 flex-1 space-y-2 text-sm"><li>{plan.inquiries.toLocaleString()} inquiries {plan.id === 'trial' ? 'total' : 'per month'}</li><li>{plan.credits.toLocaleString()} analysis credits</li><li>{plan.batchRows} rows per job</li><li>{plan.sheets} connected spreadsheet{plan.sheets > 1 ? 's' : ''}</li><li>1 workspace user</li></ul>{plan.id !== 'trial' && <button className={`${button} w-full`} disabled={!plan.checkoutEnabled || !!busy || usage.data?.status === 'active'} onClick={() => checkout(plan.id)}>{busy === plan.id ? 'Opening checkout…' : !plan.checkoutEnabled ? 'Billing not enabled' : usage.data?.status === 'active' ? 'Subscription active' : `Choose ${plan.label}`}</button>}</section>)}</div>
    <section className={panel}><h2 className="font-semibold">Invoices</h2>{invoices.error ? <Notice error>{invoices.error}</Notice> : invoices.loading ? <Loading /> : !invoices.data?.invoices.length ? <p className="mt-3 text-sm text-text-secondary">No invoices yet.</p> : <ul className="mt-4 divide-y divide-border">{invoices.data.invoices.map(invoice => <li key={invoice.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"><span>{invoice.status} · {new Intl.NumberFormat(undefined, {style: 'currency', currency: invoice.currency}).format(invoice.amount / 100)}</span>{invoice.url && /^https:\/\/(rzp\.io|razorpay\.com)\//.test(invoice.url) && <a className={button} href={invoice.url} target="_blank" rel="noreferrer">View invoice</a>}</li>)}</ul>}</section>
  </div>;
}

export function WorkspaceSettings() {
  const resource = useResource<{criteria: string}>('/api/workspace/settings');
  const [criteria, setCriteria] = useState(''); const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const [error, setError] = useState('');
  useEffect(() => { if (resource.data) setCriteria(resource.data.criteria); }, [resource.data]);
  return <div className="space-y-6"><PageTitle title="Qualification settings" description="Describe which inquiries fit your services. These instructions are sent to the configured processing workflow." />{resource.error && <Notice error>{resource.error}</Notice>}<form className={`${panel} space-y-4`} onSubmit={async event => {event.preventDefault(); setBusy(true); setError(''); setMessage(''); try {await api.put('/api/workspace/settings', {criteria}); setMessage('Qualification criteria saved. They apply to future processing requests.');} catch (problem) {setError(problem instanceof Error ? problem.message : 'Save failed.');} finally {setBusy(false);}}}><label htmlFor="qualification-criteria" className="block text-sm font-medium">Services, ideal customers, and qualification criteria</label><textarea id="qualification-criteria" className={`${input} min-h-48`} maxLength={4000} value={criteria} onChange={event => setCriteria(event.target.value)} placeholder="Describe services offered, suitable project sizes, locations, and requests that need manual review." /><p className="text-xs text-text-secondary">{criteria.length} / 4,000 characters. The processing workflow must support the criteria field for these instructions to affect its output.</p><button className={button} disabled={busy || resource.loading || !!resource.error}>{busy ? 'Saving…' : 'Save criteria'}</button>{message && <Notice>{message}</Notice>}{error && <Notice error>{error}</Notice>}</form></div>;
}

export function InquiryActivity({id}: {id: string}) {
  const resource = useResource<{note: string; followUpAt: number | null; events: Array<{id: string; at: number; previousStatus: string; changes: {status?: string; note?: string; followUpAt?: number | null}}> }>(`/api/workspace/inquiries/${encodeURIComponent(id)}/activity`);
  const [note, setNote] = useState(''); const [date, setDate] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [message, setMessage] = useState('');
  useEffect(() => { if (resource.data) {setNote(resource.data.note); const time = resource.data.followUpAt; setDate(time ? new Date(time - new Date(time).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');}}, [resource.data]);
  return <section className="space-y-4 border-t border-border pt-5"><h3 className="font-semibold">Notes & follow-up</h3>{resource.error && <Notice error>{resource.error}</Notice>}<form className="space-y-3" onSubmit={async event => {event.preventDefault(); setBusy(true); setError(''); setMessage(''); try {await api.patch(`/api/workspace/inquiries/${encodeURIComponent(id)}`, {note, followUpAt: date ? new Date(date).getTime() : null}); setMessage('Notes and follow-up saved.'); resource.refresh();} catch (problem) {setError(problem instanceof Error ? problem.message : 'Save failed.');} finally {setBusy(false);}}}><label className="block text-xs text-text-secondary" htmlFor="inquiry-note">Internal note</label><textarea id="inquiry-note" className={`${input} min-h-24`} value={note} maxLength={4000} onChange={event => setNote(event.target.value)} /><label className="block text-xs text-text-secondary" htmlFor="inquiry-followup">Follow-up date and time (your local timezone)</label><input id="inquiry-followup" type="datetime-local" className={input} value={date} onChange={event => setDate(event.target.value)} /><button className={button} disabled={busy || resource.loading || !!resource.error}>{busy ? 'Saving…' : 'Save follow-up'}</button></form>{error && <Notice error>{error}</Notice>}{message && <Notice>{message}</Notice>}<h4 className="text-sm font-medium">Recent activity</h4><p className="text-xs text-text-secondary">Activity is recorded from this release onward.</p>{!resource.data?.events.length ? <p className="text-sm text-text-secondary">No recorded changes yet.</p> : <ol className="space-y-3">{resource.data.events.map(event => <li key={event.id} className="border-l-2 border-border-strong pl-3 text-sm"><p>{event.changes.status ? `${event.previousStatus} → ${event.changes.status}` : 'Notes or follow-up updated'}</p><time className="text-xs text-text-secondary">{new Date(event.at).toLocaleString()}</time></li>)}</ol>}</section>;
}
