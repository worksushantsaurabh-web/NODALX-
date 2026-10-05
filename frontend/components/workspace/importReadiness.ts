export type ImportMode = 'import' | 'analyze';

interface ImportUsage {
  active: boolean;
  workflowConfigured: boolean;
  remaining: number;
  inquiries: number;
  intakeReserved: number;
  activeJobs: number;
  limits: {inquiries: number; batchRows: number; concurrentJobs: number};
}

export function batchLimit(eligible: number, usage: ImportUsage | null, mode: ImportMode) {
  if (!usage) return 0;
  return Math.max(0, Math.min(eligible, usage.limits.batchRows,
    usage.limits.inquiries - usage.inquiries - (usage.intakeReserved || 0),
    mode === 'analyze' ? usage.remaining : Infinity));
}

export function importReadiness(eligible: number, usage: ImportUsage | null, mode: ImportMode) {
  return [
    {label: 'Source preview', ready: eligible > 0, detail: eligible > 0 ? `${eligible} eligible rows reviewed` : 'Preview at least one eligible row'},
    {label: 'Plan', ready: !!usage?.active, detail: usage?.active ? 'Active' : 'An active plan is required'},
    {label: 'Inquiry allowance', ready: !!usage && usage.inquiries + (usage.intakeReserved || 0) < usage.limits.inquiries, detail: usage ? `${Math.max(0, usage.limits.inquiries - usage.inquiries - (usage.intakeReserved || 0))} rows available` : 'Waiting for usage data'},
    {label: 'Processing slot', ready: !!usage && usage.activeJobs < usage.limits.concurrentJobs, detail: usage ? `${usage.activeJobs} of ${usage.limits.concurrentJobs} slots occupied` : 'Waiting for usage data'},
    {label: 'Analysis', ready: mode === 'import' || !!usage?.workflowConfigured && usage.remaining > 0, detail: mode === 'import' ? 'Not requested · no analysis credits' : !usage?.workflowConfigured ? 'Configure the analysis workflow first' : `${usage.remaining} credits available`},
  ];
}

export function matchesJob(job: {title: string; status: string; mode?: string}, query: string, status: string) {
  return job.title.toLowerCase().includes(query.trim().toLowerCase()) &&
    (status === 'all' || job.status === status);
}

export function canSaveRecipeDraft(input: {
  name: string;
  sourceIdColumn: string;
  frequencyMinutes: number;
  rowCap: number;
  dailyCreditCap: number;
  mode: ImportMode;
}) {
  return !!input.name.trim() && !!input.sourceIdColumn &&
    input.frequencyMinutes > 0 && input.rowCap > 0 &&
    (input.mode === 'analyze' ? input.dailyCreditCap >= 1 : input.dailyCreditCap >= 0);
}
