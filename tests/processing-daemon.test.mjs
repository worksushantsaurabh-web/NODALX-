import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runProcessingDaemon, cloudWorkerConfiguration} from '../server/processing-daemon.mjs';
import {runProcessingOnce} from '../server/processing-worker.mjs';

test('cloud startup rejects implicit environments, local databases and unapproved network calls', () => {
  const environment = {PROCESSING_ENVIRONMENT: 'staging', SUPABASE_URL: 'https://syntheticproject.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'synthetic', ALLOW_PROCESSING_NETWORK: 'true'};
  assert.equal(cloudWorkerConfiguration(environment).url, environment.SUPABASE_URL);
  for (const change of [{PROCESSING_ENVIRONMENT: ''}, {SUPABASE_URL: 'http://127.0.0.1:54321'}, {SUPABASE_URL: 'https://syntheticproject.supabase.co?secret=value'}, {SUPABASE_SERVICE_ROLE_KEY: ''}, {ALLOW_PROCESSING_NETWORK: ''}]) {
    assert.throws(() => cloudWorkerConfiguration({...environment, ...change}));
  }
});

test('daemon refreshes readiness and marks its own worker stopped on shutdown', async () => {
  const stop = new AbortController();
  const heartbeats = [];
  let claims = 0;
  const client = {async rpc(name, input) {
    if (name === 'processing_worker_heartbeat') {heartbeats.push(input); return {error: null};}
    claims++;
    if (claims === 3) stop.abort();
    return {data: null, error: null};
  }};
  await runProcessingDaemon({client, processor: async () => assert.fail('No job'), signal: stop.signal, pollMs: 10, heartbeatMs: 10});
  assert.ok(heartbeats.length >= 3);
  assert.ok(heartbeats[0].is_ready);
  assert.equal(heartbeats.at(-1).is_ready, false);
  assert.equal(new Set(heartbeats.map(item => item.worker_id)).size, 1);
});

test('provider failure pauses claims and publishes an unavailable heartbeat', async () => {
  const stop = new AbortController();
  const heartbeats = [];
  let claims = 0;
  const client = {async rpc(name, input) {
    if (name === 'processing_worker_heartbeat') {
      heartbeats.push(input.is_ready);
      if (!input.is_ready) stop.abort();
      return {error: null};
    }
    if (name === 'claim_processing_job') {claims++; return {data: {workspaceId: 'local', id: 'job', leaseToken: 'token', attempt: 1, input: {}}};}
    return {data: true};
  }};
  await runProcessingDaemon({client, processor: async () => {throw new Error('Synthetic failure');}, signal: stop.signal, pollMs: 10, heartbeatMs: 10});
  assert.equal(claims, 1);
  assert.equal(heartbeats.at(-1), false);
});

test('failed database heartbeats prevent claims until recovery', async () => {
  const stop = new AbortController();
  let beats = 0;
  const client = {async rpc(name) {
    assert.equal(name, 'processing_worker_heartbeat');
    if (++beats === 3) stop.abort();
    return {error: {code: 'synthetic'}};
  }};
  await runProcessingDaemon({client, processor: async () => assert.fail('No readiness'), signal: stop.signal, pollMs: 10, heartbeatMs: 10});
});

test('shutdown during a job preserves its reservation for lease recovery', async () => {
  const stop = new AbortController();
  const calls = [];
  const client = {async rpc(name) {calls.push(name); return {data: {workspaceId: 'local', id: 'job', leaseToken: 'token', attempt: 1, input: {}}};}};
  await assert.rejects(runProcessingOnce({client, signal: stop.signal, processor: async () => {stop.abort(); return {summary: 'Synthetic'};}}), /durable lease/);
  assert.deepEqual(calls, ['claim_processing_job']);
});

test('an already stopped worker never claims a job', async () => {
  const stop = new AbortController(); stop.abort();
  assert.equal((await runProcessingOnce({client: {rpc: () => assert.fail('Stopped')}, processor: async () => {}, signal: stop.signal})).status, 'stopped');
});
