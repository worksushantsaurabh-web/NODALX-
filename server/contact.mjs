import {randomUUID} from 'node:crypto';

const requiredFields = ['name', 'email', 'company', 'message'];
const optionalFields = ['phone', 'industry', 'service'];

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

export async function receiveContact({method, body, idempotencyKey}, {environment = process.env, fetcher = fetch} = {}) {
  const requestId = randomUUID();
  const result = (status, payload) => ({status, headers: {
    'Cache-Control': 'no-store', 'Content-Type': 'application/json', 'X-Request-ID': requestId,
    'X-Content-Type-Options': 'nosniff', ...(status === 405 ? {Allow: 'POST'} : {}),
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
  try {
    const upstream = await fetcher(configuration.endpoint, {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({...inquiry, source: 'nodalx.in', requestId: operationId}),
      signal: AbortSignal.timeout(15000), redirect: 'follow',
    });
    const confirmation = await upstream.json();
    if (confirmation?.code === 'IDEMPOTENCY_CONFLICT') {
      return result(409, {error: 'This request ID belongs to different inquiry data. Start a new submission.', code: 'IDEMPOTENCY_CONFLICT'});
    }
    if (!upstream.ok || confirmation?.success !== true || typeof confirmation.rowId !== 'string' || !confirmation.rowId.trim()) {
      return result(502, {error: 'Inquiry storage did not confirm acceptance. Retry with the same request ID.', code: 'INTAKE_NOT_CONFIRMED'});
    }
    return result(202, {accepted: true, id: confirmation.rowId, duplicate: confirmation.duplicate === true,
      processingStatus: confirmation.classification && typeof confirmation.classification === 'object' ? 'classified' : 'accepted'});
  } catch {
    return result(502, {error: 'Inquiry storage is unavailable. Retry with the same request ID.', code: 'INTAKE_UNAVAILABLE'});
  }
}
