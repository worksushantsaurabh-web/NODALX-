import {randomUUID} from 'node:crypto';
import {setTimeout as wait} from 'node:timers/promises';

export const INTAKE_TIMEOUT_MS = 45000;

const requiredFields = ['name', 'email', 'company', 'message'];
const optionalFields = ['phone', 'industry', 'service'];
const transientStatuses = new Set([429, 500, 502, 503, 504]);
const transientTransportCodes = new Set(['UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_BODY_TIMEOUT',
  'UND_ERR_SOCKET', 'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EAI_AGAIN']);

function transportCode(error) {
  const code = error?.cause?.code || error?.code;
  return transientTransportCodes.has(code) || code === 'ENOTFOUND' ? code : 'UNKNOWN';
}

async function discardResponse(response) {
  try {await response.body?.cancel();} catch {}
}

function confirmationRedirect(response, endpoint) {
  const location = response.headers?.get('location');
  if (!location || ![302, 303].includes(response.status)) throw new Error('Invalid confirmation redirect');
  const target = new URL(location, endpoint);
  if (target.protocol !== 'https:' || target.hostname !== 'script.googleusercontent.com' ||
    target.username || target.password || target.port || target.hash || target.pathname !== '/macros/echo' ||
    target.searchParams.has('secret')) throw new Error('Invalid confirmation origin');
  return target;
}

export function intakeConfiguration(environment = process.env) {
  const missing = ['APPS_SCRIPT_WEB_APP_URL', 'APPS_SCRIPT_INTAKE_SECRET'].filter(name => !environment[name]?.trim());
  let endpoint;
  try {
    endpoint = new URL(environment.APPS_SCRIPT_WEB_APP_URL?.trim());
    if (endpoint.protocol !== 'https:' || endpoint.hostname !== 'script.google.com' ||
      endpoint.username || endpoint.password || endpoint.port || endpoint.search || endpoint.hash ||
      !/^\/macros\/s\/[a-zA-Z0-9_-]+\/exec$/.test(endpoint.pathname)) endpoint = undefined;
  } catch {
    endpoint = undefined;
  }
  return {ready: missing.length === 0 && !!endpoint, missing, validEndpoint: !!endpoint, endpoint};
}

