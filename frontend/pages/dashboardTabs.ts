export type DashboardTab = 'overview' | 'inquiries' | 'connectors' | 'automation' | 'connections' | 'billing' | 'settings';

const tabs: DashboardTab[] = ['overview', 'inquiries', 'connectors', 'automation', 'connections', 'billing', 'settings'];

export function resolveDashboardTab(requested: string | null, fallback = 'overview'): DashboardTab {
  const canonical = (value: string | null): DashboardTab | null => {
    if (value === 'reports') return 'overview';
    if (value === 'integration') return 'connections';
    return tabs.includes(value as DashboardTab) ? value as DashboardTab : null;
  };
  return canonical(requested) || canonical(fallback) || 'inquiries';
}
