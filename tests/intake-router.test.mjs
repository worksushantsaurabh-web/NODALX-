import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {receiveWebsiteIntake, receiveMakeIntake} from '../server/intake-router.mjs';

const inquiry = {name: 'Synthetic customer', email: 'synthetic@example.test', company: 'Synthetic', message: '  Original "quote"\nmessage  '};
const environment = {INTAKE_PROVIDER: 'make-supabase', INTAKE_ENVIRONMENT: 'staging', ALLOW_INTAKE_NETWORK: 'true',
  INTAKE_SOURCE_TOKEN: 'synthetic-source-'.repeat(3), MAKE_INTAKE_TOKEN: 'synthetic-make-'.repeat(3), MAKE_INTAKE_ENABLED: 'true',
  SUPABASE_URL: 'https://synthetic.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'synthetic-service-key'};
const deliveryId = '00000000-0000-4000-8000-000000000101';
const leaseToken = '00000000-0000-4000-8000-000000000102';
function fixture(data = {id: deliveryId, status: 'queued', sourceInquiryId: 'synthetic-request', duplicate: false}, error = null) {
  const calls = [];
  const options = {environment, createClient: () => ({rpc: async (name, input) => {calls.push({name, input}); return {data, error};}})};
  return {calls, options};
}
const website = {method: 'POST', body: inquiry, idempotencyKey: 'synthetic-request'};
const make = {method: 'POST', action: 'claim', body: {}, authorization: `Bearer ${environment.MAKE_INTAKE_TOKEN}`};

test('website acceptance requires durable queue acknowledgement and preserves exact text', async () => {
  const {calls, options} = fixture();
  const result = await receiveWebsiteIntake(website, options);
  assert.equal(result.status, 202);
  assert.equal(result.body.processingStatus, 'queued');
  assert.equal(calls[0].name, 'stage_source_inquiry');
  assert.equal(calls[0].input.inquiry.message, inquiry.message);
  assert.equal(calls[0].input.source_key_hash, createHash('sha256').update(environment.INTAKE_SOURCE_TOKEN).digest('hex'));
  assert.equal(JSON.stringify(result).includes(inquiry.email), false);
});

test('direct Supabase mode stores canonically without Make and returns an idempotent receipt', async () => {
  const stored = {id: deliveryId, status: 'stored', sourceInquiryId: website.idempotencyKey, duplicate: false};
  const {calls, options} = fixture(stored);
  options.environment = {...environment, INTAKE_PROVIDER: 'supabase-direct', MAKE_INTAKE_ENABLED: 'false'};
  const result = await receiveWebsiteIntake(website, options);
  assert.equal(result.status, 201);
  assert.equal(result.body.accepted, true);
  assert.equal(result.body.status, 'stored');
  assert.equal(calls[0].name, 'ingest_source_inquiry');
  assert.equal(calls[0].input.inquiry.message, inquiry.message);
  assert.equal(JSON.stringify(result).includes(inquiry.email), false);

  const replay = fixture({...stored, duplicate: true});
  replay.options.environment = options.environment;
  const duplicate = await receiveWebsiteIntake(website, replay.options);
  assert.equal(duplicate.status, 200);
  assert.equal(duplicate.body.id, deliveryId);
  assert.equal(duplicate.body.duplicate, true);
});

test('website legacy timestamp is ignored rather than rejected or trusted', async () => {
  const {calls, options} = fixture();
  const requestWithTimestamp = {...website, body: {...inquiry, submittedAt: '2000-01-01T00:00:00.000Z'}};
  const result = await receiveWebsiteIntake(requestWithTimestamp, options);
  assert.equal(result.status, 202);
  assert.equal(Object.hasOwn(calls[0].input.inquiry, 'submittedAt'), false);
  assert.equal(calls[0].input.inquiry.message, inquiry.message);
});

test('direct Supabase mode remains fail-closed until the intake network gate is enabled', async () => {
  const {calls, options} = fixture({id: deliveryId, status: 'stored', duplicate: false});
  options.environment = {...environment, INTAKE_PROVIDER: 'supabase-direct', ALLOW_INTAKE_NETWORK: 'false'};
  assert.equal((await receiveWebsiteIntake(website, options)).status, 503);
  assert.equal(calls.length, 0);
});

test('missing key, tenant injection, malformed or oversized requests never reach storage', async () => {
  const {calls, options} = fixture();
  for (const change of [{idempotencyKey: undefined}, {body: {...inquiry, workspace_id: 'foreign'}}, {body: {...inquiry, message: ' '}},
    {body: {...inquiry, message: 'x'.repeat(12001)}}, {body: 'not-json'}, {body: []}, {body: {...inquiry, email: 'bad'}}]) {
    assert.equal((await receiveWebsiteIntake({...website, ...change}, options)).status, 400);
  }
  assert.equal(calls.length, 0);
});

test('unknown provider, failed delivery, invalid configuration and outages cannot claim success', async () => {
  for (const change of [{INTAKE_PROVIDER: 'typo'}, {SUPABASE_URL: 'https://foreign.example.test'}, {ALLOW_INTAKE_NETWORK: 'false'},
    {INTAKE_SOURCE_TOKEN: ''}, {INTAKE_ENVIRONMENT: 'production', SUPABASE_URL: 'http://127.0.0.1:54321'}]) {
    const {calls, options} = fixture();
    options.environment = {...environment, ...change};
    assert.equal((await receiveWebsiteIntake(website, options)).status, 503);
    assert.equal(calls.length, 0);
  }
  assert.equal((await receiveWebsiteIntake(website, fixture({id: deliveryId, status: 'failed'}).options)).status, 503);
  assert.equal((await receiveWebsiteIntake(website, fixture(null, {message: 'Sensitive provider output'}).options)).status, 503);
});

test('storage conflicts, rate limits and invalid requests are safe and truthful', async () => {
  for (const [code, status] of [['P0409',409], ['P0429',429], ['22023',400]]) {
    const result = await receiveWebsiteIntake(website, fixture(null, {code, message: 'Sensitive text'}).options);
    assert.equal(result.status, status);
    assert.equal(JSON.stringify(result).includes('Sensitive'), false);
  }
});

test('Make authentication and exact callback shape prevent forged tenant/payload changes', async () => {
  const {calls, options} = fixture();
  assert.equal((await receiveMakeIntake({...make, authorization: 'Bearer incorrect'}, options)).status, 401);
  assert.equal((await receiveMakeIntake({...make, body: {workspaceId: 'foreign'}}, options)).status, 400);
  assert.equal((await receiveMakeIntake({...make, action: 'complete', body: {deliveryId, leaseToken, inquiry}}, options)).status, 400);
  assert.equal((await receiveMakeIntake({...make, action: 'complete', body: {deliveryId: 'wrong', leaseToken}}, options)).status, 400);
  assert.equal(calls.length, 0);
});

test('Make claim is opaque and completion passes only fenced identifiers', async () => {
  const claimed = fixture({status: 'claimed', deliveryId, leaseToken, sourceInquiryId: 'synthetic-request'});
  assert.equal((await receiveMakeIntake(make, claimed.options)).body.leaseToken, leaseToken);
  assert.deepEqual(claimed.calls[0], {name: 'claim_intake_delivery', input: undefined});
  const stored = fixture({status: 'stored', id: 'canonical-inquiry', duplicate: false});
  const result = await receiveMakeIntake({...make, action: 'complete', body: {deliveryId, leaseToken}}, stored.options);
  assert.equal(result.body.status, 'stored');
  assert.deepEqual(stored.calls[0], {name: 'complete_intake_delivery', input: {record_delivery: deliveryId, token: leaseToken}});
  assert.equal((await receiveMakeIntake(make, fixture(null).options)).body.status, 'idle');
});

test('Make routing is disabled unless explicitly enabled and never falls back to Apps Script', async () => {
  const {calls, options} = fixture();
  options.environment = {...environment, MAKE_INTAKE_ENABLED: 'false'};
  assert.equal((await receiveMakeIntake(make, options)).status, 503);
  assert.equal(calls.length, 0);
  assert.equal((await receiveMakeIntake({...make, action: 'retry'}, options)).status, 404);
  assert.equal((await receiveMakeIntake({...make, method: 'GET'}, options)).status, 405);
});

test('acknowledgements whitelist safe fields and cannot leak unexpected database payloads', async () => {
  const staged = fixture({id: deliveryId, status: 'queued', duplicate: false, email: 'private@example.test'});
  assert.equal(JSON.stringify(await receiveWebsiteIntake(website, staged.options)).includes('private@example.test'), false);
  const claimed = fixture({status: 'claimed', deliveryId, leaseToken, sourceInquiryId: 'synthetic-request', inquiry});
  assert.equal(JSON.stringify(await receiveMakeIntake(make, claimed.options)).includes(inquiry.email), false);
  assert.equal((await receiveMakeIntake(make, fixture({status: 'claimed', deliveryId: 'bad', leaseToken}).options)).status, 503);
});

test('Apps Script fallback JSON uses supported ContentService APIs without fabricated CORS/status headers', () => {
  const context = {ContentService: {MimeType: {JSON: 'application/json'}, createTextOutput: text => ({text, setMimeType() {return this;}})}};
  runInNewContext(readFileSync(new URL('../appscript/InquiryPipeline.gs', import.meta.url), 'utf8'), context);
  assert.deepEqual(JSON.parse(context.jsonResponse({success: false, error: 'Synthetic failure'}, 503).text), {success: false, error: 'Synthetic failure'});
});
