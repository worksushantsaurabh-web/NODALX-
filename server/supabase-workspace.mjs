import {randomUUID} from 'node:crypto';
import {authorizeWorkspace, databaseError, failure, receiveAccountRequest} from './supabase-account.mjs';

const limits = {
  trial: {inquiries: 100, credits: 50, sheets: 1, batchRows: 25, concurrentJobs: 1},
  starter: {inquiries: 2000, credits: 500, sheets: 1, batchRows: 100, concurrentJobs: 1},
  growth: {inquiries: 10000, credits: 2000, sheets: 3, batchRows: 500, concurrentJobs: 2},
};

function recordId(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,150}$/.test(value)) throw failure(400, 'INVALID_INPUT', 'Invalid record ID.');
  return value;
}

function decodedRecordId(value) {
  try {return recordId(decodeURIComponent(value));}
  catch {throw failure(400, 'INVALID_INPUT', 'Invalid record ID.');}
}

export function serializeInquiry(row) {
  const payload = row.payload || {};
  const fields = ['company', 'phone', 'industry', 'service', 'intent', 'urgency', 'fit_score', 'category', 'summary', 'suggested_action'];
  return {
    ...Object.fromEntries(fields.map(field => [field, typeof payload[field] === 'string' || typeof payload[field] === 'number' ? payload[field] : ''])),
    id: row.id, name: row.name, email: row.email, message: row.original_message,
    status: row.status, processing_status: row.processing_status, last_active: row.created_at,
  };
}

