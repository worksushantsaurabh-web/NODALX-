import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash, randomBytes, randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createClient} from '@supabase/supabase-js';
import {readLocalSupabaseConfig, localToolEnvironment} from '../scripts/local-supabase.mjs';
import {receiveWebsiteIntake, receiveMakeIntake} from '../server/intake-router.mjs';
import {receiveWorkspaceRequest} from '../server/supabase-workspace.mjs';

test('local website -> opaque Make handoff -> canonical Supabase -> owned dashboard read',
  {skip: process.env.TEST_LOCAL_INTAKE_E2E !== 'true'}, async () => {
    const config = readLocalSupabaseConfig();
    const authOptions = {auth: {persistSession: false, autoRefreshToken: false}};
    const admin = createClient(config.API_URL, config.SERVICE_ROLE_KEY, authOptions);
    const owner = createClient(config.API_URL, config.PUBLISHABLE_KEY, authOptions);
    const link = await admin.auth.admin.generateLink({type: 'signup', email: `intake-e2e-${randomUUID()}@example.test`, password: 'Synthetic-local-Password42!'});
    assert.equal(link.error, null);
    const verified = await owner.auth.verifyOtp({type: 'signup', token_hash: link.data.properties.hashed_token});
    assert.equal(verified.error, null);
    const binding = await owner.rpc('bootstrap_workspace');
    assert.equal(binding.error, null);
    const workspace = binding.data;
    const sourceToken = randomBytes(32).toString('base64url');
    const sourceHash = createHash('sha256').update(sourceToken).digest('hex');
    const environment = {INTAKE_PROVIDER: 'make-supabase', INTAKE_ENVIRONMENT: 'local', ALLOW_INTAKE_NETWORK: 'true',
      INTAKE_SOURCE_TOKEN: sourceToken, MAKE_INTAKE_ENABLED: 'true', MAKE_INTAKE_TOKEN: randomBytes(32).toString('base64url'),
      SUPABASE_URL: config.API_URL, SUPABASE_SERVICE_ROLE_KEY: config.SERVICE_ROLE_KEY};
    const sql = statement => execFileSync('docker', ['exec','supabase_db_NODALXAI','psql','-U','postgres','-d','postgres','-At','-v','ON_ERROR_STOP=1','-c',statement],
      {env: localToolEnvironment(), encoding: 'utf8', stdio: ['ignore','pipe','pipe']});
    const inquiry = {name: 'Synthetic customer', email: 'synthetic-repeat@example.test', company: 'Synthetic company', message: '  Exact "quoted"\noriginal text  '};
    const submit = (requestKey, body = inquiry) => receiveWebsiteIntake({method: 'POST', body, idempotencyKey: requestKey}, {environment});
    const make = (action, body = {}) => receiveMakeIntake({action, method: 'POST', body,
      authorization: `Bearer ${environment.MAKE_INTAKE_TOKEN}`}, {environment});
    const dashboard = () => receiveWorkspaceRequest({path: '/api/workspace/inquiries', method: 'GET', authorization: `Bearer ${verified.data.session.access_token}`},
      {environment: {...environment, SUPABASE_PUBLISHABLE_KEY: config.PUBLISHABLE_KEY}});
    try {
      assert.equal(sql("SELECT count(*) FROM private.intake_deliveries WHERE state IN ('queued','processing')").trim(), '0', 'requires an idle local transport queue');
      sql(`INSERT INTO private.intake_sources(workspace_id,secret_hash,enabled) VALUES ('${workspace}','${sourceHash}',true)`);
      const submissions = await Promise.all(Array.from({length: 8}, () => submit('local-e2e-one')));
      assert.ok(submissions.every(result => result.status === 202 && result.body.processingStatus === 'queued'));
      assert.equal(new Set(submissions.map(result => result.body.id)).size, 1);
      assert.equal(submissions.filter(result => !result.body.duplicate).length, 1);
      assert.equal((await dashboard()).body.records.length, 0);
      assert.equal((await submit('local-e2e-one', {...inquiry, message: 'Changed'})).status, 409);
      const claimed = await make('claim');
      assert.equal(claimed.body.status, 'claimed');
      assert.equal(JSON.stringify(claimed.body).includes(inquiry.email), false);
      const callback = {deliveryId: claimed.body.deliveryId, leaseToken: claimed.body.leaseToken};
      const stored = await make('complete', callback);
      assert.equal(stored.body.status, 'stored');
      const replay = await make('complete', callback);
      assert.equal(replay.body.id, stored.body.id);
      assert.equal(replay.body.duplicate, true);
      assert.equal((await submit('local-e2e-one')).body.processingStatus, 'stored');
      assert.equal((await submit('local-e2e-two')).status, 202);
      const next = await make('claim');
      assert.equal((await make('complete', {deliveryId: next.body.deliveryId, leaseToken: next.body.leaseToken})).body.status, 'stored');
      const displayed = await dashboard();
      assert.equal(displayed.status, 200);
      assert.equal(displayed.body.records.length, 2);
      assert.ok(displayed.body.records.every(row => row.message === inquiry.message && row.email === inquiry.email));
      assert.match(displayed.body.notice, /Historical Google Sheet/);
      assert.equal((await make('claim')).body.status, 'idle');
    } finally {
      sql(`DELETE FROM private.intake_deliveries WHERE workspace_id = '${workspace}'; DELETE FROM private.intake_delivery_gates WHERE source_binding_id IN (SELECT id FROM private.intake_sources WHERE workspace_id = '${workspace}')`);
      assert.equal((await admin.from('inquiries').delete().eq('workspace_id', workspace)).error, null);
      sql(`DELETE FROM private.intake_sources WHERE workspace_id = '${workspace}'`);
      await owner.auth.signOut();
    }
  });
