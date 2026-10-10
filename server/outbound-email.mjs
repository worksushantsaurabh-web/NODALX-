import {createHash} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {databaseError, failure} from './supabase-account.mjs';
import {createRdsClient} from './rds-client.mjs';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateOutboundEmail(body) {
  const fields = new Set(['requestKey', 'subject', 'body', 'confirmed']);
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !fields.has(key)) ||
    typeof body.requestKey !== 'string' || !/^[A-Za-z0-9_-]{8,128}$/.test(body.requestKey) ||
    typeof body.subject !== 'string' || body.subject.trim().length < 1 || body.subject.trim().length > 200 ||
    typeof body.body !== 'string' || body.body.trim().length < 1 || body.body.trim().length > 10000 ||
    body.confirmed !== true) {
    throw failure(400, 'INVALID_INPUT', 'Review and confirm a valid subject and message before sending.');
  }
  if (/[\r\n]/.test(body.subject)) throw failure(400, 'INVALID_INPUT', 'Email subject cannot contain line breaks.');
  return {requestKey: body.requestKey, subject: body.subject.trim(), body: body.body.trim()};
}

function requireConfiguration(environment) {
  if (environment.OUTBOUND_EMAIL_ENABLED !== 'true') throw failure(503, 'EMAIL_DISABLED', 'Email sending is not enabled for this environment.');
  if (!environment.RESEND_API_KEY || !environment.OUTBOUND_EMAIL_FROM || !emailPattern.test(environment.OUTBOUND_EMAIL_FROM.replace(/^.*<([^>]+)>$/, '$1'))) {
    throw failure(503, 'EMAIL_UNAVAILABLE', 'Email sending is not fully configured.');
  }
  if (environment.DATA_BACKEND === 'rds' ? !environment.RDS_DATABASE_URL :
    (!environment.SUPABASE_URL || !environment.SUPABASE_SERVICE_ROLE_KEY)) {
    throw failure(503, 'EMAIL_UNAVAILABLE', 'Email storage is not fully configured.');
  }
}

function adminClient(environment, clientFactory) {
  if (clientFactory === createClient && environment.DATA_BACKEND === 'rds') {
    return createRdsClient({role: 'service_role', environment});
  }
  return clientFactory(environment.SUPABASE_URL, environment.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {persistSession: false, autoRefreshToken: false, detectSessionInUrl: false},
  });
}

async function finalize(admin, workspaceId, emailId, inquiryId, state, providerMessageId, failureCode) {
  const update = {state, provider_message_id: providerMessageId || null, failure_code: failureCode || null,
    sent_at: state === 'sent' ? new Date().toISOString() : null};
  const saved = await admin.from('outbound_emails').update(update).eq('workspace_id', workspaceId).eq('id', emailId).eq('state', 'prepared').select('id').maybeSingle();
  databaseError(saved.error);
  if (state !== 'sent' || !saved.data) return;
  const inquiry = await admin.from('inquiries').select('status').eq('workspace_id', workspaceId).eq('id', inquiryId).maybeSingle();
  databaseError(inquiry.error);
  if (!inquiry.data) return;
  const updated = await admin.from('inquiries').update({status: 'Contacted', updated_at: new Date().toISOString()})
    .eq('workspace_id', workspaceId).eq('id', inquiryId);
  databaseError(updated.error);
  const event = await admin.from('inquiry_events').insert({workspace_id: workspaceId, inquiry_id: inquiryId,
    previous_status: inquiry.data.status, changes: {status: 'Contacted', emailSent: true}});
  databaseError(event.error);
}

export async function sendInquiryEmail({workspaceId, inquiryId, body}, options = {}) {
  const environment = options.environment || process.env;
  requireConfiguration(environment);
  const input = validateOutboundEmail(body);
  const payloadHash = createHash('sha256').update(JSON.stringify({inquiryId, subject: input.subject, body: input.body})).digest('hex');
  const admin = adminClient(environment, options.createClient || createClient);
  const reservation = await admin.rpc('reserve_outbound_email_service', {
    owned_workspace: workspaceId, record_id: inquiryId, requested_key: input.requestKey, email_subject: input.subject,
    email_body: input.body, content_hash: payloadHash,
  });
  databaseError(reservation.error);
  const prepared = reservation.data;
  if (!prepared || typeof prepared.id !== 'string' || !emailPattern.test(prepared.recipient || '')) {
    throw failure(503, 'EMAIL_UNAVAILABLE', 'Email storage did not confirm a valid recipient.');
  }
  if (!prepared.created) return {sent: prepared.state === 'sent', replayed: true, state: prepared.state, id: prepared.id};

  let response;
  try {
    response = await (options.fetch || fetch)('https://api.resend.com/emails', {
      method: 'POST',
      headers: {'Authorization': `Bearer ${environment.RESEND_API_KEY}`, 'Content-Type': 'application/json',
        'Idempotency-Key': `nodalx/${workspaceId}/${input.requestKey}`},
      body: JSON.stringify({from: environment.OUTBOUND_EMAIL_FROM, to: [prepared.recipient], subject: prepared.subject, text: prepared.body}),
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    await finalize(admin, workspaceId, prepared.id, inquiryId, 'unknown', null, 'network_error');
    throw failure(503, 'EMAIL_STATUS_UNKNOWN', 'The provider response was interrupted. The message will not be retried automatically.');
  }
  if (!response.ok) {
    await finalize(admin, workspaceId, prepared.id, inquiryId, 'failed', null, `provider_${response.status}`);
    if (response.status === 429) throw failure(429, 'EMAIL_RATE_LIMITED', 'Email provider limit reached. Create a new draft and retry later.');
    throw failure(503, 'EMAIL_REJECTED', 'The email provider did not accept this message.');
  }
  const provider = await response.json().catch(() => ({}));
  if (typeof provider.id !== 'string' || provider.id.length > 200) {
    await finalize(admin, workspaceId, prepared.id, inquiryId, 'unknown', null, 'invalid_provider_response');
    throw failure(503, 'EMAIL_STATUS_UNKNOWN', 'The provider response could not be confirmed. The message will not be retried automatically.');
  }
  await finalize(admin, workspaceId, prepared.id, inquiryId, 'sent', provider.id, null);
  return {sent: true, replayed: false, state: 'sent', id: prepared.id};
}

export async function listInquiryEmails(client, workspaceId, inquiryId) {
  const result = await client.from('outbound_emails').select('id,subject,state,created_at,sent_at')
    .eq('workspace_id', workspaceId).eq('inquiry_id', inquiryId).order('created_at', {ascending: false}).limit(20);
  databaseError(result.error);
  return result.data.map(row => ({id: row.id, subject: row.subject, state: row.state,
    createdAt: Date.parse(row.created_at), sentAt: row.sent_at ? Date.parse(row.sent_at) : null}));
}
