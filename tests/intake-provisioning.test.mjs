import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prepareIntakeBinding} from '../scripts/setup-intake-bindings.mjs';

const environment = {INTAKE_ENVIRONMENT: 'staging', SUPABASE_EXPECTED_PROJECT_REF: 'abcdefghijklmnopqrst',
  SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'synthetic-public-key'};
const accessToken = 'synthetic-owner-session-for-tests';
const userId = '00000000-0000-4000-8000-000000000101';
function fixture(overrides = {}) {
  const calls = [];
  return {calls, createClient: () => ({auth: {getUser: async token => {
    calls.push(token);
    return {data: {user: {id: userId, email_confirmed_at: '2026-01-01', ...overrides}}, error: null};
  }}, from: table => ({select: columns => ({eq: (field, id) => ({single: async () => {
    calls.push({table, columns, field, id});
    return {data: {workspace_id: `supabase:${userId}`}, error: null};
  }})})})})};
}

test('source preparation derives ownership from verified identity and emits a disabled hashed binding', async () => {
  const options = fixture();
  const prepared = await prepareIntakeBinding({environment, accessToken, workspaceId: 'attacker'}, options);
  assert.match(prepared.sourceToken, /^[A-Za-z0-9_-]{43}$/);
  assert.ok(!prepared.sql.includes(prepared.sourceToken));
  assert.ok(!prepared.sql.includes(accessToken));
  assert.ok(prepared.sql.includes(`supabase:${userId}`));
  assert.match(prepared.sql, /ON CONFLICT \(secret_hash\) DO NOTHING/);
  assert.match(prepared.sql, /AND NOT enabled/);
  assert.ok(!prepared.sql.includes('attacker'));
  assert.deepEqual(options.calls[1], {table: 'identity_bindings', columns: 'workspace_id', field: 'auth_user_id', id: userId});
});

test('source preparation rejects production, wrong project and unverified or anonymous accounts', async () => {
  for (const changed of [{INTAKE_ENVIRONMENT: 'production'}, {SUPABASE_URL: 'https://wrong.supabase.co'},
    {SUPABASE_URL: `${environment.SUPABASE_URL}/?secret=anything`}]) {
    const options = fixture();
    await assert.rejects(prepareIntakeBinding({environment: {...environment, ...changed}, accessToken}, options));
    assert.equal(options.calls.length, 0);
  }
  for (const changed of [{email_confirmed_at: null}, {is_anonymous: true}]) {
    const options = fixture(changed);
    await assert.rejects(prepareIntakeBinding({environment, accessToken}, options));
    assert.equal(options.calls.length, 1);
  }
});

test('source preparation preserves an existing credential but refuses shared machine credentials', async () => {
  const token = 'synthetic-source-'.repeat(3);
  const prepared = await prepareIntakeBinding({environment: {...environment, INTAKE_SOURCE_TOKEN: token}, accessToken}, fixture());
  assert.equal(prepared.sourceToken, token);
  await assert.rejects(prepareIntakeBinding({environment: {...environment, INTAKE_SOURCE_TOKEN: token, MAKE_INTAKE_TOKEN: token}, accessToken}, fixture()));
});
