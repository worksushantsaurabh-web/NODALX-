import {createHmac, timingSafeEqual} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {cloudWorkerConfiguration} from './processing-daemon.mjs';
import {buildGeminiRequest, parseGeminiResponse} from './gemini-processor.mjs';

const headers = {'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'};

function equalSecret(actual, expected) {
  if (typeof actual !== 'string' || actual.length > 4096) return false;
  const first = Buffer.from(actual);
  const second = Buffer.from(expected);
  return first.length === second.length && timingSafeEqual(first, second);
}

function sign(payload, secret) {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

function receiptFor(job, secret, now) {
  const payload = Buffer.from(JSON.stringify({workspace: job.workspaceId, job: job.id, lease: job.leaseToken,
    criteria: Boolean(job.input.criteria?.trim()), expires: now + 110000})).toString('base64url');
  return `${payload}.${sign(payload, secret)}`;
}

function verifyReceipt(receipt, secret, now) {
  if (typeof receipt !== 'string' || receipt.length > 4096 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(receipt)) throw new Error('Invalid receipt');
  const [payload, signature] = receipt.split('.');
  if (!equalSecret(signature, sign(payload, secret))) throw new Error('Invalid receipt');
  const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  if (!Number.isSafeInteger(decoded.expires) || decoded.expires <= now || decoded.expires > now + 110000) throw new Error('Expired receipt');
  return decoded;
}

export async function receiveMakeRequest(request, options = {}) {
  const environment = options.environment || process.env;
  const reply = (status, body) => ({status, headers, body});
  if (!['claim', 'complete'].includes(request.action)) return reply(404, {code: 'NOT_FOUND'});
  if (request.method !== 'POST') return {...reply(405, {code: 'METHOD_NOT_ALLOWED'}), headers: {...headers, Allow: 'POST'}};
  if (environment.MAKE_PROCESSING_ENABLED !== 'true') return reply(503, {code: 'PROCESSING_UNAVAILABLE'});
  const secret = environment.MAKE_PROCESSING_TOKEN;
  const signingSecret = environment.MAKE_RECEIPT_SECRET;
  if (!/^[A-Za-z0-9_-]{32,256}$/.test(secret || '') || !/^[A-Za-z0-9_-]{32,256}$/.test(signingSecret || '') || secret === signingSecret) {
    return reply(503, {code: 'PROCESSING_UNAVAILABLE'});
  }
  if (!equalSecret(request.authorization, `Bearer ${secret}`)) return reply(401, {code: 'AUTH_REQUIRED'});
  let body;
  try {
    if (typeof request.body === 'string' && Buffer.byteLength(request.body) > 49152) throw new Error();
    body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
    if (!body || Array.isArray(body) || typeof body !== 'object' || Buffer.byteLength(JSON.stringify(body)) > 49152) throw new Error();
    const allowed = request.action === 'claim' ? [] : ['receipt', 'response', 'failed'];
    if (Object.keys(body).some(key => !allowed.includes(key))) throw new Error();
  } catch {return reply(400, {code: 'INVALID_INPUT'});}
  let configuration;
  try {
    configuration = cloudWorkerConfiguration(environment);
    if (!/^gemini-[a-z0-9.-]{1,80}$/.test(environment.GEMINI_MODEL || '') ||
      !['synthetic-only', 'approved-customer'].includes(environment.GEMINI_DATA_APPROVAL) ||
      (environment.PROCESSING_ENVIRONMENT === 'production' &&
        (environment.GEMINI_DATA_APPROVAL !== 'approved-customer' || environment.GEMINI_PAID_PROJECT_APPROVED !== 'true'))) throw new Error();
  } catch {return reply(503, {code: 'PROCESSING_UNAVAILABLE'});}
  const now = (options.now || Date.now)();
  let receipt;
  let output;
  if (request.action === 'complete') {
    try {receipt = verifyReceipt(body.receipt, signingSecret, now);} catch {return reply(409, {code: 'INVALID_OR_EXPIRED_RECEIPT'});}
    try {
      if (body.failed === true && body.response === undefined) output = null;
      else if (body.failed === undefined && body.response !== undefined) output = parseGeminiResponse(body.response, receipt.criteria);
      else throw new Error();
    } catch {return reply(400, {code: 'INVALID_OUTPUT'});}
  }
  try {
    const client = (options.createClient || createClient)(configuration.url, configuration.key, {
      auth: {persistSession: false, autoRefreshToken: false},
      global: {fetch: (input, init) => fetch(input, {...init, signal: AbortSignal.timeout(10000)})},
    });
    if (request.action === 'complete') {
      const result = await client.rpc('finish_processing_job', {owned_workspace: receipt.workspace,
        record_job: receipt.job, token: receipt.lease, output});
      if (result.error) throw new Error();
      return result.data ? reply(200, {status: output ? 'completed' : 'failed'}) : reply(409, {code: 'LEASE_NOT_ACTIVE'});
    }
    const result = await client.rpc('claim_make_processing_job');
    if (result.error?.code === 'P0429') return reply(429, {code: 'RATE_LIMITED'});
    if (result.error) throw new Error();
    if (!result.data) return reply(200, {status: 'idle'});
    const job = result.data;
    let geminiRequest;
    try {
      if (job.attempt > 3) throw new Error();
      geminiRequest = buildGeminiRequest(job.input);
    } catch {
      const result = await client.rpc('finish_processing_job', {owned_workspace: job.workspaceId,
        record_job: job.id, token: job.leaseToken, output: null});
      if (result.error) throw new Error();
      return reply(200, {status: 'rejected'});
    }
    return reply(200, {status: 'claimed', receipt: receiptFor(job, signingSecret, now),
      deadlineSeconds: 90, model: environment.GEMINI_MODEL, geminiRequest});
  } catch {return reply(503, {code: 'PROCESSING_UNAVAILABLE'});}
}
