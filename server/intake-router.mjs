import {createHash, randomUUID, timingSafeEqual} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {receiveContact} from './contact.mjs';

const credentialPattern = /^[A-Za-z0-9_-]{32,256}$/;
const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const fields = ['name','email','company','message','phone','industry','service'];

function response(status, body) {
  return {status, headers: {'Content-Type': 'application/json', 'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff', ...(status === 429 ? {'Retry-After': '60'} : {})},
  body: {...body, requestId: randomUUID()}};
}

function parseObject(value, allowed) {
  if (typeof value === 'string') {
    if (Buffer.byteLength(value) > 20000) throw new Error();
    value = JSON.parse(value);
  }
  if (!value || typeof value !== 'object' || Array.isArray(value) || Buffer.byteLength(JSON.stringify(value)) > 20000 ||
    Object.keys(value).some(key => !allowed.includes(key))) throw new Error();
  return value;
}

function databaseOrigin(environment) {
  const url = new URL(environment.SUPABASE_URL);
  const cloud = ['staging','production'].includes(environment.INTAKE_ENVIRONMENT) &&
    url.protocol === 'https:' && /^[a-z0-9]+\.supabase\.co$/.test(url.hostname) && !url.port;
  const local = environment.INTAKE_ENVIRONMENT === 'local' && url.protocol === 'http:' && url.hostname === '127.0.0.1';
  if ((!cloud && !local) || url.username || url.password || url.pathname !== '/' || url.search || url.hash ||
    !environment.SUPABASE_SERVICE_ROLE_KEY || environment.ALLOW_INTAKE_NETWORK !== 'true') throw new Error();
  return url.origin;
}

export function intakeRouterConfiguration(environment = process.env) {
  const missing = ['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','INTAKE_ENVIRONMENT','INTAKE_SOURCE_TOKEN'].filter(name => !environment[name]);
  let validEndpoint = false;
  try {databaseOrigin(environment); validEndpoint = true;} catch {validEndpoint = false;}
  return {ready: validEndpoint && credentialPattern.test(environment.INTAKE_SOURCE_TOKEN || '') &&
    environment.INTAKE_SOURCE_TOKEN !== environment.MAKE_INTAKE_TOKEN, missing, validEndpoint,
    consumerEnabled: environment.MAKE_INTAKE_ENABLED === 'true' && credentialPattern.test(environment.MAKE_INTAKE_TOKEN || '') &&
      environment.MAKE_INTAKE_TOKEN !== environment.INTAKE_SOURCE_TOKEN && environment.MAKE_INTAKE_TOKEN !== environment.MAKE_PROCESSING_TOKEN};
}

function clientFor(environment, options) {
  return (options.createClient || createClient)(databaseOrigin(environment), environment.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {persistSession: false, autoRefreshToken: false, detectSessionInUrl: false},
    global: {fetch: (input, init) => fetch(input, {...init, signal: AbortSignal.timeout(10000)})},
  });
}

function databaseFailure(error) {
  if (error?.code === 'P0409' || error?.code === '23505') return response(409, {code: 'IDEMPOTENCY_CONFLICT', error: 'This request conflicts with an existing inquiry or lease.'});
  if (error?.code === 'P0429') return response(429, {code: 'INTAKE_RATE_LIMIT', error: 'Intake limit reached. Retry later using the same request ID.'});
  if (error?.code === '22023' || error?.code === '22P02') return response(400, {code: 'INVALID_INQUIRY', error: 'Invalid intake request.'});
  return response(503, {code: 'INTAKE_UNAVAILABLE', error: 'Intake is unavailable. Retry with the same request ID.'});
}

