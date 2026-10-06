import React, { useRef, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { api } from '../../src/services/api';
import { getAccessToken } from '../../lib/session';
import { button, input, panel, Notice, PageTitle, Loading, useResource, Usage, downloadCsv } from './ui';
import {batchLimit, canSaveRecipeDraft, importReadiness, matchesJob, type ImportMode} from './importReadiness';

interface Connection {id: string; title: string; spreadsheetId: string; verifiedAt: number; tabs: Array<{id: number; title: string}>}
interface Connections {connections: Connection[]; serviceAccountEmail: string}
interface Preview {title: string; headers: string[]; scanned: number; hasMore: boolean; snapshot?: string; eligible?: number; skipped?: number; duplicates?: number; sample?: Record<string, unknown>[]; quality?: {invalidEmails: number; missingContacts: number}; issues?: Array<{row: number; reason: string; action: string}>; issueCount?: number}
interface Job {id: string; title: string; mode?: ImportMode; status: string; total: number; processed: number; succeeded: number; failed: number; skipped: number; createdAt: number; exportStatus: string; sheetId?: string; error?: string; rows?: Array<Record<string, unknown> & {id: string; row: number; status: string; error?: string}>}
const fields = ['name', 'email', 'company', 'message'];

export function WorkspaceConnections({compact = false}: {compact?: boolean}) {
  const resource = useResource<Connections>('/api/workspace/sheets');
  const [spreadsheetId, setSpreadsheetId] = useState('');
  const [challenge, setChallenge] = useState<{id: string; token: string; serviceAccountEmail: string} | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [message, setMessage] = useState('');
  const connect = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      if (!challenge) setChallenge(await api.post('/api/workspace/sheets/challenge', {spreadsheetId}));
      else { await api.post('/api/workspace/sheets/connect', {challengeId: challenge.id}); setChallenge(null); setSpreadsheetId(''); setMessage('Read access and control of the spreadsheet verified. Choose a tab in Imports & processing.'); resource.refresh(); }
    } catch (problem) {setError(problem instanceof Error ? problem.message : 'Connection failed.');} finally {setBusy(false);}
  };
  return <div className="space-y-6">{!compact && <PageTitle title="Connections" description="Connect an inquiry spreadsheet you control. Analysis results are saved in NodalX before any optional export." />}
    {(resource.error || error) && <Notice error>{error || resource.error}</Notice>}{message && <Notice>{message}</Notice>}
    <form onSubmit={connect} className={`${panel} space-y-4`}>
      <h2 className="font-semibold">Google Sheets</h2><label htmlFor="sheet-url" className="block text-sm">Spreadsheet URL or ID</label><input id="sheet-url" required className={input} value={spreadsheetId} disabled={!!challenge || busy} onChange={event => setSpreadsheetId(event.target.value)} placeholder="https://docs.google.com/spreadsheets/d/…" />
      {challenge && <div className="space-y-4 text-sm leading-relaxed"><p>Share the spreadsheet with this service account as <strong>Viewer</strong> for imports. Optional results export requires <strong>Editor</strong>.</p><p className="select-all break-all rounded-lg border border-border bg-bg p-3 font-mono text-xs">{challenge.serviceAccountEmail}</p><p>To confirm that you control this spreadsheet, create a tab called <strong>NodalX Verify</strong> and paste this code into cell <strong>A1</strong>. The code expires in 15 minutes.</p><p className="select-all break-all rounded-lg border border-border bg-bg p-3 font-mono">{challenge.token}</p><p className="text-xs text-text-secondary">You can remove the verification tab after the connection succeeds. A successful import check does not confirm export permission.</p></div>}
      <div className="flex flex-wrap gap-2"><button className={button} disabled={busy || !spreadsheetId.trim()}>{busy ? 'Checking…' : challenge ? 'Verify connection' : 'Get verification code'}</button>{challenge && <button type="button" className={button} disabled={busy} onClick={() => setChallenge(null)}>Start again</button>}</div>
    </form>
    <section className={panel}><h2 className="font-semibold">Connected spreadsheets</h2>{resource.loading && !resource.data ? <Loading /> : !resource.data?.connections.length ? <p className="mt-4 text-sm text-text-secondary">No verified spreadsheet connections yet. Previously configured sheets must complete the ownership check.</p> : <ul className="mt-4 divide-y divide-border">{resource.data.connections.map(connection => <li key={connection.id} className="flex min-w-0 flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><h3 className="break-words text-sm font-medium">{connection.title}</h3><p className="mt-1 text-xs text-text-secondary">Read access verified {new Date(connection.verifiedAt).toLocaleString()}</p></div><button className={`${button} shrink-0`} disabled={busy} onClick={async () => {setBusy(true); setError(''); try {await api.delete(`/api/workspace/sheets/${connection.id}`); resource.refresh();} catch (problem) {setError(problem instanceof Error ? problem.message : 'Disconnect failed.');} finally {setBusy(false);}}}>Disconnect</button></li>)}</ul>}</section>
  </div>;
}

function JobDetails({id, onChanged}: {id: string; onChanged: () => void}) {
  const resource = useResource<Job>(`/api/workspace/jobs/${encodeURIComponent(id)}`, 5000);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [message, setMessage] = useState('');
  const job = resource.data;
  const [failedOnly, setFailedOnly] = useState(false);
  const finished = job && ['completed', 'partial', 'failed', 'cancelled'].includes(job.status);
  return <section className={`${panel} space-y-4`} aria-label="Selected job details">
    <h2 className="font-semibold">Job details</h2>{resource.error && <Notice error>{resource.error}</Notice>}{resource.loading && !job && <Loading />}
    {job && <><h3 className="break-words text-sm font-medium">{job.title}</h3><p className="text-xs text-text-secondary">{job.mode === 'import' ? 'Import only · no analysis requested' : 'Inquiry analysis'} · source row numbers retained</p><p role="status" className="text-sm capitalize">{job.status.replaceAll('_', ' ')} · {job.processed} / {job.total} rows</p><progress className="h-2 w-full accent-accent" max={job.total || 1} value={job.processed} aria-label="Rows processed" /><div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-text-secondary"><span>{job.succeeded} completed</span><span>{job.failed} failed</span><span>{job.skipped} skipped</span></div>{job.status === 'queued' && <p className="text-xs text-text-secondary">Waiting for the processing worker. Progress updates every five seconds; no completion time is guaranteed.</p>}{job.error && <Notice error>{job.error}</Notice>}
      <div className="flex flex-wrap gap-2"><button className={button} disabled={!job.rows?.length} onClick={() => downloadCsv(`nodalx-${job.id.slice(0, 8)}.csv`, ['row', ...fields, 'intent', 'urgency', 'fit_score', 'summary', 'suggested_action', 'status', 'error'], job.rows || [])}><Download className="h-4 w-4" aria-hidden="true" />Download results</button>{finished && job.failed > 0 && <button className={button} disabled={busy} onClick={async () => {setBusy(true); setError(''); try {await api.post(`/api/workspace/jobs/${id}/retry`, {}); resource.refresh(); onChanged();} catch (problem) {setError(problem instanceof Error ? problem.message : 'Retry failed.');} finally {setBusy(false);}}}>Retry {job.failed} failed rows</button>}{finished && job.sheetId && <button className={button} disabled={busy} onClick={async () => {setBusy(true); setError(''); setMessage(''); try {const result = await api.post<{title: string}>(`/api/workspace/jobs/${id}/export`, {}); setMessage(`Results exported to the separate tab “${result.title}”.`); resource.refresh();} catch (problem) {setError(problem instanceof Error ? problem.message : 'Export failed.');} finally {setBusy(false);}}}>{busy ? 'Working…' : 'Export to results tab'}</button>}</div>
      <p className="text-xs leading-relaxed text-text-secondary">{job.mode === 'import' ? 'Imported inquiries remain available for manual review or optional analysis later.' : 'Retry reserves credits only for failed rows. Successful rows are retained.'} Sheet export never modifies your original inquiry tab and does not consume analysis credits.</p>
      {!!job.failed && <div className="flex flex-wrap items-center gap-3"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={failedOnly} onChange={event => setFailedOnly(event.target.checked)} />Show failed rows only</label><button className={button} onClick={() => downloadCsv(`nodalx-failed-${job.id.slice(0, 8)}.csv`, ['row', ...fields, 'status', 'error'], job.rows?.filter(row => row.status === 'failed') || [])}>Download failed rows</button></div>}
      {job.exportStatus === 'failed' && <Notice error>Sheet export failed. Results are saved here; check Editor permission and retry the export.</Notice>}
      <div className="space-y-3">{job.rows?.filter(row => !failedOnly || !job.failed || row.status === 'failed').map(row => <details key={row.id} className="min-w-0 rounded-lg border border-border p-3"><summary className="cursor-pointer break-words text-sm"><span className="font-medium">Row {row.row}</span> · {String(row.name || row.email || 'Unnamed inquiry')} · {row.status}</summary><dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">{['message', 'intent', 'urgency', 'fit_score', 'summary', 'suggested_action', 'error'].map(field => <div key={field} className="min-w-0"><dt className="text-xs capitalize text-text-secondary">{field.replaceAll('_', ' ')}</dt><dd className="mt-1 whitespace-pre-wrap break-words">{String(row[field] ?? '') || 'Not provided'}</dd></div>)}</dl></details>)}</div>
    </>}{error && <Notice error>{error}</Notice>}{message && <Notice>{message}</Notice>}
  </section>;
}

// Saving a recipe is the only way to reach scheduled automation. It is created
// disabled on purpose: the owner still has to preview and confirm the first
// check in Automation before anything is imported on a schedule.
function SaveRecipeForm({connectionId, tabId, mapping, headers, mode, onSaved, message, setMessage}: {
  connectionId: string; tabId: string; mapping: Record<string, string>; headers: string[];
  mode: ImportMode; onSaved: () => void; message: string; setMessage: (value: string) => void;
}) {
  const used = new Set(Object.values(mapping).filter(Boolean));
  const candidates = headers.filter(header => !used.has(header));
  const [name, setName] = useState('');
  const [sourceIdColumn, setSourceIdColumn] = useState('');
  const [frequency, setFrequency] = useState('1440');
  const [rowCap, setRowCap] = useState('25');
  const [budget, setBudget] = useState(mode === 'analyze' ? '10' : '0');
  const [timezone, setTimezone] = useState(() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; }
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    setBusy(true); setError(''); setMessage('');
    try {
      await api.post('/api/workspace/recipes', {
        name: name.trim(),
        connectionId,
        tabId: Number(tabId),
        mapping,
        sourceIdColumn,
        mode,
        frequencyMinutes: Number(frequency),
        rowCap: Number(rowCap),
        dailyCreditCap: Number(budget),
        budgetTimezone: timezone,
      });
      onSaved();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Could not save the recipe.');
    } finally { setBusy(false); }
  };

  const ready = canSaveRecipeDraft({
    name,
    sourceIdColumn,
    frequencyMinutes: Number(frequency),
    rowCap: Number(rowCap),
    dailyCreditCap: Number(budget),
    mode,
  });

  return <details className="min-w-0 rounded-lg border border-border p-4">
    <summary className="cursor-pointer text-sm font-medium">Save this mapping for scheduled automation</summary>
    <div className="mt-4 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm">Recipe name<input className={`${input} mt-2`} maxLength={80} value={name} onChange={event => setName(event.target.value)} placeholder="Website leads" /></label>
        <label className="text-sm">Record ID column<select className={`${input} mt-2`} value={sourceIdColumn} onChange={event => setSourceIdColumn(event.target.value)}>
          <option value="">Choose a column</option>
          {candidates.map(header => <option key={header} value={header}>{header}</option>)}
        </select></label>
      </div>
      <p className="text-xs leading-relaxed text-text-secondary">
        Choose the column that holds a stable ID for each record. NodalX uses it to tell genuinely new rows from rows it has already seen, so it must be unique and must not change when you edit a record.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <label className="text-sm">Check every (minutes)<input className={`${input} mt-2`} type="number" min={5} value={frequency} onChange={event => setFrequency(event.target.value)} /></label>
        <label className="text-sm">Rows per check<input className={`${input} mt-2`} type="number" min={1} value={rowCap} onChange={event => setRowCap(event.target.value)} /></label>
        <label className="text-sm">Daily analysis budget<input className={`${input} mt-2`} type="number" min={mode === 'analyze' ? 1 : 0} value={budget} onChange={event => setBudget(event.target.value)} /></label>
        <label className="text-sm">Budget day timezone<input className={`${input} mt-2`} maxLength={64} value={timezone} onChange={event => setTimezone(event.target.value)} /></label>
      </div>
      <div className="flex flex-wrap gap-2">
        <button className={button} disabled={busy || !ready} onClick={save}>{busy ? 'Saving…' : 'Save recipe'}</button>
      </div>
      <p className="text-xs leading-relaxed text-text-secondary">
        Saving does not import anything and does not start a schedule. The recipe is created switched off; open Automation to preview the source and decide what happens to rows that already exist.
        {mode === 'import' && ' This recipe imports without analysis, so the daily analysis budget stays at zero and no credits are used.'}
      </p>
      {message && <Notice>{message}</Notice>}
      {error && <Notice error>{error}</Notice>}
    </div>
  </details>;
}

export default function ImportWorkspace({onConnections}: {onConnections: () => void}) {
  const connections = useResource<Connections>('/api/workspace/sheets');
  const usage = useResource<Usage>('/api/workspace/usage', 15000);
  const history = useResource<{jobs: Job[]}>('/api/workspace/jobs', 5000);
  const [source, setSource] = useState('sheet'); const [connectionId, setConnectionId] = useState(''); const [tabId, setTabId] = useState('');
  const [uploadId, setUploadId] = useState(''); const [title, setTitle] = useState(''); const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({}); const [preview, setPreview] = useState<Preview | null>(null);
  const [size, setSize] = useState(1); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [selectedJob, setSelectedJob] = useState('');
  const [mode, setMode] = useState<ImportMode>('import');
  const [jobQuery, setJobQuery] = useState(''); const [jobStatus, setJobStatus] = useState('all');
  const [recipeMessage, setRecipeMessage] = useState('');
  const maxSize = batchLimit(preview?.eligible || 0, usage.data, mode);
  const readiness = importReadiness(preview?.eligible || 0, usage.data, mode);
  const filteredJobs = history.data?.jobs.filter(job => matchesJob(job, jobQuery, jobStatus)) || [];
  const requestId = useRef(''); const fileInput = useRef<HTMLInputElement>(null);
  const selectedConnection = connections.data?.connections.find(connection => connection.id === connectionId);
  const sourceBody = source === 'file' ? {uploadId} : {connectionId, tabId: Number(tabId)};
  const clearPreview = () => {setPreview(null); requestId.current = '';};
  const reset = () => {clearPreview(); setHeaders([]); setMapping({}); setError(''); setRecipeMessage('');};
  const defaultMapping = (columns: string[]) => Object.fromEntries(fields.map(field => [field, columns.find(column => column.toLowerCase().trim() === field) || '']));
  const inspect = async () => {
    setBusy(true); setError(''); clearPreview();
    try {const result = await api.post<Preview>('/api/workspace/preview', sourceBody); setHeaders(result.headers); setMapping(defaultMapping(result.headers)); setTitle(result.title);} catch (problem) {setError(problem instanceof Error ? problem.message : 'Could not inspect the source.');} finally {setBusy(false);}
  };
  const review = async () => {
    setBusy(true); setError(''); clearPreview();
    try {const result = await api.post<Preview>('/api/workspace/preview', {...sourceBody, mapping}); setPreview(result); requestId.current = crypto.randomUUID(); setSize(Math.max(1, batchLimit(result.eligible || 0, usage.data, mode)));} catch (problem) {setError(problem instanceof Error ? problem.message : 'Preview failed.');} finally {setBusy(false);}
  };
  const upload = async (file?: File) => {
    if (!file) return;
    reset(); setUploadId(''); setBusy(true);
    try {
      if (file.size > 4 * 1024 * 1024) throw Error('Choose a file smaller than 4 MB.');
      const token = await getAccessToken();
      if (!token) throw Error('Sign in to upload a file.');
      const form = new FormData(); form.append('file', file);
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/workspace/uploads`, {method: 'POST', headers: {Authorization: `Bearer ${token}`}, body: form, signal: AbortSignal.timeout(30000)});
      const result = await response.json(); if (!response.ok) throw Error(result.error || 'Upload failed.');
      setUploadId(result.uploadId); setTitle(result.title); setHeaders(result.headers); setMapping(defaultMapping(result.headers));
    } catch (problem) {setError(problem instanceof Error ? problem.message : 'Upload failed.');} finally {setBusy(false); if (fileInput.current) fileInput.current.value = '';}
  };
  const start = async () => {
    setBusy(true); setError('');
    try {const job = await api.post<Job>('/api/workspace/jobs', {...sourceBody, mapping, snapshot: preview?.snapshot, size, mode, requestId: requestId.current}); setSelectedJob(job.id); clearPreview(); history.refresh(); usage.refresh();} catch (problem) {setError(problem instanceof Error ? problem.message : 'Could not start this job.');} finally {setBusy(false);}
  };
  return <div className="space-y-6"><PageTitle title="Imports & processing" description="Review inquiry data before importing. Save it for manual follow-up or request optional analysis, with clear limits and row-level results." />
    {(usage.error || error) && <Notice error>{error || usage.error}</Notice>}
    {usage.data && <Notice>{usage.data.remaining} analysis credits available · up to {usage.data.limits.batchRows} rows per job.{!usage.data.workflowConfigured && ' Analysis is not configured yet.'}{!usage.data.active && ' Your plan is expired; existing results remain available.'}</Notice>}
    <section className={`${panel} space-y-4`}><h2 className="font-semibold">Processing service</h2><div className="grid gap-3 sm:grid-cols-2">{([['import', 'Import only', 'Save original inquiries for manual review. Uses inquiry allowance, not analysis credits.'], ['analyze', 'Import & analyze', 'Request classification and suggested next actions. One credit per successful classification.']] as const).map(([value, label, description]) => <button key={value} type="button" disabled={busy} aria-pressed={mode === value} className={`${button} !items-start !justify-start flex-col !p-4 text-left ${mode === value ? '!border-accent' : ''}`} onClick={() => {setMode(value); requestId.current = crypto.randomUUID(); setSize(Math.max(1, batchLimit(preview?.eligible || 0, usage.data, value)));}}><span>{label}</span><span className="text-xs font-normal leading-relaxed text-text-secondary">{description}</span></button>)}</div><p className="text-xs leading-relaxed text-text-secondary">Currently supports inquiry records only. Invoices, inventory, support tickets and survey data require separate schemas and are not supported by this importer.</p></section>
    <section className={`${panel} space-y-5`}><h2 className="font-semibold">1. Choose a source</h2><div role="group" aria-label="Import source" className="flex flex-wrap gap-2">{[['sheet', 'Google Sheets'], ['file', 'Upload file']].map(([value, label]) => <button key={value} disabled={busy} className={`${button} ${source === value ? '!border-accent' : ''}`} aria-pressed={source === value} onClick={() => {setSource(value); reset(); setUploadId('');}}>{label}</button>)}</div>
      {source === 'sheet' ? <div className="space-y-4">{connections.error && <Notice error>{connections.error}</Notice>}<div className="grid gap-4 lg:grid-cols-2"><label className="text-sm">Spreadsheet<select className={`${input} mt-2`} disabled={busy} value={connectionId} onChange={event => {setConnectionId(event.target.value); setTabId(''); reset();}}><option value="">Choose a spreadsheet</option>{connections.data?.connections.map(connection => <option key={connection.id} value={connection.id}>{connection.title}</option>)}</select></label><label className="text-sm">Tab<select className={`${input} mt-2`} disabled={!connectionId || busy} value={tabId} onChange={event => {setTabId(event.target.value); reset();}}><option value="">Choose a tab</option>{selectedConnection?.tabs.filter(tab => tab.title !== 'NodalX Verify' && !tab.title.startsWith('NodalX ')).map(tab => <option key={tab.id} value={tab.id}>{tab.title}</option>)}</select></label></div><div className="flex flex-wrap gap-2"><button className={button} disabled={!connectionId || tabId === '' || busy} onClick={inspect}>{busy ? 'Working…' : 'Read column headings'}</button><button className={button} onClick={onConnections}>Manage connections</button></div><p className="text-xs text-text-secondary">Preview scans up to 1,000 data rows and the first 100 columns. For larger sheets, split data into smaller tabs.</p></div> : <div className="space-y-3"><label htmlFor="inquiry-file" className="block text-sm">CSV, TSV, or Excel · up to 4 MB and 10,000 rows</label><input id="inquiry-file" ref={fileInput} className={`${input} max-w-full file:mr-3 file:rounded file:border-0 file:bg-surface-hover file:p-2 file:text-text-primary`} type="file" accept=".csv,.tsv,.xlsx,.xls" disabled={busy} onChange={event => void upload(event.target.files?.[0])} /><p className="text-xs text-text-secondary">Excel imports use the first worksheet. Headers must be in the first row.</p></div>}
    </section>
    {!!headers.length && <section className={`${panel} space-y-5`}><h2 className="font-semibold">2. Map your columns</h2><p className="break-words text-sm text-text-secondary">{title}</p><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{fields.map(field => <label key={field} className="text-sm capitalize">{field}{field === 'message' ? ' (required)' : ''}<select className={`${input} mt-2`} value={mapping[field] || ''} disabled={busy} onChange={event => {setMapping(previous => ({...previous, [field]: event.target.value})); clearPreview();}}><option value="">{field === 'message' ? 'Select a column' : 'Not provided'}</option>{headers.map(header => <option key={header} value={header}>{header}</option>)}</select></label>)}</div><button className={button} disabled={!mapping.message || busy} onClick={review}>{busy ? 'Working…' : 'Preview eligible rows'}</button></section>}
    {preview?.snapshot && <section className={`${panel} space-y-5`}>
      <h2 className="font-semibold">3. Review & start</h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">{[['Scanned', preview.scanned], ['Eligible', preview.eligible], ['Duplicates', preview.duplicates], ['Missing message', preview.skipped]].map(([label, value]) => <div key={label}><p className="min-h-8 text-xs text-text-secondary">{label}</p><p className="mt-1 text-xl font-semibold tabular-nums">{value}</p></div>)}</div>
      {preview.hasMore && <Notice>More rows exist beyond this preview. Only the scanned rows are included in these counts.</Notice>}
      <div className="space-y-3"><h3 className="text-sm font-medium">Data quality</h3><p className="text-sm text-text-secondary">{preview.quality?.invalidEmails || 0} email-format warnings · {preview.quality?.missingContacts || 0} unique source rows without email. These warnings do not block import. Email format checks do not verify deliverability.</p><p className="text-xs leading-relaxed text-text-secondary">Duplicate checks compare all four mapped fields after trimming and lowercasing email. They do not merge people with the same email but different messages or overwrite existing records.</p>
        {!!preview.issues?.length && <details className="rounded-lg border border-border p-3"><summary className="cursor-pointer text-sm">Review {preview.issueCount} source issues</summary><button className={`${button} my-3`} onClick={() => downloadCsv('nodalx-source-issues.csv', ['row', 'reason', 'action'], preview.issues || [])}>Download visible issues</button><ul className="space-y-3">{preview.issues.map((issue, index) => <li key={index} className="text-sm"><p className="font-medium">Row {issue.row} · {issue.reason.replaceAll('_', ' ')}</p><p className="mt-1 break-words text-xs leading-relaxed text-text-secondary">{issue.action}</p></li>)}</ul><p className="mt-3 text-xs text-text-secondary">Showing up to 100 issues. Fix the source and preview again; no source data is modified.</p></details>}
      </div>
      <div className="space-y-3">{preview.sample?.map((row, index) => <div key={index} className="min-w-0 rounded-lg border border-border bg-bg p-3 text-sm"><p className="break-words font-medium">Row {String(row.row)} · {String(row.name || row.email || 'Unnamed inquiry')}</p><p className="mt-1 line-clamp-3 break-words text-text-secondary">{String(row.message)}</p></div>)}</div>
      <div><h3 className="text-sm font-medium">Readiness checklist</h3><ul className="mt-3 grid gap-3 sm:grid-cols-2">{readiness.map(check => <li key={check.label} className="min-w-0 rounded-lg border border-border bg-bg p-3"><p className="text-sm font-medium">{check.ready ? 'Ready' : 'Action needed'} · {check.label}</p><p className="mt-1 break-words text-xs text-text-secondary">{check.detail}</p></li>)}</ul></div>
      <div className="flex flex-wrap items-end gap-3"><label className="text-sm">Rows to import<input className={`${input} mt-2 max-w-40`} type="number" min={1} max={maxSize || 1} value={size} disabled={busy || !maxSize} onChange={event => {setSize(Number(event.target.value)); requestId.current = crypto.randomUUID();}} /></label><button className={button} disabled={busy || !!usage.error || !readiness.every(check => check.ready) || !Number.isInteger(size) || size < 1 || size > maxSize} onClick={start}>{busy ? 'Starting…' : mode === 'import' ? `Import ${size} row${size === 1 ? '' : 's'} · no credits` : `Reserve ${size} credit${size === 1 ? '' : 's'} & start`}</button></div>
      <p className="text-xs leading-relaxed text-text-secondary">Only the first selected eligible rows are submitted. Remaining rows stay in your source. {mode === 'import' ? 'Import-only uses your inquiry allowance and a processing slot, with no workflow call or analysis charge.' : 'Final credit usage includes successful classifications only.'} The server rechecks source changes, ownership and plan limits before starting.</p>
      {source === 'sheet' && <SaveRecipeForm
        connectionId={connectionId}
        tabId={tabId}
        mapping={mapping}
        headers={headers}
        mode={mode}
        onSaved={() => setRecipeMessage('Recipe saved. Automation stays off until you preview and confirm it in Automation.')}
        message={recipeMessage}
        setMessage={setRecipeMessage}
      />}
    </section>}
    <section className={`${panel} space-y-4`}>
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">Recent jobs</h2><button className={button} onClick={history.refresh} aria-label="Refresh jobs"><RefreshCw aria-hidden="true" className="h-4 w-4" /></button></div>
      <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Search source title<input className={`${input} mt-2`} type="search" value={jobQuery} onChange={event => setJobQuery(event.target.value)} /></label><label className="text-sm">Job status<select className={`${input} mt-2`} value={jobStatus} onChange={event => setJobStatus(event.target.value)}>{['all', 'preparing', 'preparing_retry', 'queued', 'running', 'completed', 'partial', 'failed', 'cancelled'].map(status => <option key={status} value={status}>{status === 'all' ? 'All statuses' : status.replaceAll('_', ' ')}</option>)}</select></label></div>
      {history.error && <Notice error>{history.error}</Notice>}
      {history.loading && !history.data ? <Loading /> : !filteredJobs.length ? <p className="text-sm text-text-secondary">{history.error ? 'Job history could not be loaded. Try refreshing.' : history.data?.jobs.length ? 'No recent jobs match these filters.' : 'No import or analysis jobs yet.'}</p> : <ul className="divide-y divide-border">{filteredJobs.map(job => <li key={job.id}><button aria-pressed={selectedJob === job.id} className={`flex w-full min-w-0 flex-col gap-2 rounded-lg p-3 text-left hover:bg-surface-hover sm:flex-row sm:items-center sm:justify-between ${selectedJob === job.id ? 'bg-surface-hover' : ''}`} onClick={() => setSelectedJob(job.id)}><span className="min-w-0"><span className="block break-words text-sm font-medium">{job.title}</span><span className="text-xs text-text-secondary">{job.mode === 'import' ? 'Import only' : 'Analysis'} · {new Date(job.createdAt).toLocaleString()}</span></span><span className="shrink-0 text-xs capitalize text-text-secondary">{job.status.replaceAll('_', ' ')} · {job.processed}/{job.total}</span></button></li>)}</ul>}
      <p className="text-xs text-text-secondary">Search and filters apply to the latest 30 jobs only.</p>
    </section>
    {selectedJob && <JobDetails key={selectedJob} id={selectedJob} onChanged={() => {history.refresh(); usage.refresh();}} />}
  </div>;
}
