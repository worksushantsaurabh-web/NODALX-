export const analyticsEnabled = () => import.meta.env?.VITE_ANALYTICS_ENABLED === 'true';
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
