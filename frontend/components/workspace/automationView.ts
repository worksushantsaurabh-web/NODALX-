export type RecipeStatus = 'draft' | 'active' | 'paused';
export type ExceptionState = 'open' | 'acknowledged' | 'resolved';
export type InitialPolicy = 'baseline' | 'backlog';

export interface Recipe {
  id: string;
  name: string;
  tabTitle?: string;
  mode: 'import' | 'analyze';
  status: RecipeStatus;
  enabled: boolean;
  pauseReason: string | null;
  initialPolicy: InitialPolicy | null;
  frequencyMinutes: number;
  rowCap: number;
  dailyCreditCap: number;
  mapping: Record<string, string>;
  sourceIdColumn: string;
  baselineAppliedAt: number | null;
  nextRunAt: number | null;
  lastRunAt: number | null;
  lastSuccessfulRunAt: number | null;
  runCount?: number;
}

export interface ImportException {
  id: string;
  type: string;
  state: ExceptionState;
  detail: string;
  hint: string;
  recipeId: string;
  recipeName: string;
  scope: string;
  recordKey: string | null;
  count: number;
  firstSeenAt: number;
  lastSeenAt: number;
}

const statusLabels: Record<RecipeStatus, string> = {
  draft: 'Not enabled',
  active: 'Checking automatically',
  paused: 'Paused',
};

export function recipeStatusLabel(recipe: Recipe) {
  return statusLabels[recipe.status] || 'Unknown';
}

// A paused recipe has a server-authored reason. Never invent a cause, and
// never imply the schedule is still running.
export function recipeStatusDetail(recipe: Recipe) {
  if (recipe.status === 'active') return `Every ${formatFrequency(recipe.frequencyMinutes)}.`;
  if (recipe.status === 'paused') return recipe.pauseReason || 'Automation is paused until you resume it.';
  return 'Preview and confirm the recipe to start checking this source.';
}

export function formatFrequency(minutes: number) {
  if (!Number.isFinite(minutes) || minutes <= 0) return 'on the configured schedule';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  const hours = minutes / 60;
  if (hours < 24) return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} hour${hours === 1 ? '' : 's'}`;
  const days = hours / 24;
  return `${Number.isInteger(days) ? days : days.toFixed(1)} day${days === 1 ? '' : 's'}`;
}

export function formatNextRun(nextRunAt: number | null, now: number) {
  if (!nextRunAt) return 'No check scheduled';
  if (nextRunAt <= now) return 'Due now';
  const minutes = Math.max(1, Math.round((nextRunAt - now) / 60000));
  if (minutes < 60) return `Next check in ${minutes} minute${minutes === 1 ? '' : 's'}`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Next check in ${hours} hour${hours === 1 ? '' : 's'}`;
  return `Next check in ${Math.round(hours / 24)} day${hours < 48 ? '' : 's'}`;
}

// First-run policy decides whether pre-existing rows are imported or only
// remembered. The choice is irreversible, so the UI must state the outcome.
export function policyExplanation(policy: InitialPolicy) {
  return policy === 'backlog'
    ? 'Import the rows that already exist now, then keep checking for new ones.'
    : 'Remember the rows that already exist without importing them. Only rows added later are imported.';
}

export function policyConsequence(policy: InitialPolicy, eligibleCount: number | null | undefined) {
  if (policy === 'backlog') {
    return `${eligibleCount ?? 0} existing eligible row${eligibleCount === 1 ? '' : 's'} will be imported, up to the per-run cap. Each row uses one analysis credit only if this recipe requests analysis.`;
  }
  return `The ${eligibleCount ?? 0} existing row${eligibleCount === 1 ? '' : 's'} will not be imported and will not use credits. They stay in your source.`;
}

// Only the actions the API actually accepts are offered. There is no retry
// action, so the UI must not imply one exists.
export function exceptionActions(item: ImportException) {
  if (item.state === 'resolved') return [] as Array<'acknowledge' | 'ignore'>;
  if (item.state === 'acknowledged') return ['ignore'] as Array<'acknowledge' | 'ignore'>;
  return ['acknowledge', 'ignore'] as Array<'acknowledge' | 'ignore'>;
}

export function exceptionTitle(item: ImportException) {
  const labels: Record<string, string> = {
    schema_drift: 'Source headings changed',
    source_disconnected: 'Source no longer connected',
    source_too_large: 'Source is too large to check',
    record_edited: 'A source record changed',
    missing_source_id: 'A row has no record ID',
    duplicate_source_id: 'Two rows share a record ID',
    budget_exhausted: 'Daily budget reached',
    run_failed: 'A check did not finish',
  };
  return labels[item.type] || 'Automation needs review';
}

export function exceptionSummary(item: ImportException) {
  const repeats = item.count > 1 ? ` Seen ${item.count} times.` : '';
  const record = item.recordKey ? ` Record ${item.recordKey}.` : '';
  return `${item.detail}${record}${repeats}`;
}

export function mergeExceptionPages(pages: ImportException[][]) {
  const seen = new Set<string>();
  const merged: ImportException[] = [];
  for (const page of pages) {
    for (const item of page) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      merged.push(item);
    }
  }
  return merged;
}

// Count unique open exceptions. The same id can appear on more than one
// fetched page, so the badge must not double count it.
export function openExceptionCount(pages: ImportException[][]) {
  return mergeExceptionPages(pages).filter(item => item.state === 'open').length;
}