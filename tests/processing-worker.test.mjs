import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runProcessingOnce, createHttpProcessor, validateProcessingOutput} from '../server/processing-worker.mjs';

function fixture({attempt = 1, settleError = null, settled = true} = {}) {
  const calls = [];
  const job = {workspaceId: 'local-workspace', id: 'local-job', leaseToken: 'synthetic-lease', attempt, input: {message: 'Synthetic original'}};
  return {calls, client: {async rpc(name, input) {
    calls.push({name, input});
    return name === 'claim_processing_job' ? {data: job, error: null} : {data: settled, error: settleError};
  }}};
}

test('worker persists validated output using the fenced lease and stable provider key', async () => {
  const {calls, client} = fixture();
  const result = await runProcessingOnce({client, processor: async (input, options) => {
    assert.equal(input.message, 'Synthetic original');
    assert.equal(options.idempotencyKey, 'local-job');
    return {summary: 'Synthetic test result', fit_score: 10};
  }});
  assert.equal(result.status, 'completed');
  assert.equal(calls[1].input.token, 'synthetic-lease');
  assert.equal(calls[1].input.output.fit_score, 10);
});

test('invalid output and provider failure release reservations rather than claim success', async () => {
  for (const processor of [async () => ({workspaceId: 'foreign'}), async () => {throw new Error('Sensitive provider response');}]) {
    const {client, calls} = fixture();
    assert.equal((await runProcessingOnce({client, processor})).status, 'failed');
    assert.equal(calls[1].input.output, null);
  }
});

test('bounded timeout aborts slow processing and settles failure', async () => {
  const {client, calls} = fixture();
  let signal;
  const result = await runProcessingOnce({client, timeoutMs: 5, processor: (input, options) => {
    signal = options.signal;
    return new Promise(() => {});
  }});
  assert.equal(result.status, 'failed');
  assert.equal(signal.aborted, true);
  assert.equal(calls[1].input.output, null);
});

test('lost leases and settlement failures cannot report a committed result', async () => {
  assert.equal((await runProcessingOnce({client: fixture({settled: false}).client, processor: async () => ({summary: 'Synthetic'})})).status, 'lease_lost');
  await assert.rejects(runProcessingOnce({client: fixture({settleError: {code: 'synthetic'}}).client, processor: async () => ({summary: 'Synthetic'})}), /durable lease/);
});

test('crash retry ceiling releases the job without repeating external processing', async () => {
  assert.equal((await runProcessingOnce({client: fixture({attempt: 4}).client, processor: async () => {assert.fail('Processor must not run');}})).status, 'failed');
});

test('an idle worker has no external side effects', async () => {
  const result = await runProcessingOnce({client: {rpc: async () => ({data: null})}, processor: async () => {assert.fail('No job to process');}});
  assert.equal(result.status, 'idle');
});

test('processor output rejects malformed fields and unbounded scores', () => {
  for (const output of [null, [], {}, {summary: {}}, {summary: 'x'.repeat(4001)}, {fit_score: Infinity}, {fit_score: -1}, {fit_score: 101}, {message: 'overwrite'}]) {
    assert.throws(() => validateProcessingOutput(output));
  }
});

test('HTTP processor uses only the approved endpoint, no redirects or secret query parameters', async () => {
  for (const endpoint of ['http://processor.example.test', 'https://other.example.test', 'https://processor.example.test/?secret=value']) {
    assert.throws(() => createHttpProcessor({endpoint, allowedHost: 'processor.example.test', token: 'synthetic-token'}));
  }
  const processor = createHttpProcessor({endpoint: 'https://processor.example.test/run', allowedHost: 'processor.example.test', token: 'synthetic-token', fetchImplementation: async (url, request) => {
    assert.equal(request.redirect, 'error');
    assert.equal(request.headers['Idempotency-Key'], 'local-job');
    return new Response(JSON.stringify({summary: 'Synthetic test response'}), {headers: {'content-type': 'application/json'}});
  }});
  assert.equal((await processor({message: 'Synthetic'}, {idempotencyKey: 'local-job'})).summary, 'Synthetic test response');
});

test('oversized HTTP responses are rejected before database settlement', async () => {
  const processor = createHttpProcessor({endpoint: 'https://processor.example.test', allowedHost: 'processor.example.test', token: 'synthetic-token',
    fetchImplementation: async () => new Response('x'.repeat(32769), {headers: {'content-type': 'application/json'}})});
  await assert.rejects(processor({}, {idempotencyKey: 'local-job'}), /exceeded limit/);
});
