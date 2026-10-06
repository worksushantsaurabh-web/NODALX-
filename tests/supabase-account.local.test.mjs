import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readLocalSupabaseConfig} from '../scripts/local-supabase.mjs';
import {createClient} from '@supabase/supabase-js';
import {receiveAccountRequest} from '../server/supabase-account.mjs';
import {receiveWorkspaceRequest} from '../server/supabase-workspace.mjs';

test('local Supabase auth, profile, feedback and two-tenant boundaries', {skip: process.env.TEST_LOCAL_SUPABASE !== 'true'}, async () => {
  const config = readLocalSupabaseConfig();
  assert.equal(new URL(config.API_URL).hostname, '127.0.0.1');
  const options = {auth: {persistSession: false, autoRefreshToken: false}};
  const admin = createClient(config.API_URL, config.SERVICE_ROLE_KEY, options);
  const environment = {SUPABASE_URL: config.API_URL, SUPABASE_PUBLISHABLE_KEY: config.PUBLISHABLE_KEY};
  const clients = [];
  for (let index = 0; index < 2; index++) {
    const client = createClient(config.API_URL, config.PUBLISHABLE_KEY, options);
    const email = `migration-${crypto.randomUUID()}@example.test`;
    const link = await admin.auth.admin.generateLink({type: 'signup', email, password: 'Local-test-only-Password42!', options: {data: {workspace_id: 'forged-workspace'}}});
    assert.equal(link.error, null);
    const verified = await client.auth.verifyOtp({token_hash: link.data.properties.hashed_token, type: 'signup'});
    assert.equal(verified.error, null);
    clients.push(client);
  }
  const request = async (client, route, method, body) => {
    const {data} = await client.auth.getSession();
    return receiveAccountRequest({route, method, body, authorization: `Bearer ${data.session.access_token}`}, {environment});
  };
  const a = await request(clients[0], 'profile', 'GET');
  const b = await request(clients[1], 'profile', 'GET');
  assert.equal(a.status, 200); assert.equal(b.status, 200);
  assert.notEqual(a.body.uid, b.body.uid);
  const binding = await clients[1].from('identity_bindings').select('workspace_id').single();
  const foreign = await clients[0].from('profiles').select('*').eq('workspace_id', binding.data.workspace_id);
  assert.equal(foreign.error, null); assert.deepEqual(foreign.data, []);
  const escalation = await request(clients[0], 'profile', 'PUT', {tier: 'growth', workspaceId: binding.data.workspace_id});
  assert.equal(escalation.status, 400);
  const updated = await request(clients[0], 'profile', 'PUT', {displayName: 'Synthetic local user'});
  assert.equal(updated.status, 200); assert.equal(updated.body.displayName, 'Synthetic local user');
  const saved = await request(clients[0], 'feedback', 'POST', {type: 'widget', category: 'general', message: 'Synthetic local test', page: '/dashboard'});
  assert.equal(saved.status, 201); assert.equal(saved.body.saved, true);
  const ownBinding = await clients[0].from('identity_bindings').select('workspace_id').single();
  const seeded = await admin.from('inquiries').insert([
    {workspace_id: ownBinding.data.workspace_id, id: 'local-a1', original_message: 'Original message 1'},
    {workspace_id: ownBinding.data.workspace_id, id: 'local-a2', original_message: 'Original message 2'},
    {workspace_id: binding.data.workspace_id, id: 'foreign-b', original_message: 'Foreign inquiry'},
  ]);
  assert.equal(seeded.error, null);
  const workspaceRequest = async (path, method = 'GET', body) => {
    const {data} = await clients[0].auth.getSession();
    return receiveWorkspaceRequest({path, method, body, authorization: `Bearer ${data.session.access_token}`}, {environment});
  };
  const firstPage = await workspaceRequest('/api/workspace/inquiries?limit=1');
  assert.equal(firstPage.status, 200); assert.equal(firstPage.body.records.length, 1);
  assert.ok(firstPage.body.nextCursor); assert.equal(firstPage.body.records[0].message, 'Original message 2');
  const secondPage = await workspaceRequest(`/api/workspace/inquiries?limit=1&cursor=${firstPage.body.nextCursor}`);
  assert.equal(secondPage.body.records[0].id, 'local-a1'); assert.equal(secondPage.body.nextCursor, null);
  assert.equal((await workspaceRequest(`/api/workspace/inquiries?cursor=${Buffer.from('foreign-b').toString('base64url')}`)).status, 400);
  assert.equal((await workspaceRequest('/api/inquiries/foreign-b/status', 'PATCH', {status: 'Won'})).status, 404);
  assert.equal((await workspaceRequest('/api/inquiries/%ZZ/status', 'PATCH', {status: 'Won'})).status, 400);
  assert.equal((await workspaceRequest('/api/inquiries/local-a1/status', 'PATCH', {status: 'Contacted'})).status, 200);
  assert.equal((await workspaceRequest('/api/workspace/inquiries/local-a1', 'PATCH', {note: 'Recorded local follow-up', followUpAt: 1000})).status, 200);
  const activity = await workspaceRequest('/api/workspace/inquiries/local-a1/activity');
  assert.equal(activity.body.note, 'Recorded local follow-up'); assert.equal(activity.body.events.length, 2);
  assert.equal((await workspaceRequest('/api/workspace/overview?days=30')).body.total, 2);
  assert.equal((await workspaceRequest('/api/workspace/settings', 'PUT', {criteria: 'Owned criteria'})).status, 200);
  assert.equal((await workspaceRequest('/api/workspace/settings')).body.criteria, 'Owned criteria');
  const usage = await workspaceRequest('/api/workspace/usage');
  assert.equal(usage.body.limits.credits, 50); assert.equal(usage.body.workflowConfigured, false);
  assert.equal((await workspaceRequest('/api/workspace/inquiries/local-a1/analyze', 'POST', {})).status, 503);
  assert.equal((await workspaceRequest('/api/workspace/inquiries/foreign-b/analyze', 'POST', {})).status, 404);
  assert.equal((await workspaceRequest('/api/workspace/inquiries/local-a1/analyze', 'POST', {workspaceId: 'forged'})).status, 400);
  const listedJobs = await workspaceRequest('/api/workspace/jobs');
  assert.equal(listedJobs.status, 200); assert.deepEqual(listedJobs.body.jobs, []);
  assert.equal((await workspaceRequest('/api/workspace/jobs/missing-job')).status, 404);
  const readiness = await workspaceRequest('/api/health/ready');
  assert.equal(readiness.body.status, 'partial');
  assert.equal(readiness.body.services.processing, false);
  assert.equal((await workspaceRequest('/api/workspace/checkout', 'POST', {plan: 'growth'})).status, 503);
  const foreignAfter = await admin.from('inquiries').select('status').eq('workspace_id', binding.data.workspace_id).eq('id', 'foreign-b').single();
  assert.equal(foreignAfter.data.status, 'new');
  let limited = false;
  for (let index = 0; index < 21; index++) {
    const result = await request(clients[0], 'profile', 'PUT', {displayName: 'Bounded local update'});
    if (result.status === 429) {limited = true; break;}
    assert.equal(result.status, 200);
  }
  assert.equal(limited, true, 'profile updates must hit the durable database rate limit');
  const anonymous = await receiveAccountRequest({route: 'profile', method: 'GET'}, {environment});
  assert.equal(anonymous.status, 401);
  const forged = await receiveAccountRequest({route: 'profile', method: 'GET', authorization: 'Bearer forged.invalid.token'}, {environment});
  assert.equal(forged.status, 401);
  const refreshed = await clients[0].auth.refreshSession();
  assert.equal(refreshed.error, null);
  assert.equal((await request(clients[0], 'profile', 'GET')).status, 200);
  const user = await clients[0].auth.getUser();
  const recovery = await admin.auth.admin.generateLink({type: 'recovery', email: user.data.user.email});
  assert.equal(recovery.error, null);
  const recovered = await clients[0].auth.verifyOtp({token_hash: recovery.data.properties.hashed_token, type: 'recovery'});
  assert.equal(recovered.error, null);
  const password = 'Recovered-local-only-Password42!';
  assert.equal((await clients[0].auth.updateUser({password})).error, null);
  await clients[0].auth.signOut();
  assert.equal((await clients[0].auth.getSession()).data.session, null);
  assert.equal((await clients[0].auth.signInWithPassword({email: user.data.user.email, password})).error, null);
  await clients[0].auth.signOut();
  await clients[1].auth.signOut();
});
