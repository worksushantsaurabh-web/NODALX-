export interface AnalyticsSink {
  readonly name: string;
  track(eventName: string, params?: Record<string, string | number | boolean>): void;
  setCollectionEnabled(allowed: boolean): void;
}

let installedSink: AnalyticsSink | null = null;

/**
 * Install an external analytics tracker. None is installed by default: the
 * Firebase Analytics sink was retired during the Supabase migration and no
 * replacement has been approved. Do not install one silently.
 */
export function installAnalyticsSink(sink: AnalyticsSink | null): void {
  installedSink = sink;
}

export const getAnalyticsSink = (): AnalyticsSink | null => installedSink;

/**
 * Optional analytics is "enabled" only when the deployment opts in AND a
 * tracker is actually installed, so the consent UI never asks permission for
 * tracking that does not exist.
 */
export const analyticsEnabled = (env: Record<string, unknown> | undefined = import.meta.env) =>
  installedSink !== null && env?.VITE_ANALYTICS_ENABLED === 'true';
export const analyticsConsentKey = 'nodalx_analytics_consent';

export function readAnalyticsConsent(storage?: Pick<Storage, 'getItem'>): boolean | null {
  try {
    const value = (storage || window.localStorage).getItem(analyticsConsentKey);
    return value === 'granted' ? true : value === 'denied' ? false : null;
  } catch {
    return null;
  }
}

export function writeAnalyticsConsent(allowed: boolean, storage?: Pick<Storage, 'setItem'>): boolean {
  try {
    (storage || window.localStorage).setItem(analyticsConsentKey, allowed ? 'granted' : 'denied');
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('nodalx-analytics-consent'));
    return true;
  } catch {
    return false;
  }
}