async function listInquiries(client, workspaceId, query, intakeProvider) {
  const rawLimit = query.get('limit') || '50';
  if (!/^\d{1,3}$/.test(rawLimit) || Number(rawLimit) < 1 || Number(rawLimit) > 100) throw failure(400, 'INVALID_INPUT', 'Limit must be between 1 and 100.');
  const limit = Number(rawLimit);
  let request = client.from('inquiries').select('*').eq('workspace_id', workspaceId)
    .order('created_at', {ascending: false}).order('id', {ascending: false});
  if (query.has('cursor')) {
    const cursor = query.get('cursor');
    if (!/^[A-Za-z0-9_-]{1,200}$/.test(cursor)) throw failure(400, 'INVALID_CURSOR', 'Invalid cursor.');
    const anchorId = recordId(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (Buffer.from(anchorId).toString('base64url') !== cursor) throw failure(400, 'INVALID_CURSOR', 'Invalid cursor.');
    const anchor = await client.from('inquiries').select('created_at').eq('workspace_id', workspaceId).eq('id', anchorId).maybeSingle();
    databaseError(anchor.error);
    if (!anchor.data) throw failure(400, 'INVALID_CURSOR', 'Cursor is unavailable. Refresh the inquiry list.');
    request = request.or(`created_at.lt.${anchor.data.created_at},and(created_at.eq.${anchor.data.created_at},id.lt.${anchorId})`);
  }
  const result = await request.limit(limit + 1);
  databaseError(result.error);
  const records = result.data.slice(0, limit);
  return {
    records: records.map(serializeInquiry),
    nextCursor: result.data.length > limit ? Buffer.from(records.at(-1).id).toString('base64url') : null,
    source: 'supabase',
    notice: intakeProvider === 'make-supabase'
      ? 'New website inquiries appear after the Make intake handoff completes. Historical Google Sheet inquiries are not migrated automatically.'
      : 'Website inquiries stored in the owner’s Google Sheet are not synchronized into this workspace yet.',
  };
}

async function usage(client, workspaceId) {
  const availability = await client.rpc('processing_available');
  databaseError(availability.error);
  const subscription = await client.from('subscriptions').select('*').eq('workspace_id', workspaceId).single();
  databaseError(subscription.error);
  const current = subscription.data;
  const planLimits = limits[current.plan];
  if (!planLimits) throw failure(503, 'INVALID_PLAN', 'Plan configuration needs review.');
  const periodStart = Date.parse(current.period_start);
  const periodEnd = Date.parse(current.period_end);
  const period = current.plan === 'trial' ? 'trial' : String(periodStart);
  const counters = await client.from('usage_periods').select('inquiries,used,reserved,active_jobs').eq('workspace_id', workspaceId).eq('period', period).maybeSingle();
  databaseError(counters.error);
  const jobs = await client.from('jobs').select('id', {count: 'exact', head: true}).eq('workspace_id', workspaceId).in('state', ['queued', 'processing']);
  databaseError(jobs.error);
  const used = Number(counters.data?.used || 0);
  const reserved = Number(counters.data?.reserved || 0);
  const active = ['trialing', 'active', 'legacy'].includes(current.status) && periodStart <= Date.now() && periodEnd > Date.now();
  return {
    plan: current.plan, limits: planLimits, active, status: active ? current.status : 'expired',
    periodStart, periodEnd, legacy: current.status === 'legacy', cancelAtPeriodEnd: current.cancel_at_period_end,
    inquiries: Number(counters.data?.inquiries || 0), intakeReserved: 0, used, reserved,
    activeJobs: jobs.count || 0, remaining: Math.max(0, planLimits.credits - used - reserved),
    workflowConfigured: availability.data === true,
  };
}

export async function receiveWorkspaceRequest(request, options = {}) {
  const requestId = randomUUID();
  const headers = {'Cache-Control': 'no-store', 'X-Request-ID': requestId, 'X-NodalX-Data-Source': 'supabase'};
  try {
    const url = new URL(request.path, 'http://localhost');
    const path = url.pathname;
    if (path === '/api/user/profile' || path === '/api/feedback') {
      return receiveAccountRequest({...request, route: path === '/api/feedback' ? 'feedback' : 'profile'}, options);
    }
    if (path === '/api/health/live' && request.method === 'GET') return {status: 200, headers, body: {status: 'alive'}};
    const {client, workspaceId} = await authorizeWorkspace(request.authorization, options);
    for (const parameter of ['limit', 'cursor', 'days']) {
      if (url.searchParams.getAll(parameter).length > 1) throw failure(400, 'INVALID_INPUT', 'Repeated query parameter.');
    }
    let body;
    if (path === '/api/workspace/inquiries' && request.method === 'GET') {
      body = await listInquiries(client, workspaceId, url.searchParams, (options.environment || process.env).INTAKE_PROVIDER);
    } else if (/^\/api\/workspace\/inquiries\/[^/]+\/analyze$/.test(path) && request.method === 'POST') {
      const id = decodedRecordId(path.split('/').at(-2));
      if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body) ||
        Object.keys(request.body).some(key => key !== 'requestKey') ||
        (request.body.requestKey !== undefined && (typeof request.body.requestKey !== 'string' || !/^[A-Za-z0-9_-]{8,128}$/.test(request.body.requestKey)))) {
        throw failure(400, 'INVALID_INPUT', 'An optional requestKey is the only supported analysis field.');
      }
      const queued = await client.rpc('enqueue_own_analysis', {record_id: id, request_key: request.body.requestKey || null});
      databaseError(queued.error);
      body = {success: true, ...queued.data};
    } else if (path === '/api/workspace/jobs' && request.method === 'GET') {
      const jobs = await client.from('jobs').select('*').eq('workspace_id', workspaceId).order('created_at', {ascending: false}).limit(50);
      databaseError(jobs.error);
      body = {jobs: jobs.data.map(serializeJob)};
    } else if (/^\/api\/workspace\/jobs\/[^/]+$/.test(path) && request.method === 'GET') {
      const id = decodedRecordId(path.split('/').at(-1));
      const job = await client.from('jobs').select('*').eq('workspace_id', workspaceId).eq('id', id).maybeSingle();
      databaseError(job.error);
      if (!job.data) throw failure(404, 'NOT_FOUND', 'Job not found.');
      const rows = await client.from('job_rows').select('*').eq('workspace_id', workspaceId).eq('job_id', id).order('created_at').limit(100);
      databaseError(rows.error);
      body = {...serializeJob(job.data), rows: rows.data.map((row, index) => ({...row.original_row, ...row.result, id: row.id, row: index + 1, status: row.state,
        error: row.state === 'failed' ? 'Processing failed; no analysis credit was charged.' : ''}))};
    } else if (path === '/api/workspace/usage' && request.method === 'GET') {
      body = await usage(client, workspaceId);
    } else if (path === '/api/user/tier' && request.method === 'GET') {
      const subscription = await client.from('subscriptions').select('entitlement').eq('workspace_id', workspaceId).single();
      databaseError(subscription.error);
      body = {tier: subscription.data.entitlement};
    } else if (path === '/api/workspace/plans' && request.method === 'GET') {
      body = {plans: Object.entries(limits).map(([id, values]) => ({id, label: id[0].toUpperCase() + id.slice(1), ...values, checkoutEnabled: false, price: null}))};
    } else if (path === '/api/workspace/overview' && request.method === 'GET') {
      const days = Number(url.searchParams.get('days') || 30);
      if (![7, 30, 90].includes(days)) throw failure(400, 'INVALID_INPUT', 'Report period must be 7, 30 or 90 days.');
      const result = await client.rpc('own_workspace_overview', {selected_days: days});
      databaseError(result.error);
      body = result.data;
    } else if (path === '/api/workspace/settings' && request.method === 'GET') {
      const result = await client.from('workspace_settings').select('criteria').eq('workspace_id', workspaceId).maybeSingle();
      databaseError(result.error);
      body = {criteria: result.data?.criteria || ''};
    } else if (path === '/api/workspace/settings' && request.method === 'PUT') {
      if (!request.body || Object.keys(request.body).length !== 1 || typeof request.body.criteria !== 'string' || request.body.criteria.length > 4000) {
        throw failure(400, 'INVALID_INPUT', 'Qualification criteria must be 4,000 characters or fewer.');
      }
      const result = await client.rpc('update_own_criteria', {value: request.body.criteria});
      databaseError(result.error);
      body = {success: true};
    } else if (/^\/api\/(?:workspace\/)?inquiries\/[^/]+(?:\/status)?$/.test(path) && request.method === 'PATCH') {
      const id = decodedRecordId(path.split('/').at(path.endsWith('/status') ? -2 : -1));
      const result = await client.rpc('update_own_inquiry', {record_id: id, updates: request.body});
      databaseError(result.error);
      body = {success: true};
    } else if (/^\/api\/workspace\/inquiries\/[^/]+\/activity$/.test(path) && request.method === 'GET') {
      const id = decodedRecordId(path.split('/').at(-2));
      const record = await client.from('inquiries').select('note,follow_up_at').eq('workspace_id', workspaceId).eq('id', id).maybeSingle();
      databaseError(record.error);
      if (!record.data) throw failure(404, 'NOT_FOUND', 'Inquiry not found.');
      const events = await client.from('inquiry_events').select('id,previous_status,changes,created_at')
        .eq('workspace_id', workspaceId).eq('inquiry_id', id).order('created_at', {ascending: false}).limit(20);
      databaseError(events.error);
      body = {note: record.data.note, followUpAt: record.data.follow_up_at ? Date.parse(record.data.follow_up_at) : null,
        events: events.data.map(event => ({id: event.id, previousStatus: event.previous_status, changes: event.changes, at: Date.parse(event.created_at)}))};
    } else if (['/api/health/ready', '/api/health'].includes(path) && request.method === 'GET') {
      const processing = await client.rpc('processing_readiness');
      databaseError(processing.error);
      body = {status: 'partial', services: {account: true, inquiryDesk: true, processing: processing.data.available, sheetsSync: false, billing: false}, processing: processing.data};
    } else {
      throw failure(503, 'MIGRATION_PENDING', 'This service is not migrated yet. No processing, billing or connector action was performed.');
    }
    return {status: 200, headers, body};
  } catch (error) {
    return {status: error.status || 503, headers, body: {
      error: error.status ? error.message : 'The service is temporarily unavailable.',
      code: error.status ? error.code : 'SERVICE_UNAVAILABLE', requestId,
    }};
  }
}

function serializeJob(row) {
  return {id: row.id, title: row.inquiry_id ? 'Inquiry analysis' : 'Imported records', mode: row.mode === 'process' ? 'analyze' : 'import',
    status: row.state, total: row.progress.total || 0, processed: row.progress.processed || 0,
    succeeded: row.progress.succeeded || 0, failed: row.progress.failed || 0, skipped: row.progress.skipped || 0,
    createdAt: Date.parse(row.created_at), exportStatus: 'not_requested',
    error: row.state === 'failed' ? 'Processing failed; the credit reservation was released.' : ''};
}
