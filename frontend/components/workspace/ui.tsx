import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { apiRequest } from '../../src/services/api';
import { useAuth } from '../../contexts/AuthContext';

export const button = 'inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-lg border border-border-strong bg-surface px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:shrink-0';
export const input = 'min-h-11 w-full min-w-0 rounded-lg border border-border-strong bg-bg px-3 py-2 text-sm text-text-primary';
export const panel = 'min-w-0 rounded-xl border border-border bg-surface p-4 sm:p-6';

export function useResource<T>(path: string, interval = 0) {
  const {user} = useAuth();
  const scope = `${user?.uid || ''}:${path}`;
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  const previousScope = useRef(scope);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      try {
        const value = await apiRequest<T>(path, {signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)])});
        if (!controller.signal.aborted) { setData(value); setError(''); }
      } catch (problem) {
        if (!controller.signal.aborted) setError(problem instanceof Error ? problem.message : 'Could not load this view.');
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          if (interval) timer = setTimeout(load, interval);
        }
      }
    };
    setLoading(true);
    if (previousScope.current !== scope) { setData(null); setError(''); previousScope.current = scope; }
    void load();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [path, scope, interval, version]);
  const currentScope = previousScope.current === scope;
  return {data: currentScope ? data : null, error: currentScope ? error : '', loading: !currentScope || loading, refresh: () => setVersion(value => value + 1)};
}

export function Notice({children, error = false}: {children: React.ReactNode; error?: boolean}) {
  return <div role={error ? 'alert' : 'status'} className="flex min-w-0 items-start gap-3 rounded-lg border border-border-strong bg-bg p-4 text-sm leading-relaxed text-text-secondary">{error && <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />}<div className="min-w-0 break-words">{children}</div></div>;
}

export function PageTitle({title, description}: {title: string; description: string}) {
  return <div className="min-w-0"><h1 className="text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">{title}</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-secondary">{description}</p></div>;
}

export function Loading() {
  return <p role="status" className="flex items-center gap-2 py-6 text-sm text-text-secondary"><RefreshCw aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" />Loading workspace data…</p>;
}

export interface Usage {
  plan: string; status: string; active: boolean; periodStart: number; periodEnd: number;
  inquiries: number; intakeReserved: number; used: number; reserved: number; remaining: number;
  activeJobs: number; legacy: boolean; cancelAtPeriodEnd: boolean; workflowConfigured: boolean;
  limits: {inquiries: number; credits: number; batchRows: number; concurrentJobs: number; sheets: number};
}

export function safeCsv(value: unknown) {
  let text = String(value ?? '');
  if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function downloadCsv(name: string, fields: string[], rows: Record<string, unknown>[]) {
  const text = [fields.map(safeCsv).join(','), ...rows.map(row => fields.map(field => safeCsv(row[field])).join(','))].join('\r\n');
  const url = URL.createObjectURL(new Blob([text], {type: 'text/csv;charset=utf-8'}));
  const link = document.createElement('a');
  link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
