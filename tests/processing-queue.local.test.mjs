import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createClient} from '@supabase/supabase-js';
import {localToolEnvironment, readLocalSupabaseConfig} from '../scripts/local-supabase.mjs';
import {receiveWorkspaceRequest} from '../server/supabase-workspace.mjs';
import {runProcessingOnce} from '../server/processing-worker.mjs';
import {receiveMakeRequest} from '../server/make-processing.mjs';

test('disposable local processing: concurrent duplicates, quota and actual settlement', {skip: process.env.TEST_LOCAL_PROCESSING !== 'true'}, async () => {
  const config = readLocalSupabaseConfig();
  const sql = statement => execFileSync('docker', ['exec', 'supabase_db_NODALXAI', 'psql', '-U', 'postgres', '-d', 'postgres', '-At', '-v', 'ON_ERROR_STOP=1', '-c', statement],
    {env: localToolEnvironment(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']}).trim();
  assert.equal(sql('SELECT enabled FROM private.processing_configuration'), 'f', 'requires disabled local processing');
  assert.equal(sql("SELECT count(*) FROM public.jobs WHERE state IN ('queued','processing')"), '0', 'requires an idle disposable local queue');
  const options = {auth: {persistSession: false, autoRefreshToken: false}};
  const admin = createClient(config.API_URL, config.SERVICE_ROLE_KEY, options);
  const client = createClient(config.API_URL, config.PUBLISHABLE_KEY, options);
  const link = await admin.auth.admin.generateLink({type: 'signup', email: `queue-${crypto.randomUUID()}@example.test`, password: 'Local-test-only-Password42!'});
  assert.equal(link.error, null);
  const verified = await client.auth.verifyOtp({token_hash: link.data.properties.hashed_token, type: 'signup'});
  assert.equal(verified.error, null);
  assert.equal((await client.rpc('bootstrap_workspace')).error, null);
  const binding = await client.from('identity_bindings').select('workspace_id').single();
  assert.equal(binding.error, null);
  const workspace = binding.data.workspace_id;
  const inquiryIds = ['queue-first', 'queue-second'];
  assert.equal((await admin.from('inquiries').insert(inquiryIds.map(id => ({workspace_id: workspace, id, original_message: 'Synthetic queue integration original'})))).error, null);
  const authorization = `Bearer ${verified.data.session.access_token}`;
  const environment = {SUPABASE_URL: config.API_URL, SUPABASE_PUBLISHABLE_KEY: config.PUBLISHABLE_KEY};
  const request = (path, method = 'GET', body) => receiveWorkspaceRequest({path, method, body, authorization}, {environment});
  try {
    sql('UPDATE private.processing_configuration SET enabled = true');
    assert.equal((await admin.rpc('processing_worker_heartbeat', {worker_id: '00000000-0000-4000-8000-000000000041', is_ready: true})).error, null);
    const duplicates = await Promise.all(Array.from({length: 6}, () => request('/api/workspace/inquiries/queue-first/analyze', 'POST', {requestKey: 'duplicate-one'})));
    assert.ok(duplicates.every(response => response.status === 200));
    assert.equal(new Set(duplicates.map(response => response.body.id)).size, 1);
    assert.equal(duplicates.filter(response => !response.body.duplicate).length, 1);
    const jobId = duplicates[0].body.id;
    const usage = await client.from('usage_periods').select('used,reserved,active_jobs').single();
    assert.deepEqual(usage.data, {used: 0, reserved: 1, active_jobs: 1});
    assert.equal((await request('/api/workspace/inquiries/queue-second/analyze', 'POST', {requestKey: 'duplicate-one'})).status, 409);
    assert.equal((await request('/api/workspace/inquiries/queue-second/analyze', 'POST', {requestKey: 'new-second'})).status, 429);
    const settled = await runProcessingOnce({client: admin, processor: async (input, options) => {
      assert.equal(input.id, 'queue-first');
      assert.equal(options.idempotencyKey, jobId);
      return {summary: 'Synthetic integration result', fit_score: 20};
    }});
    assert.equal(settled.status, 'completed');
    const detail = await request(`/api/workspace/jobs/${jobId}`);
    assert.equal(detail.status, 200); assert.equal(detail.body.succeeded, 1);
    assert.equal(detail.body.rows[0].message, 'Synthetic queue integration original');
    assert.equal(detail.body.rows[0].summary, 'Synthetic integration result');
    const other = await admin.auth.admin.generateLink({type: 'signup', email: `queue-foreign-${crypto.randomUUID()}@example.test`, password: 'Local-test-only-Password42!'});
    const foreign = createClient(config.API_URL, config.PUBLISHABLE_KEY, options);
    const foreignVerified = await foreign.auth.verifyOtp({token_hash: other.data.properties.hashed_token, type: 'signup'});
    const foreignDetail = await receiveWorkspaceRequest({path: `/api/workspace/jobs/${jobId}`, method: 'GET', authorization: `Bearer ${foreignVerified.data.session.access_token}`}, {environment});
    assert.equal(foreignDetail.status, 404);
    assert.equal((await admin.from('usage_periods').update({used: 49}).eq('workspace_id', workspace)).error, null);
    const race = await Promise.all(inquiryIds.map((id, index) => request(`/api/workspace/inquiries/${id}/analyze`, 'POST', {requestKey: `credit-race-${index}`})));
    assert.equal(race.filter(response => response.status === 200).length, 1);
    assert.equal(race.filter(response => response.status === 429).length, 1);
    const failed = await runProcessingOnce({client: admin, processor: async () => {throw new Error('Synthetic provider failure');}});
    assert.equal(failed.status, 'failed');
    const after = await client.from('usage_periods').select('used,reserved,active_jobs').single();
    assert.deepEqual(after.data, {used: 49, reserved: 0, active_jobs: 0});
    assert.equal((await request('/api/workspace/inquiries/queue-first/analyze', 'POST', {requestKey: 'make-local-test'})).status, 200);
    const makeToken = 'synthetic-local-make-token-'.repeat(2);
    const makeOptions = {environment: {MAKE_PROCESSING_ENABLED: 'true', MAKE_PROCESSING_TOKEN: makeToken,
      MAKE_RECEIPT_SECRET: 'synthetic-local-signature-'.repeat(2), PROCESSING_ENVIRONMENT: 'staging',
      SUPABASE_URL: 'https://synthetic.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'synthetic-not-used',
      ALLOW_PROCESSING_NETWORK: 'true', GEMINI_MODEL: 'gemini-synthetic', GEMINI_DATA_APPROVAL: 'synthetic-only'}, createClient: () => admin};
    const makeRequest = (action, body) => receiveMakeRequest({action, method: 'POST', body,
      authorization: `Bearer ${makeToken}`}, makeOptions);
    const claimed = await makeRequest('claim', {});
    assert.equal(claimed.body.status, 'claimed');
    const completion = {receipt: claimed.body.receipt, response: {candidates: [{finishReason: 'STOP', content: {parts: [{text: JSON.stringify({
      intent: 'general', urgency: 'unknown', category: 'unknown', summary: 'Synthetic Make integration', suggested_action: 'Human review', fit_score: 99,
    })}]}}]}};
    assert.equal((await makeRequest('complete', completion)).body.status, 'completed');
    assert.equal((await makeRequest('complete', completion)).status, 409);
    const makeUsage = await client.from('usage_periods').select('used,reserved,active_jobs').single();
    assert.deepEqual(makeUsage.data, {used: 50, reserved: 0, active_jobs: 0});
    const original = await client.from('inquiries').select('original_message,payload').eq('id', 'queue-first').single();
    assert.equal(original.data.original_message, 'Synthetic queue integration original');
    assert.equal(original.data.payload.summary, 'Synthetic Make integration');
    assert.equal(original.data.payload.fit_score, undefined, 'stale scores are cleared when new analysis has no qualification evidence');
    await foreign.auth.signOut();
  } finally {
    sql('UPDATE private.processing_configuration SET enabled = false');
    await admin.rpc('processing_worker_heartbeat', {worker_id: '00000000-0000-4000-8000-000000000041', is_ready: false});
    await admin.rpc('processing_worker_heartbeat', {worker_id: '00000000-0000-4000-8000-000000000001', is_ready: false});
    await client.auth.signOut();
  }
});