export async function receiveWebsiteIntake(request, options = {}) {
  const environment = options.environment || process.env;
  if (!environment.INTAKE_PROVIDER || environment.INTAKE_PROVIDER === 'apps-script') return receiveContact(request, options);
  if (environment.INTAKE_PROVIDER !== 'make-supabase') return response(503, {code: 'INTAKE_NOT_CONFIGURED'});
  if (request.method !== 'POST') return {...response(405, {code: 'METHOD_NOT_ALLOWED'}), headers: {...response(405, {}).headers, Allow: 'POST'}};
  let inquiry;
  try {
    if (typeof request.idempotencyKey !== 'string' || !/^[A-Za-z0-9_-]{8,100}$/.test(request.idempotencyKey)) throw new Error();
    inquiry = parseObject(request.body, fields);
    if (Object.entries(inquiry).some(([field, value]) => typeof value !== 'string' || value.length > (field === 'message' ? 12000 : 500)) ||
      ['name','company','message'].some(field => !inquiry[field]?.trim()) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inquiry.email || '')) throw new Error();
  } catch {return response(400, {code: 'INVALID_INQUIRY', error: 'Valid inquiry data and a stable Idempotency-Key are required.'});}
  try {
    if (!credentialPattern.test(environment.INTAKE_SOURCE_TOKEN || '') || environment.INTAKE_SOURCE_TOKEN === environment.MAKE_INTAKE_TOKEN) throw new Error();
    const client = clientFor(environment, options);
    const result = await client.rpc('stage_source_inquiry', {source_key_hash: createHash('sha256').update(environment.INTAKE_SOURCE_TOKEN).digest('hex'),
      source_id: request.idempotencyKey, inquiry});
    if (result.error) return databaseFailure(result.error);
    if (typeof result.data?.id !== 'string' || !uuidPattern.test(result.data.id) || !['queued','processing','stored','failed'].includes(result.data.status)) throw new Error();
    if (result.data.status === 'failed') return response(503, {code: 'INTAKE_RECOVERY_REQUIRED', error: 'The saved submission needs operator recovery. Do not create a new request ID.'});
    return response(202, {id: result.data.id, status: result.data.status, sourceInquiryId: request.idempotencyKey,
      duplicate: result.data.duplicate === true, accepted: true, processingStatus: result.data.status});
  } catch {return response(503, {code: 'INTAKE_UNAVAILABLE', error: 'Intake could not confirm acceptance. Retry using the same request ID.'});}
}

export async function receiveMakeIntake(request, options = {}) {
  const environment = options.environment || process.env;
  if (!['claim','complete'].includes(request.action)) return response(404, {code: 'NOT_FOUND'});
  if (request.method !== 'POST') return {...response(405, {code: 'METHOD_NOT_ALLOWED'}), headers: {...response(405, {}).headers, Allow: 'POST'}};
  if (environment.MAKE_INTAKE_ENABLED !== 'true' || !credentialPattern.test(environment.MAKE_INTAKE_TOKEN || '') ||
    environment.MAKE_INTAKE_TOKEN === environment.INTAKE_SOURCE_TOKEN || environment.MAKE_INTAKE_TOKEN === environment.MAKE_PROCESSING_TOKEN) {
    return response(503, {code: 'INTAKE_NOT_CONFIGURED'});
  }
  const supplied = typeof request.authorization === 'string' && request.authorization.length <= 4096 ? Buffer.from(request.authorization) : Buffer.alloc(0);
  const expected = Buffer.from(`Bearer ${environment.MAKE_INTAKE_TOKEN}`);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return response(401, {code: 'AUTH_REQUIRED'});
  let body;
  try {
    body = parseObject(request.body, request.action === 'claim' ? [] : ['deliveryId','leaseToken']);
    if (request.action === 'complete' && (!uuidPattern.test(body.deliveryId || '') || !uuidPattern.test(body.leaseToken || ''))) throw new Error();
  } catch {return response(400, {code: 'INVALID_INPUT'});}
  try {
    const client = clientFor(environment, options);
    const result = request.action === 'claim' ? await client.rpc('claim_intake_delivery') :
      await client.rpc('complete_intake_delivery', {record_delivery: body.deliveryId, token: body.leaseToken});
    if (result.error) return databaseFailure(result.error);
    if (request.action === 'claim') {
      if (!result.data) return response(200, {status: 'idle'});
      const packet = result.data;
      if (packet.status !== 'claimed' || !uuidPattern.test(packet.deliveryId || '') || !uuidPattern.test(packet.leaseToken || '') ||
        typeof packet.sourceInquiryId !== 'string' || !/^[A-Za-z0-9_-]{8,128}$/.test(packet.sourceInquiryId)) throw new Error();
      return response(200, {status: 'claimed', deliveryId: packet.deliveryId, leaseToken: packet.leaseToken, sourceInquiryId: packet.sourceInquiryId});
    }
    if (result.data?.status !== 'stored' || typeof result.data.id !== 'string') throw new Error();
    return response(200, {status: 'stored', id: result.data.id, duplicate: result.data.duplicate === true});
  } catch {return response(503, {code: 'INTAKE_UNAVAILABLE'});}
}
