import {test} from 'node:test';
import assert from 'node:assert/strict';
import {receiveMakeRequest} from '../server/make-processing.mjs';

const environment = {MAKE_PROCESSING_ENABLED: 'true', MAKE_PROCESSING_TOKEN: 'synthetic-token-'.repeat(3),
  MAKE_RECEIPT_SECRET: 'synthetic-signing-'.repeat(3), PROCESSING_ENVIRONMENT: 'staging',
  SUPABASE_URL: 'https://synthetic.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'synthetic-service-role',
  ALLOW_PROCESSING_NETWORK: 'true', GEMINI_MODEL: 'gemini-synthetic', GEMINI_DATA_APPROVAL: 'synthetic-only'};
const output = {intent: 'general', urgency: 'unknown', category: 'unknown', summary: 'Synthetic summary', suggested_action: 'Human review', fit_score: 50};
const envelope = result => ({candidates: [{finishReason: 'STOP', content: {parts: [{text: JSON.stringify(result)}]}}]});
function fixture({criteria = '', attempt = 1, claimError = null, idle = false} = {}) {
  const calls = [];
  let finished = false;
  const job = {workspaceId: 'owned-workspace', id: 'owned-job', leaseToken: 'synthetic-lease', attempt,
    input: {message: 'Synthetic "quotes"\nmessage', name: 'Private contact', email: 'private@example.test', criteria}};
  const options = {environment, now: () => 1000000, createClient: () => ({rpc: async (name, input) => {
    calls.push({name, input});
    if (name === 'claim_make_processing_job') return {data: idle ? null : job, error: claimError};
    const data = !finished;
    finished = true;
    return {data};
  }})};
  const request = (action, body = {}, changes = {}) => receiveMakeRequest({action, body, method: 'POST',
    authorization: `Bearer ${environment.MAKE_PROCESSING_TOKEN}`, ...changes}, options);
  return {calls, options, request};
}

test('claim minimizes contact data, builds escaped structured prompt and signs the lease', async () => {
  const {request, calls} = fixture();
  const result = await request('claim');
  assert.equal(result.status, 200);
  assert.equal(result.body.status, 'claimed');
  assert.equal(result.headers['Cache-Control'], 'no-store');
  assert.equal(calls[0].name, 'claim_make_processing_job');
  assert.equal(JSON.stringify(result.body).includes('private@example.test'), false);
  const data = JSON.parse(result.body.geminiRequest.contents[0].parts[0].text);
  assert.equal(data.message, 'Synthetic "quotes"\nmessage');
  assert.equal(result.body.geminiRequest.generationConfig.responseFormat.text.schema.properties.fit_score.maximum, 100);
});

test('completion uses signed ownership and lease, omits unsupported fit, and fences replay', async () => {
  const {request, calls} = fixture();
  const {receipt} = (await request('claim')).body;
  assert.equal((await request('complete', {receipt, response: envelope(output)})).body.status, 'completed');
  assert.equal(calls[1].input.owned_workspace, 'owned-workspace');
  assert.equal(calls[1].input.token, 'synthetic-lease');
  assert.equal(calls[1].input.output.fit_score, undefined);
  assert.equal((await request('complete', {receipt, response: envelope(output)})).status, 409);
});

test('criteria-backed scores persist and failure callbacks release rather than charge', async () => {
  for (const result of [output, null]) {
    const {request, calls} = fixture({criteria: 'Synthetic criterion'});
    const {receipt} = (await request('claim')).body;
    assert.equal((await request('complete', result ? {receipt, response: envelope(result)} : {receipt, failed: true})).status, 200);
    assert.deepEqual(calls[1].input.output, result);
  }
});

test('auth, disabled configuration, methods and tenant injection fail before database access', async () => {
  const {request, calls, options} = fixture();
  assert.equal((await request('claim', {}, {authorization: 'Bearer incorrect'})).status, 401);
  assert.equal((await request('claim', {}, {method: 'GET'})).status, 405);
  assert.equal((await request('unknown')).status, 404);
  for (const body of [{workspaceId: 'foreign'}, 'not-json', 'x'.repeat(49153), []]) assert.equal((await request('claim', body)).status, 400);
  options.environment = {...environment, MAKE_PROCESSING_ENABLED: 'false'};
  assert.equal((await request('claim')).status, 503);
  assert.equal(calls.length, 0);
});

test('invalid, tampered and expired receipts and malformed output never settle', async () => {
  const {request, calls, options} = fixture();
  const {receipt} = (await request('claim')).body;
  const [payload, signature] = receipt.split('.');
  const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString());
  decoded.workspace = 'foreign';
  const tampered = `${Buffer.from(JSON.stringify(decoded)).toString('base64url')}.${signature}`;
  for (const value of ['bad', tampered]) assert.equal((await request('complete', {receipt: value, response: envelope(output)})).status, 409);
  for (const value of [{summary: 'Incomplete'}, {...output, fit_score: 101}, {classification: output}, {...output, workspaceId: 'foreign'}]) {
    assert.equal((await request('complete', {receipt, response: envelope(value)})).status, 400);
  }
  options.now = () => 1110001;
  assert.equal((await request('complete', {receipt, response: envelope(output)})).status, 409);
  assert.equal(calls.length, 1);
});

test('idle, rate-limited, exhausted and invalid jobs have no provider call', async () => {
  assert.equal((await fixture({idle: true}).request('claim')).body.status, 'idle');
  assert.equal((await fixture({claimError: {code: 'P0429'}}).request('claim')).status, 429);
  const {request, calls} = fixture({attempt: 4});
  assert.equal((await request('claim')).body.status, 'rejected');
  assert.equal(calls[1].input.output, null);
});

test('production requires privacy approval and storage failures are redacted', async () => {
  const {request, options, calls} = fixture();
  options.environment = {...environment, PROCESSING_ENVIRONMENT: 'production'};
  assert.equal((await request('claim')).status, 503);
  assert.equal(calls.length, 0);
  options.environment = environment;
  options.createClient = () => ({rpc: async () => {throw new Error('Sensitive credentials and customer text');}});
  const result = await request('claim');
  assert.equal(result.status, 503);
  assert.equal(JSON.stringify(result).includes('Sensitive'), false);
});

test('blocked, truncated, tool, blank, malformed and ambiguous completion cannot succeed', async () => {
  const {request, calls} = fixture();
  const {receipt} = (await request('claim')).body;
  for (const response of [{promptFeedback: {blockReason: 'SAFETY'}},
    {candidates: [{finishReason: 'MAX_TOKENS'}]},
    {candidates: [{finishReason: 'STOP', content: {parts: [{functionCall: {name: 'unsupported'}}]}}]},
    envelope({...output, summary: ''}), {candidates: [{finishReason: 'STOP', content: {parts: [{text: 'invalid JSON'}]}}]}]) {
    assert.equal((await request('complete', {receipt, response})).status, 400);
  }
  assert.equal((await request('complete', {receipt, response: envelope(output), failed: true})).status, 400);
  assert.equal((await request('complete', {receipt})).status, 400);
  assert.equal(calls.length, 1);
});
