import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createGeminiProcessor} from '../server/gemini-processor.mjs';

const output = {intent: 'unknown', urgency: 'unknown', category: 'unknown', summary: 'Synthetic test summary', suggested_action: 'Human review', fit_score: 0};
const configuration = {apiKey: 'synthetic-key', model: 'gemini-synthetic-test', dataApproval: 'synthetic-only'};
function envelope(result = output, finishReason = 'STOP') {
  return new Response(JSON.stringify({candidates: [{finishReason, content: {parts: [{text: JSON.stringify(result)}]}}]}), {headers: {'content-type': 'application/json'}});
}

test('Gemini adapter minimizes contact data and uses fixed API host and structured output', async () => {
  const processor = createGeminiProcessor({...configuration, fetchImplementation: async (url, request) => {
    assert.equal(new URL(url).hostname, 'generativelanguage.googleapis.com');
    assert.equal(new URL(url).search, '');
    assert.equal(request.headers['x-goog-api-key'], 'synthetic-key');
    assert.equal(request.redirect, 'error');
    const body = JSON.parse(request.body);
    const data = JSON.parse(body.contents[0].parts[0].text);
    assert.deepEqual(Object.keys(data).sort(), ['message', 'qualificationCriteria']);
    assert.equal(body.generationConfig.maxOutputTokens, 1024);
    assert.equal(body.generationConfig.responseFormat.text.mimeType, 'application/json');
    assert.equal(body.tools, undefined);
    return envelope();
  }});
  assert.deepEqual(await processor({message: 'Synthetic request', name: 'Not transmitted', email: 'not-transmitted@example.test', criteria: 'Synthetic criteria'}, {}), output);
});

test('Gemini requires explicit key, safe model name and data approval', () => {
  for (const change of [{apiKey: ''}, {model: '../../other'}, {dataApproval: undefined}, {apiKey: 'key\nunsafe'}]) {
    assert.throws(() => createGeminiProcessor({...configuration, ...change}));
  }
});

test('oversized or invalid inputs never reach Google', async () => {
  const processor = createGeminiProcessor({...configuration, fetchImplementation: () => assert.fail('Invalid input')});
  for (const input of [{}, {message: ''}, {message: 'x'.repeat(12001)}, {message: 'Synthetic', criteria: 'x'.repeat(4001)}]) {
    await assert.rejects(processor(input, {}));
  }
});

test('blocked, truncated, malformed or incomplete generation cannot become success', async () => {
  for (const response of [envelope(output, 'MAX_TOKENS'), envelope({summary: 'Incomplete'}), envelope({...output, workspaceId: 'foreign'}),
    new Response(JSON.stringify({promptFeedback: {blockReason: 'SAFETY'}}), {headers: {'content-type': 'application/json'}})]) {
    const processor = createGeminiProcessor({...configuration, fetchImplementation: async () => response});
    await assert.rejects(processor({message: 'Synthetic'}, {}));
  }
});

test('provider errors remain redacted and are not automatically retried', async () => {
  let calls = 0;
  const processor = createGeminiProcessor({...configuration, fetchImplementation: async () => {calls++; return new Response('Sensitive provider details', {status: 429});}});
  await assert.rejects(processor({message: 'Synthetic'}, {}), error => error.message === 'Gemini processing is unavailable.');
  assert.equal(calls, 1);
});

test('missing qualification criteria cannot produce a fabricated fit score', async () => {
  const processor = createGeminiProcessor({...configuration, fetchImplementation: async () => envelope()});
  const result = await processor({message: 'Synthetic'}, {});
  assert.equal(result.fit_score, undefined);
  assert.equal(result.intent, 'unknown');
});