export async function receiveContact({method, body, idempotencyKey}, {environment = process.env, fetcher = fetch, timeoutMs = INTAKE_TIMEOUT_MS, logger = () => {}} = {}) {
  const requestId = randomUUID();
  const result = (status, payload) => ({status, headers: {
    'Cache-Control': 'no-store', 'Content-Type': 'application/json', 'X-Request-ID': requestId,
    'X-Content-Type-Options': 'nosniff', ...(status === 405 ? {Allow: 'POST'} : {}),
    ...(status === 502 ? {'Retry-After': '3'} : {}),
  }, body: {...payload, requestId}});
  if (method !== 'POST') return result(405, {error: 'Method not allowed.', code: 'METHOD_NOT_ALLOWED'});
  const configuration = intakeConfiguration(environment);
  if (!configuration.ready) return result(503, {error: 'Inquiry intake is not configured.', code: 'INTAKE_NOT_CONFIGURED'});
  if (typeof body === 'string') {
    if (Buffer.byteLength(body) > 20000) return result(413, {error: 'Inquiry is too large.', code: 'PAYLOAD_TOO_LARGE'});
    try {body = JSON.parse(body);} catch {return result(400, {error: 'Invalid JSON.', code: 'INVALID_JSON'});}
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return result(400, {error: 'Invalid inquiry.', code: 'INVALID_INQUIRY'});
  const inquiry = {};
  for (const field of [...requiredFields, ...optionalFields]) {
    const value = body[field];
    if (value != null && (typeof value !== 'string' || value.length > (field === 'message' ? 12000 : 500))) {
      return result(400, {error: `Invalid ${field}.`, code: 'INVALID_INQUIRY'});
    }
    inquiry[field] = (value || '').trim();
  }
  if (requiredFields.some(field => !inquiry[field]) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inquiry.email)) {
    return result(400, {error: 'Name, valid email, company, and message are required.', code: 'INVALID_INQUIRY'});
  }
  if (idempotencyKey != null && (typeof idempotencyKey !== 'string' || !/^[a-zA-Z0-9_-]{8,100}$/.test(idempotencyKey))) {
    return result(400, {error: 'Invalid Idempotency-Key.', code: 'INVALID_REQUEST_ID'});
  }
  const operationId = idempotencyKey || requestId;
  configuration.endpoint.searchParams.set('secret', environment.APPS_SCRIPT_INTAKE_SECRET);
  const upstreamSignal = AbortSignal.timeout(timeoutMs);
  const startedAt = Date.now();
  let phase = 'request';
  let providerStatus;
  let responseType;
  const report = (event, error, attempt) => {
    try {
      logger({event, requestId, phase, providerStatus, responseType, attempt, elapsedMs: Date.now() - startedAt,
        errorType: error ? ['TypeError', 'SyntaxError', 'AbortError', 'TimeoutError'].includes(error.name) ? error.name : 'Error' : undefined,
        transportCode: error ? transportCode(error) : undefined});
    } catch {}
  };
  const requestUpstream = async (endpoint, options) => {
    const maximumAttempts = options.method === 'POST' ? 2 : 3;
    const requestPhase = options.method === 'POST' ? 'request' : 'confirmation_request';
    for (let attempt = 1; attempt <= maximumAttempts; attempt++) {
      upstreamSignal.throwIfAborted();
      phase = requestPhase;
      providerStatus = undefined;
      responseType = undefined;
      let upstream;
      try {
        upstream = await fetcher(endpoint, {...options, signal: upstreamSignal, redirect: 'manual'});
      } catch (error) {
        if (upstreamSignal.aborted || !transientTransportCodes.has(transportCode(error)) || attempt === maximumAttempts) throw error;
        report('intake_transport_retry', error, attempt);
        await wait(attempt * 250, undefined, {signal: upstreamSignal});
        continue;
      }
      providerStatus = upstream.status;
      responseType = upstream.headers?.get('content-type')?.includes('application/json') ? 'json' :
        upstream.headers?.get('content-type')?.includes('text/html') ? 'html' : 'other';
      if (transientStatuses.has(upstream.status) && attempt < maximumAttempts) {
        const retryAfter = upstream.headers?.get('retry-after');
        const retryDate = retryAfter ? Date.parse(retryAfter) : NaN;
        const retryDelay = retryAfter && /^\d+$/.test(retryAfter) ? Number(retryAfter) * 1000 :
          Number.isFinite(retryDate) ? Math.max(0, retryDate - Date.now()) : attempt * 250;
        if (retryDelay > 2000) return {upstream};
        await discardResponse(upstream);
        report('intake_provider_retry', undefined, attempt);
        await wait(retryDelay, undefined, {signal: upstreamSignal});
        continue;
      }
      if ((upstream.status >= 300 && upstream.status < 400) || (!upstream.ok && upstream.status !== 409)) return {upstream};
      phase = 'confirmation';
      try {
        const confirmation = await upstream.json();
        upstreamSignal.throwIfAborted();
        return {upstream, confirmation};
      } catch (error) {
        if (options.method !== 'GET' || upstreamSignal.aborted ||
          !transientTransportCodes.has(transportCode(error)) || attempt === maximumAttempts) throw error;
        await discardResponse(upstream);
        report('intake_transport_retry', error, attempt);
        await wait(attempt * 250, undefined, {signal: upstreamSignal});
      }
    }
  };
  try {
    const payload = JSON.stringify({...inquiry, source: 'nodalx.in', requestId: operationId});
    let upstream;
    let confirmation;
    for (let submissionAttempt = 1; submissionAttempt <= 2; submissionAttempt++) {
      let endpoint = configuration.endpoint;
      ({upstream, confirmation} = await requestUpstream(endpoint, {
        method: 'POST', headers: {'Content-Type': 'application/json', Accept: 'application/json'}, body: payload,
      }));
      let redirects = 0;
      while (upstream.status >= 300 && upstream.status < 400) {
        if (++redirects > 3) throw new Error('Too many confirmation redirects');
        const target = confirmationRedirect(upstream, endpoint);
        await discardResponse(upstream);
        endpoint = target;
        ({upstream, confirmation} = await requestUpstream(endpoint, {method: 'GET', headers: {Accept: 'application/json'}}));
      }
      if (submissionAttempt === 1 && redirects > 0 && [404, 410].includes(upstream.status)) {
        await discardResponse(upstream);
        report('intake_receipt_retry', undefined, submissionAttempt);
        await wait(250, undefined, {signal: upstreamSignal});
        continue;
      }
      break;
    }
    phase = 'confirmation';
    if (confirmation?.code === 'IDEMPOTENCY_CONFLICT') {
      return result(409, {error: 'This request ID belongs to different inquiry data. Start a new submission.', code: 'IDEMPOTENCY_CONFLICT'});
    }
    if (!upstream.ok || confirmation?.success !== true || typeof confirmation.rowId !== 'string' || !confirmation.rowId.trim()) {
      report('intake_not_confirmed');
      return result(502, {error: 'Inquiry storage did not confirm acceptance. Retry with the same request ID.', code: 'INTAKE_NOT_CONFIRMED'});
    }
    return result(202, {accepted: true, id: confirmation.rowId, duplicate: confirmation.duplicate === true,
      processingStatus: confirmation.classification && typeof confirmation.classification === 'object' ? 'classified' : 'accepted'});
  } catch (error) {
    report('intake_transport_failure', error);
    if (error?.name === 'TimeoutError' || (upstreamSignal.aborted && upstreamSignal.reason?.name === 'TimeoutError')) {
      return result(502, {error: 'Inquiry storage did not respond in time. Your inquiry may already be saved. Retry without changing the form, using the same request ID.', code: 'INTAKE_TIMEOUT'});
    }
    return result(502, {error: 'Inquiry storage is unavailable. Retry with the same request ID.', code: 'INTAKE_UNAVAILABLE'});
  }
}
