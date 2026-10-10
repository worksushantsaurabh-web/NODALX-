import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash, randomBytes, randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createClient} from '@supabase/supabase-js';
import {localToolEnvironment} from '../scripts/local-supabase.mjs';
import {readTestTargetConfig, createHostedSql} from '../scripts/test-target.mjs';
import {receiveWebsiteIntake, receiveMakeIntake} from '../server/intake-router.mjs';
import {receiveAccountRequest} from '../server/supabase-account.mjs';
import {receiveWorkspaceRequest} from '../server/supabase-workspace.mjs';

test('direct intake stores once, preserves text, separates tenants and needs no Make',
  {skip: process.env.TEST_LOCAL_INTAKE_E2E !== 'true'}, async () => {
    const config = readTestTargetConfig();
    const hosted = config.mode === 'hosted-rds';
    const authOptions = {auth: {persistSession: false, autoRefreshToken: false}};
    const admin = createClient(config.API_URL, config.SERVICE_ROLE_KEY, authOptions);
    const accounts = [];
    const sql = hosted
      ? await createHostedSql(config)
      : async statement => execFileSync('docker', ['exec', '-i', 'supabase_db_NODALXAI', 'psql', '-U', 'postgres', '-d', 'postgres', '-At', '-v', 'ON_ERROR_STOP=1'],
        {input: statement, env: localToolEnvironment(), encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe']});
    try {
      if (!hosted) assert.equal(new URL(config.API_URL).hostname, '127.0.0.1');
      const source = randomBytes(32).toString('base64url');
      const hash = createHash('sha256').update(source).digest('hex');
      const environment = hosted
        ? {DATA_BACKEND: 'rds', RDS_DATABASE_URL: config.RDS_DATABASE_URL, INTAKE_PROVIDER: 'rds-direct',
          RDS_INTAKE_ENABLED: 'true', INTAKE_ENVIRONMENT: 'staging', ALLOW_INTAKE_NETWORK: 'true',
          INTAKE_SOURCE_TOKEN: source, MAKE_INTAKE_ENABLED: 'false', SUPABASE_URL: config.API_URL,
          SUPABASE_SERVICE_ROLE_KEY: config.SERVICE_ROLE_KEY, SUPABASE_PUBLISHABLE_KEY: config.PUBLISHABLE_KEY,
          OUTBOUND_EMAIL_ENABLED: 'false'}
        : {INTAKE_PROVIDER: 'supabase-direct', INTAKE_ENVIRONMENT: 'local', ALLOW_INTAKE_NETWORK: 'true',
          INTAKE_SOURCE_TOKEN: source, MAKE_INTAKE_ENABLED: 'false', SUPABASE_URL: config.API_URL,
          SUPABASE_SERVICE_ROLE_KEY: config.SERVICE_ROLE_KEY, SUPABASE_PUBLISHABLE_KEY: config.PUBLISHABLE_KEY,
          OUTBOUND_EMAIL_ENABLED: 'false'};
      for (let index = 0; index < 2; index++) {
        const client = createClient(config.API_URL, config.PUBLISHABLE_KEY, authOptions);
        const email = `direct-${randomUUID()}@example.test`;
        const created = await admin.auth.admin.createUser({email, password: randomBytes(32).toString('base64url'), email_confirm: true});
        assert.equal(created.error, null);
        const account = {client, id: created.data.user.id};
        accounts.push(account);
        const link = await admin.auth.admin.generateLink({type: 'magiclink', email: created.data.user.email});
        assert.equal(link.error, null);
        const verified = await client.auth.verifyOtp({type: 'magiclink', token_hash: link.data.properties.hashed_token});
        assert.equal(verified.error, null);
        account.token = verified.data.session.access_token;
        if (hosted) {
          const profile = await receiveAccountRequest({route: 'profile', method: 'GET', authorization: `Bearer ${account.token}`}, {environment});
          assert.equal(profile.status, 200);
          account.workspace = (await sql(`SELECT workspace_id FROM identity_bindings WHERE auth_user_id='${account.id}'`)).trim();
        } else {
          const binding = await client.rpc('bootstrap_workspace');
          assert.equal(binding.error, null);
          account.workspace = binding.data;
        }
        assert.ok(account.workspace);
      }
      await sql(`INSERT INTO private.intake_sources(workspace_id,secret_hash,enabled,source_kind) VALUES ('${accounts[0].workspace}','${hash}',true,'website')`);
      const inquiry = {name: 'Synthetic direct test', company: 'Synthetic company', email: 'synthetic-repeat@example.test', message: '  Original "quoted"\ntext preserved  '};
      const submit = (id, body = inquiry) => receiveWebsiteIntake({method: 'POST', body, idempotencyKey: id}, {environment});
      const read = account => receiveWorkspaceRequest({path: '/api/workspace/inquiries', method: 'GET', authorization: `Bearer ${account.token}`}, {environment});
      const results = await Promise.all(Array.from({length: 8}, () => submit('synthetic-direct-one')));
      assert.ok(results.every(result => [200, 201].includes(result.status)), JSON.stringify(results.map(result => ({status: result.status, code: result.body.code}))));
      assert.equal(results.filter(result => result.status === 201).length, 1);
      const id = results[0].body.id;
      assert.equal(new Set(results.map(result => result.body.id)).size, 1);
      assert.equal((await submit('synthetic-direct-one', {...inquiry, message: 'Changed payload'})).status, 409);
      const repeat = await submit('synthetic-direct-two');
      assert.equal(repeat.status, 201);
      assert.notEqual(repeat.body.id, id);
      const own = await read(accounts[0]);
      assert.equal(own.status, 200);
      assert.equal(own.body.records.length, 2);
      assert.ok(own.body.records.every(row => row.message === inquiry.message));
      assert.ok(own.body.records.some(row => row.id === id));
      const originals = hosted
        ? await sql.json(`SELECT coalesce(json_agg(source_reference),'[]') FROM public.inquiries WHERE workspace_id='${accounts[0].workspace}'`)
        : (await admin.from('inquiries').select('source_reference').eq('workspace_id', accounts[0].workspace)).data.map(row => row.source_reference);
      assert.ok(originals.length >= 2);
      assert.ok(originals.every(reference => reference && reference.kind === 'website'));
      const overview = await receiveWorkspaceRequest({path: '/api/workspace/overview', method: 'GET', authorization: `Bearer ${accounts[0].token}`}, {environment});
      assert.equal(overview.status, 200);
      assert.equal(overview.body.sources.website, 2);
      assert.equal((await read(accounts[1])).body.records.length, 0);
      const denied = await receiveWorkspaceRequest({path: `/api/workspace/inquiries/${id}`, method: 'PATCH',
        authorization: `Bearer ${accounts[1].token}`, body: {status: 'Contacted'}}, {environment});
      assert.ok([403, 404].includes(denied.status));
      assert.equal((await sql(`SELECT count(*) FROM private.intake_deliveries WHERE workspace_id='${accounts[0].workspace}'`)).trim(), '0');
      await sql(`UPDATE private.intake_sources SET enabled=false WHERE secret_hash='${hash}'`);
      assert.ok((await submit('synthetic-direct-disabled')).status >= 400);
    } finally {
      for (const account of accounts) {
        if (account.workspace) {
          if (hosted) {
            for (const statement of [
              `DELETE FROM public.inquiry_events WHERE workspace_id='${account.workspace}'`,
              `DELETE FROM public.outbound_emails WHERE workspace_id='${account.workspace}'`,
              `DELETE FROM public.inquiries WHERE workspace_id='${account.workspace}'`,
              `DELETE FROM public.notification_settings WHERE workspace_id='${account.workspace}'`,
              `DELETE FROM public.subscriptions WHERE workspace_id='${account.workspace}'`,
              `DELETE FROM public.profiles WHERE workspace_id='${account.workspace}'`,
              `DELETE FROM public.identity_bindings WHERE workspace_id='${account.workspace}' OR auth_user_id='${account.id}'`,
              `DELETE FROM private.intake_sources WHERE workspace_id='${account.workspace}'`,
              `DELETE FROM public.workspaces WHERE id='${account.workspace}'`,
            ]) await sql(statement);
          } else {
            for (const table of ['inquiry_events', 'inquiries', 'notification_settings', 'subscriptions', 'profiles', 'identity_bindings']) {
              assert.equal((await admin.from(table).delete().eq('workspace_id', account.workspace)).error, null);
            }
            await sql(`DELETE FROM private.intake_sources WHERE workspace_id='${account.workspace}'`);
            assert.equal((await admin.from('workspaces').delete().eq('id', account.workspace)).error, null);
          }
        }
        await account.client.auth.signOut();
        assert.equal((await admin.auth.admin.deleteUser(account.id)).error, null);
      }
      if (hosted) await sql.close();
    }
  });

test('local website -> opaque Make handoff -> canonical Supabase -> owned dashboard read',
  {skip: process.env.TEST_LOCAL_INTAKE_E2E !== 'true' || process.env.TEST_TARGET === 'hosted-rds'}, async () => {
    const config = readTestTargetConfig();
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
      assert.match(displayed.body.notice, /New website inquiries are stored directly/);
      assert.match(displayed.body.notice, /Historical Google Sheet inquiries are not migrated automatically/);
      assert.equal((await make('claim')).body.status, 'idle');
    } finally {
      sql(`DELETE FROM private.intake_deliveries WHERE workspace_id = '${workspace}'; DELETE FROM private.intake_delivery_gates WHERE source_binding_id IN (SELECT id FROM private.intake_sources WHERE workspace_id = '${workspace}')`);
      assert.equal((await admin.from('inquiries').delete().eq('workspace_id', workspace)).error, null);
      sql(`DELETE FROM private.intake_sources WHERE workspace_id = '${workspace}'`);
      await owner.auth.signOut();
    }
  });
