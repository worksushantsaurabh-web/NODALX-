import { button, Loading, Notice, PageTitle, panel, useResource, Usage } from './ui';

export function PilotDeferred({title, description, onOpenDesk}: {title: string; description: string; onOpenDesk: () => void}) {
  return <section className="space-y-6"><PageTitle title={title} description={description} /><Notice>This service is deferred, not connected. Existing inquiries remain available in the inquiry desk.</Notice><button className={button} onClick={onOpenDesk}>Open inquiry desk</button></section>;
}

export function PilotJobs() {
  const resource = useResource<{jobs: Array<{id: string; status: string}>}>('/api/workspace/jobs', 15000);
  return <section className="space-y-6">
    <PageTitle title="Processing jobs" description="The latest 50 analysis jobs for this workspace. CSV uploads, spreadsheet imports and bulk processing are deferred." />
    <button className={button} disabled={resource.loading} onClick={resource.refresh}>Refresh jobs</button>
    {resource.error && <Notice error>{resource.error} {resource.data && 'Previously loaded jobs remain visible.'}</Notice>}
    {resource.loading && !resource.data && <Loading />}
    {resource.data && (resource.data.jobs.length ? <ul className="space-y-3">{resource.data.jobs.map(job => <li key={job.id} className={`${panel} flex flex-wrap items-center justify-between gap-3`}><span className="min-w-0 break-all text-sm">Job {job.id}</span><span className="text-sm text-text-secondary">{job.status.replaceAll('_', ' ')}</span></li>)}</ul> : <Notice>No processing jobs were found. Saved inquiries do not require AI processing to be reviewed.</Notice>)}
  </section>;
}

export function PilotUsage() {
  const resource = useResource<Usage>('/api/workspace/usage', 15000);
  return <section className="space-y-6">
    <PageTitle title="Workspace usage" description="Current server-recorded usage. Paid checkout, invoices and subscription changes are not available in this pilot." />
    <button className={button} disabled={resource.loading} onClick={resource.refresh}>Refresh usage</button>
    {resource.error && <Notice error>{resource.error} {resource.data && 'Previously loaded usage remains visible.'}</Notice>}
    {resource.loading && !resource.data && <Loading />}
    {resource.data && <div className={panel}><p className="mb-5 text-sm capitalize">{resource.data.plan} · {resource.data.status}</p><dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">{[['Inquiries this period', resource.data.inquiries], ['Analysis credits used', resource.data.used], ['Reserved credits', resource.data.reserved], ['Remaining credits', resource.data.remaining]].map(([label, value]) => <div key={label}><dt className="text-sm text-text-secondary">{label}</dt><dd className="mt-1 text-xl font-semibold tabular-nums">{value}</dd></div>)}</dl><p className="mt-5 text-sm text-text-secondary">{resource.data.workflowConfigured ? 'Processing is configured; plan limits still apply.' : 'Analysis is not configured. Available credits do not enable processing by themselves.'}</p></div>}
  </section>;
}
