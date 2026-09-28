export type InquirySource = 'backend' | 'apps-script';
export type QueueFilter = 'all' | 'review' | 'priority' | 'contacted' | 'spam';
export type QueueSort = 'priority' | 'newest' | 'oldest';

export interface Inquiry {
  key: string;
  id: string;
  source: InquirySource;
  name: string;
  email: string;
  company: string;
  phone: string;
  industry: string;
  service: string;
  message: string;
  status: string;
  intent: string;
  urgency: string;
  fit_score: string;
  category: string;
  summary: string;
  suggested_action: string;
  processing_status: string;
  last_active: string;
}

export const queueFilters: Array<{ id: QueueFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'review', label: 'Needs review' },
  { id: 'priority', label: 'High priority' },
  { id: 'contacted', label: 'Contacted' },
  { id: 'spam', label: 'Spam' },
];

export const queueRules = 'Labels are trimmed and lowercased, then matched exactly. Needs review: new, pending, review, or needs review. Contacted: contacted only. Spam: spam only. High priority: intent is high or purchase, OR urgency is high; spam status is excluded. Priority sort puts high priority first, then other needs-review records, then other records, then spam. Ties use newest source activity, then source and ID. Missing or invalid activity dates sort last within each group. Fit scores do not affect rank. Unknown statuses appear in All (and High priority if their signals match).';

export function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export function activityTime(value: string): number | null {
  if (!value.trim()) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

export function priorityReasons(inquiry: Inquiry): string[] {
  if (normalize(inquiry.status) === 'spam') return [];
  const reasons: string[] = [];
  if (['high', 'purchase'].includes(normalize(inquiry.intent))) reasons.push(`Intent is ${normalize(inquiry.intent)}`);
  if (normalize(inquiry.urgency) === 'high') reasons.push('Urgency is high');
  return reasons;
}

export function matchesFilter(inquiry: Inquiry, filter: QueueFilter): boolean {
  const status = normalize(inquiry.status);
  switch (filter) {
    case 'review': return ['new', 'pending', 'review', 'needs review'].includes(status);
    case 'priority': return priorityReasons(inquiry).length > 0;
    case 'contacted': return status === 'contacted';
    case 'spam': return status === 'spam';
    default: return true;
  }
}

export function selectQueue(inquiries: Inquiry[], filter: QueueFilter, search: string, sort: QueueSort): Inquiry[] {
  const query = normalize(search);
  const rank = (inquiry: Inquiry) => matchesFilter(inquiry, 'spam') ? 3 : matchesFilter(inquiry, 'priority') ? 0 : matchesFilter(inquiry, 'review') ? 1 : 2;
  return inquiries.filter(inquiry => matchesFilter(inquiry, filter) &&
    [inquiry.name, inquiry.email, inquiry.company, inquiry.message].some(value => normalize(value).includes(query)))
    .sort((a, b) => {
      if (sort === 'priority' && rank(a) !== rank(b)) return rank(a) - rank(b);
      const aTime = activityTime(a.last_active);
      const bTime = activityTime(b.last_active);
      if (aTime === null && bTime !== null) return 1;
      if (bTime === null && aTime !== null) return -1;
      if (aTime !== null && bTime !== null && aTime !== bTime) return sort === 'oldest' ? aTime - bTime : bTime - aTime;
      return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
    });
}

export function parseInquiries(payload: unknown, source: InquirySource): { records: Inquiry[]; skipped: number } {
  if (!Array.isArray(payload)) throw new Error('The source did not return an inquiry list.');
  const text = (value: unknown) => typeof value === 'string' ? value : typeof value === 'number' && Number.isFinite(value) ? String(value) : '';
  const ids = payload.map(row => row && typeof row === 'object' ? text(row.id).trim() : '');
  const counts = new Map<string, number>();
  ids.forEach(id => counts.set(id, (counts.get(id) || 0) + 1));
  const records: Inquiry[] = [];
  payload.forEach((row, index) => {
    const id = ids[index];
    // Without an unambiguous source ID, selection and mutation cannot be safe.
    if (!id || counts.get(id) !== 1) return;
    records.push({
      key: `${source}:${id}`, id, source,
      name: text(row.name).trim() || 'Unnamed inquiry',
      email: text(row.email).trim(), company: text(row.company), message: text(row.message),
      phone: text(row.phone), industry: text(row.industry), service: text(row.service),
      status: text(row.status).trim(), intent: text(row.intent).trim(), urgency: text(row.urgency).trim(),
      fit_score: text(row.fit_score).trim(), category: text(row.category).trim(),
      summary: text(row.summary), suggested_action: text(row.suggested_action),
      processing_status: text(row.processing_status),
      last_active: text(row.last_active).trim(),
    });
  });
  return { records, skipped: payload.length - records.length };
}

export interface SourceSnapshot {
  records: Inquiry[];
  fetchedAt: number | null;
  warning: string | null;
}

export function settleSource(previous: SourceSnapshot, result: PromiseSettledResult<ReturnType<typeof parseInquiries>>, now: number): SourceSnapshot {
  if (result.status === 'rejected') {
    return { ...previous, warning: 'Fetch failed. Previously loaded records, if any, are retained; this source is not fresh.' };
  }
  if (result.value.skipped && !result.value.records.length) {
    return { ...previous, warning: 'No usable source IDs were returned. Previously loaded records, if any, are retained; this source is not fresh.' };
  }
  return {
    records: result.value.records,
    fetchedAt: now,
    warning: result.value.skipped ? `${result.value.skipped} records omitted because their source IDs were missing or duplicated.` : null,
  };
}
