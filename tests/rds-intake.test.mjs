import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {receiveWebsiteIntake} from '../server/intake-router.mjs';

const token = 'synthetic-rds-source-token-'.repeat(2);
const environment = {
  DATA_BACKEND: 'rds', RDS_INTAKE_ENABLED: 'true', INTAKE_PROVIDER: 'rds-direct',
  RDS_DATABASE_URL: 'postgresql://postgres:placeholder@example.invalid:5432/postgres',
  INTAKE_ENVIRONMENT: 'staging', ALLOW_INTAKE_NETWORK: 'true', INTAKE_SOURCE_TOKEN: token,
};
const request = {method: 'POST', idempotencyKey: 'synthetic-rds-request', body: {
  name: 'Synthetic customer', email: 'synthetic@example.test', company: 'Synthetic',
  message: '  Exact original text\n', submittedAt: '2000-01-01T00:00:00.000Z',
}};
const stored = {id: '00000000-0000-4000-8000-000000000101', status: 'stored', duplicate: false};
function fixture(data = stored, error = null, override = {}) {
  const calls = [];
  const options = {environment: {...environment, ...override}, createClient: () => ({rpc: async (name, args) => {
    calls.push({name, args}); return {data, error};
  }})};
  return {calls, options};
}

test('RDS direct intake stores exact text and ignores the browser timestamp', async () => {
  const {calls, options} = fixture();
  const result = await receiveWebsiteIntake(request, options);
  assert.equal(result.status, 201);
  assert.equal(result.body.accepted, true);
  assert.equal(result.body.status, 'stored');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, 'ingest_source_inquiry');
  assert.equal(calls[0].args.source_key_hash, createHash('sha256').update(token).digest('hex'));
  assert.equal(calls[0].args.inquiry.message, request.body.message);
  assert.equal(Object.hasOwn(calls[0].args.inquiry, 'submittedAt'), false);
  assert.equal(JSON.stringify(result).includes(request.body.email), false);
});

test('RDS direct intake reports same-key replay and changed-content conflict', async () => {
  const replay = fixture({...stored, duplicate: true});
  const result = await receiveWebsiteIntake(request, replay.options);
  assert.equal(result.status, 200);
  assert.equal(result.body.duplicate, true);
  assert.equal(result.body.id, stored.id);
  const conflict = fixture(null, {code: 'P0409', message: 'Sensitive storage detail'});
  const changed = await receiveWebsiteIntake({...request, body: {...request.body, message: 'Changed'}}, conflict.options);
  assert.equal(changed.status, 409);
  assert.equal(JSON.stringify(changed).includes('Sensitive storage detail'), false);
});

test('RDS intake rejects disabled gates, legacy routes, and client workspace injection', async () => {
  for (const override of [
    {RDS_INTAKE_ENABLED: 'false'}, {ALLOW_INTAKE_NETWORK: 'false'},
    {INTAKE_PROVIDER: 'apps-script'}, {INTAKE_PROVIDER: 'make-supabase'},
    {INTAKE_SOURCE_TOKEN: ''},
  ]) {
    const {calls, options} = fixture(stored, null, override);
    assert.equal((await receiveWebsiteIntake(request, options)).status, 503);
    assert.equal(calls.length, 0);
  }
  const {calls, options} = fixture();
  assert.equal((await receiveWebsiteIntake({...request, body: {...request.body, workspace_id: 'foreign'}}, options)).status, 400);
  assert.equal(calls.length, 0);
});
