import {Resend} from 'resend';
import {createClient} from '@supabase/supabase-js';
import {createRdsClient} from './rds-client.mjs';

const mailbox = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?@reply\.nodalx\.in$/;
const plainEmail = /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/;

function plainBody(message) {
  if (typeof message.text === 'string' && message.text.trim()) return message.text;
  if (typeof message.html !== 'string') return '';
  return message.html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?\s*>/gi, '\n').replace(/<\/p\s*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').trim();
}

export function receivedAlias(message) {
  const recipients = [...(Array.isArray(message.received_for) ? message.received_for : []),
    ...(Array.isArray(message.to) ? message.to : [])]
    .map(value => typeof value === 'string' ? value.trim().toLowerCase() : '')
    .filter(value => mailbox.test(value));
  const unique = [...new Set(recipients)];
  return unique.length === 1 ? unique[0].split('@')[0] : null;
}

export async function acceptReceivedEmail(rawPayload, headers, options = {}) {
  const environment = options.environment || process.env;
  if (environment.WORKSPACE_INBOUND_RECEIVING_ENABLED !== 'true' ||
      environment.WORKSPACE_EMAIL_DOMAIN !== 'reply.nodalx.in' ||
      !environment.RESEND_WEBHOOK_SECRET || !environment.RESEND_API_KEY) {
    return {status: 503, body: {code: 'INBOUND_DISABLED'}};
  }
  if (typeof rawPayload !== 'string' || Buffer.byteLength(rawPayload) > 262144) {
    return {status: 413, body: {code: 'INVALID_WEBHOOK'}};
  }
  const resend = options.resend || new Resend(environment.RESEND_API_KEY);
  let event;
  try {
    event = resend.webhooks.verify({payload: rawPayload, headers: {
      id: headers['svix-id'], timestamp: headers['svix-timestamp'], signature: headers['svix-signature'],
    }, webhookSecret: environment.RESEND_WEBHOOK_SECRET});
  } catch {return {status: 401, body: {code: 'INVALID_WEBHOOK'}};}
  if (event.type !== 'email.received') return {status: 200, body: {accepted: false}};
  const id = event.data?.email_id;
  if (typeof id !== 'string' || id.length > 200 || !/^[a-zA-Z0-9-]+$/.test(id)) {
    return {status: 400, body: {code: 'INVALID_EMAIL_ID'}};
  }
  const fetched = await resend.emails.receiving.get(id);
  if (fetched.error || !fetched.data) return {status: 503, body: {code: 'PROVIDER_UNAVAILABLE'}};
  const message = fetched.data;
  const alias = receivedAlias(message);
  if (!alias) return {status: 200, body: {accepted: false}};
  const sender = typeof message.from === 'string' ? message.from.replace(/^.*<([^>]+)>$/, '$1').trim().toLowerCase() : '';
  const body = plainBody(message);
  const inReplyTo = Object.entries(message.headers || {}).find(([name]) => name.toLowerCase() === 'in-reply-to')?.[1];
  if (!plainEmail.test(sender) || /[\r\n]/.test(sender) ||
    typeof message.subject !== 'string' || message.subject.length > 200 ||
    !body || body.length > 100000) {
    return {status: 422, body: {code: 'INVALID_EMAIL_CONTENT'}};
  }
  const admin = options.admin || (environment.DATA_BACKEND === 'rds' ?
    createRdsClient({role: 'service_role', environment}) :
    createClient(environment.SUPABASE_URL, environment.SUPABASE_SERVICE_ROLE_KEY,
      {auth: {persistSession: false, autoRefreshToken: false}}));
  const stored = await admin.rpc('store_received_email_service', {
    provider_id: id, recipient_alias: alias, sender_address: sender,
    email_subject: message.subject, email_body: body,
    rfc_message_id: typeof message.message_id === 'string' ? message.message_id : null,
    in_reply_to: typeof inReplyTo === 'string' ? inReplyTo.trim() : null,
  });
  if (stored.error) return {status: 503, body: {code: 'STORAGE_UNAVAILABLE'}};
  return {status: 200, body: {accepted: stored.data === true}};
}
