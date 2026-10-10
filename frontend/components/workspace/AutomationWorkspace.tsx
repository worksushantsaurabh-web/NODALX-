import { useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { api } from '../../src/services/api';
import { button, input, panel, Notice, PageTitle, Loading, useResource } from './ui';
import {
  exceptionActions,
  exceptionSummary,
  exceptionTitle,
  formatNextRun,
  mergeExceptionPages,
  openExceptionCount,
  policyConsequence,
  policyExplanation,
  recipeStatusDetail,
  recipeStatusLabel,
  type ExceptionState,
  type ImportException,
  type InitialPolicy,
  type Recipe,
} from './automationView';

interface RecipeList {recipes: Recipe[]}
interface ExceptionPage {exceptions: ImportException[]; nextCursor: string | null}

interface PreviewSummary {
  headers: string[];
  scanned: number;
  eligible: number;
  duplicates: number;
  skipped: number;
  identity: {ready: boolean; missing: number; duplicate: number};
  consequences?: {eligibleNow: number; perRunCap: number; firstRunCreditEstimate?: number};
}

function RecipeCard({recipe, onChanged}: {recipe: Recipe; onChanged: () => void}) {
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState<PreviewSummary | null>(null);
  const [policy, setPolicy] = useState<InitialPolicy>('baseline');
  const [pauseReason, setPauseReason] = useState('');
  const [showPause, setShowPause] = useState(false);
  const now = Date.now();

  // A finished preview grant is short-lived, so never imply it is still valid.
  useEffect(() => { setPreview(null); setMessage(''); setError(''); }, [recipe.id]);

  const act = async (key: string, run: () => Promise<string>) => {
    setBusy(key); setError(''); setMessage('');
    try { setMessage(await run()); onChanged(); } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'That action did not complete.');
    } finally { setBusy(''); }
  };

  return <li className="min-w-0 space-y-4 rounded-lg border border-border p-4">
    <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h3 className="break-words text-sm font-medium">{recipe.name}</h3>
        <p className="mt-1 text-xs text-text-secondary">{recipe.tabTitle || 'Spreadsheet tab'} · {recipe.mode === 'analyze' ? 'Import & analyze' : 'Import only'}</p>
      </div>
      <p className="shrink-0 text-xs font-medium text-text-secondary">{recipeStatusLabel(recipe)}</p>
    </div>

    <dl className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
      {[
        ['Schedule', recipeStatusDetail(recipe)],
        ['Next check', recipe.enabled ? formatNextRun(recipe.nextRunAt, now) : 'Not scheduled'],
        ['Rows per run', String(recipe.rowCap)],
        ['Daily analysis budget', recipe.mode === 'analyze' ? `${recipe.dailyCreditCap} credit${recipe.dailyCreditCap === 1 ? '' : 's'}` : 'Not used'],
      ].map(([label, value]) => <div key={label} className="min-w-0">
        <dt className="text-xs text-text-secondary">{label}</dt>
        <dd className="mt-1 break-words">{value}</dd>
      </div>)}
    </dl>

    <p className="text-xs leading-relaxed text-text-secondary">
      Identified by the “{recipe.sourceIdColumn}” column. {recipe.baselineAppliedAt
        ? 'Existing rows were recorded without importing them.'
        : 'The first confirmed check decides what happens to rows that already exist.'}
      {' '}Saved inquiries are never overwritten when a source row changes.
    </p>

    <div className="flex flex-wrap gap-2">
      <button className={button} disabled={!!busy} onClick={() => act('preview', async () => {
        const result = await api.post<PreviewSummary>(`/api/workspace/recipes/${encodeURIComponent(recipe.id)}/preview`, {});
        setPreview(result); setPolicy('baseline');
        return `Previewed ${result.scanned} rows. Confirm below to start checking.`;
      })}>{busy === 'preview' ? 'Checking source…' : 'Preview source'}</button>

      {recipe.enabled && <button className={button} disabled={!!busy} onClick={() => act('run', async () => {
        const result = await api.post<{status: string}>(`/api/workspace/recipes/${encodeURIComponent(recipe.id)}/run-now`, {});
        return `Check finished: ${String(result.status || 'completed').replaceAll('_', ' ')}.`;
      })}>{busy === 'run' ? 'Checking…' : 'Check now'}</button>}

      {recipe.enabled && <button className={button} disabled={!!busy} onClick={() => setShowPause(open => !open)}>{showPause ? 'Keep checking' : 'Pause'}</button>}
    </div>

    {showPause && <div className="space-y-3 rounded-lg border border-border bg-bg p-3">
      <label className="block text-sm" htmlFor={`pause-${recipe.id}`}>Why are you pausing? (recorded for your team)</label>
      <input id={`pause-${recipe.id}`} className={input} maxLength={200} value={pauseReason} onChange={event => setPauseReason(event.target.value)} placeholder="Source is being restructured" />
      <div className="flex flex-wrap gap-2">
        <button className={button} disabled={!!busy} onClick={() => act('pause', async () => {
          await api.post(`/api/workspace/recipes/${encodeURIComponent(recipe.id)}/pause`, {reason: pauseReason.trim() || undefined});
          setShowPause(false); setPauseReason('');
          return 'Automation paused. Existing inquiries are unchanged.';
        })}>{busy === 'pause' ? 'Pausing…' : 'Pause automation'}</button>
        <button className={button} onClick={() => setShowPause(false)}>Cancel</button>
      </div>
      <p className="text-xs text-text-secondary">Pausing stops future checks only. Nothing already imported is removed and no credits are refunded.</p>
    </div>}

    {preview && <div className="space-y-4 rounded-lg border border-border-strong bg-bg p-4">
      <div>
        <h4 className="text-sm font-medium">Confirm what the first check will do</h4>
        <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">{[
          ['Scanned', preview.scanned], ['Eligible', preview.eligible],
          ['Duplicates', preview.duplicates], ['Missing message', preview.skipped],
        ].map(([label, value]) => <div key={label as string}>
          <p className="min-h-8 text-xs text-text-secondary">{label}</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{value as number}</p>
        </div>)}</div>
      </div>

      {!preview.identity.ready && <Notice error>
        {preview.identity.missing + preview.identity.duplicate} rows have a missing or duplicate value in the “{recipe.sourceIdColumn}” column. Automation cannot identify those rows safely. Fix the source, then preview again.
      </Notice>}

      {preview.identity.ready && <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Rows that already exist</legend>
        <div className="space-y-2">
          {(['baseline', 'backlog'] as const).map(option => <label key={option} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${policy === option ? 'border-accent' : 'border-border'}`}>
            <input type="radio" name={`policy-${recipe.id}`} className="mt-1" checked={policy === option} onChange={() => setPolicy(option)} />
            <span className="min-w-0">
              <span className="block text-sm font-medium">{option === 'baseline' ? 'Only rows added from now on' : 'The existing rows too'}</span>
              <span className="mt-1 block text-xs leading-relaxed text-text-secondary">{policyExplanation(option)}</span>
            </span>
          </label>)}
        </div>
        <p className="text-xs leading-relaxed text-text-secondary">
          {policyConsequence(policy, preview.eligible)} This choice cannot be changed later; pause and create a new recipe for a different policy.
        </p>
        {recipe.mode === 'analyze' && <Notice>
          Each imported row requests analysis and uses one credit when the classification succeeds. This recipe is capped at {recipe.dailyCreditCap} credit{recipe.dailyCreditCap === 1 ? '' : 's'} per day.
        </Notice>}
      </fieldset>}

      <div className="flex flex-wrap gap-2">
        <button className={button} disabled={!!busy || !preview.identity.ready || recipe.mode === 'analyze' && recipe.dailyCreditCap < 1} onClick={() => act('enable', async () => {
          await api.post(`/api/workspace/recipes/${encodeURIComponent(recipe.id)}/enable`, {initialPolicy: policy});
          setPreview(null);
          return 'Automation is on. New source rows will be imported on the schedule above.';
        })}>{busy === 'enable' ? 'Starting…' : 'Confirm and start checking'}</button>
        <button className={button} onClick={() => setPreview(null)}>Cancel</button>
      </div>
      <p className="text-xs text-text-secondary">The server rechecks the source, your plan and your limits before enabling. Nothing is imported until a check runs.</p>
    </div>}

    {error && <Notice error>{error}</Notice>}
    {message && <Notice>{message}</Notice>}
  </li>;
}

function ExceptionInbox() {
  const [state, setState] = useState<ExceptionState>('open');
  const [pages, setPages] = useState<ImportException[][]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async (next?: string, append = false) => {
    setLoading(true); setError('');
    try {
      const query = new URLSearchParams({state});
      if (next) query.set('cursor', next);
      const result = await api.get<ExceptionPage>(`/api/workspace/exceptions?${query.toString()}`);
      setPages(previous => append ? [...previous, result.exceptions] : [result.exceptions]);
      setCursor(result.nextCursor);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Could not load the exception inbox.');
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, [state]);
  const items = useMemo(() => mergeExceptionPages(pages), [pages]);
  const openCount = openExceptionCount(pages);

  const act = async (id: string, action: 'acknowledge' | 'ignore') => {
    setBusy(`${id}:${action}`); setError('');
    try {
      await api.post(`/api/workspace/exceptions/${encodeURIComponent(id)}/action`, {action});
      await load();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'That action did not complete.');
    } finally { setBusy(''); }
  };

  return <section className={`${panel} space-y-4`} aria-label="Automation exceptions">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <h2 className="font-semibold">Exceptions</h2>
        <p className="mt-1 text-xs text-text-secondary">
          {openCount} open · checks that need a decision stop without importing or charging.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs text-text-secondary">Show<select className={`${input} mt-1`} value={state} onChange={event => setState(event.target.value as ExceptionState)}>
          <option value="open">Open</option>
          <option value="acknowledged">Acknowledged</option>
          <option value="resolved">Ignored</option>
        </select></label>
        <button className={button} onClick={() => void load()} disabled={loading} aria-label="Refresh exceptions"><RefreshCw aria-hidden="true" className="h-4 w-4" /></button>
      </div>
    </div>

    {error && <Notice error>{error}</Notice>}
    {loading && !items.length ? <Loading /> : !items.length ? <p className="text-sm text-text-secondary">
      {state === 'open' ? 'No open exceptions. Checks are running normally.' : `No ${state === 'resolved' ? 'ignored' : state} exceptions.`}
    </p> : <ul className="divide-y divide-border">{items.map(item => <li key={item.id} className="min-w-0 space-y-3 py-4">
      <div className="min-w-0">
        <p className="break-words text-sm font-medium">{exceptionTitle(item)}</p>
        <p className="mt-1 text-xs text-text-secondary">{item.recipeName} · first seen {new Date(item.firstSeenAt).toLocaleString()} · last seen {new Date(item.lastSeenAt).toLocaleString()}</p>
      </div>
      <p className="break-words text-sm text-text-secondary">{exceptionSummary(item)}</p>
      <p className="break-words text-xs leading-relaxed text-text-secondary">{item.hint}</p>
      {!!exceptionActions(item).length && <div className="flex flex-wrap gap-2">
        {exceptionActions(item).map(action => <button key={action} className={button} disabled={!!busy} onClick={() => void act(item.id, action)}>
          {busy === `${item.id}:${action}` ? 'Working…' : action === 'acknowledge' ? 'Acknowledge' : 'Ignore'}
        </button>)}
      </div>}
    </li>)}</ul>}

    {cursor && <button className={button} disabled={loading} onClick={() => void load(cursor, true)}>{loading ? 'Loading…' : 'Load more'}</button>}
    <p className="text-xs leading-relaxed text-text-secondary">
      Acknowledging keeps an exception on record and stops counting it. Ignoring stops it being raised again while the same condition persists. Neither action imports, overwrites or deletes an inquiry.
    </p>
  </section>;
}

export default function AutomationWorkspace() {
  const recipes = useResource<RecipeList>('/api/workspace/recipes');
  const usage = useResource<{active: boolean; workflowConfigured: boolean; remaining: number}>(`/api/workspace/usage`);
  const list = recipes.data?.recipes || [];

  return <div className="space-y-6">
    <PageTitle title="Automation" description="Let NodalX check a connected spreadsheet on a schedule and import genuinely new rows. You approve the first check, and you can pause at any time." />

    {(recipes.error || usage.error) && <Notice error>{recipes.error || usage.error}</Notice>}
    {usage.data && !usage.data.active && <Notice error>
      Your plan is not active, so automation cannot be enabled. Existing inquiries and results remain available.
    </Notice>}

    <section className={`${panel} space-y-4`} aria-label="Import recipes">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-semibold">Import recipes</h2>
          <p className="mt-1 text-xs text-text-secondary">
            Each recipe names one connected tab, how to read it, how often to check, and how much it may spend.
          </p>
        </div>
        <button className={button} onClick={recipes.refresh} disabled={recipes.loading} aria-label="Refresh recipes"><RefreshCw aria-hidden="true" className="h-4 w-4" /></button>
      </div>

      {recipes.loading && !recipes.data ? <Loading /> : !list.length ? <p className="text-sm text-text-secondary">
        No recipes yet. Create one from Imports & processing once a spreadsheet is connected and verified.
      </p> : <ul className="space-y-4">{list.map(recipe => <RecipeCard key={recipe.id} recipe={recipe} onChanged={recipes.refresh} />)}</ul>}

      <p className="text-xs leading-relaxed text-text-secondary">
        Recipes are created while mapping an import. Automation is off until you preview a source and confirm the first check.
      </p>
    </section>

    <ExceptionInbox />
  </div>;
}
