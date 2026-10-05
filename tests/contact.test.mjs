import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import handler from '../api/contact.mjs';
import {receiveContact, intakeConfiguration, INTAKE_TIMEOUT_MS} from '../server/contact.mjs';

function response() {
  return {
    statusCode: 200,
    setHeader() { return this; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test('Apps Script contact proxy accepts a confirmed write and keeps its secret server-side', async () => {
  const previousUrl = process.env.APPS_SCRIPT_WEB_APP_URL;
  const previousSecret = process.env.APPS_SCRIPT_INTAKE_SECRET;
  const originalFetch = global.fetch;
  process.env.APPS_SCRIPT_WEB_APP_URL = 'https://script.google.com/macros/s/AKfytest/exec';
  process.env.APPS_SCRIPT_INTAKE_SECRET = 'test-only-secret';
  let sent;
  global.fetch = async (url, options) => {
    sent = {url: String(url), options};
    return {ok: true, json: async () => ({success: true, rowId: 'sheet-row-1'})};
  };
  try {
    const result = response();
    await handler({method: 'POST', body: {name: 'Mira', email: 'mira@example.com', company: 'Acme', message: 'Please call', phone: '123'}}, result);
    assert.equal(result.statusCode, 202);
    assert.equal(result.body.accepted, true);
    assert.equal(result.body.id, 'sheet-row-1');
    assert.equal(result.body.processingStatus, 'accepted');
    assert.equal(typeof result.body.requestId, 'string');
    assert.equal(new URL(sent.url).searchParams.get('secret'), 'test-only-secret');
    assert.equal(JSON.parse(sent.options.body).phone, '123');
    assert.equal(sent.options.body.includes('test-only-secret'), false);
  } finally {
    global.fetch = originalFetch;
    if (previousUrl === undefined) delete process.env.APPS_SCRIPT_WEB_APP_URL;
    else process.env.APPS_SCRIPT_WEB_APP_URL = previousUrl;
    if (previousSecret === undefined) delete process.env.APPS_SCRIPT_INTAKE_SECRET;
    else process.env.APPS_SCRIPT_INTAKE_SECRET = previousSecret;
  }
});

const configured = {APPS_SCRIPT_WEB_APP_URL: 'https://script.google.com/macros/s/AKfytest/exec', APPS_SCRIPT_INTAKE_SECRET: 'test-only-secret'};
const inquiry = {name: 'Mira', email: 'mira@example.test', company: 'Example', message: 'Hello'};

function mockIntakeClock(context) {
  context.mock.timers.enable({apis: ['setTimeout']});
  context.mock.method(AbortSignal, 'timeout', timeout => {
    assert.equal(timeout, INTAKE_TIMEOUT_MS);
    const controller = new AbortController();
    setTimeout(() => controller.abort(new DOMException('Timed out', 'TimeoutError')), timeout);
    return controller.signal;
  });
}

test('inquiry deadlines leave time for the server to return a safe response', () => {
  const form = readFileSync(new URL('../frontend/components/InquiryForm.tsx', import.meta.url), 'utf8');
  const configuration = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  const browserTimeout = Number(form.match(/const INQUIRY_SUBMISSION_TIMEOUT_MS = (\d+);/)?.[1]);
  assert.match(form, /AbortSignal\.timeout\(INQUIRY_SUBMISSION_TIMEOUT_MS\)/);
  assert.equal(INTAKE_TIMEOUT_MS, 45000);
  assert.equal(browserTimeout, 55000);
  assert.equal(configuration.functions['api/contact.mjs'].maxDuration, 60);
  assert.ok(INTAKE_TIMEOUT_MS + 5000 <= browserTimeout);
  assert.ok(browserTimeout + 5000 <= configuration.functions['api/contact.mjs'].maxDuration * 1000);
});

test('a delayed Google response beyond the previous deadlines can still confirm storage', async context => {
  mockIntakeClock(context);
  const pending = receiveContact({method: 'POST', body: inquiry, idempotencyKey: 'slow-request'}, {
    environment: configured,
    fetcher: async (url, {signal}) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), {once: true});
      setTimeout(() => resolve({ok: true, json: async () => ({success: true, rowId: 'slow-request'})}), 35000);
    }),
  });
  context.mock.timers.tick(35000);
  const result = await pending;
  assert.equal(result.status, 202);
  assert.equal(result.body.accepted, true);
  assert.equal(result.body.id, 'slow-request');
});

for (const stage of ['request', 'response body']) {
  test(`timeout during ${stage} remains unconfirmed and an identical retry keeps its operation ID`, async context => {
    mockIntakeClock(context);
    const operationIds = [];
    const fetcher = async (url, {signal, body}) => {
      const operationId = JSON.parse(body).requestId;
      operationIds.push(operationId);
      if (operationIds.length > 1) {
        return {ok: true, json: async () => ({success: true, duplicate: true, rowId: operationId})};
      }
      const waitForAbort = () => new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => reject(stage === 'response body' ? new DOMException('Body aborted', 'AbortError') : signal.reason), {once: true});
      });
      return stage === 'request' ? waitForAbort() : {ok: true, json: waitForAbort};
    };
    const request = {method: 'POST', body: inquiry, idempotencyKey: 'timeout-retry'};
    const pending = receiveContact(request, {environment: configured, fetcher});
    await Promise.resolve();
    context.mock.timers.tick(INTAKE_TIMEOUT_MS);
    const timedOut = await pending;
    assert.equal(timedOut.status, 502);
    assert.equal(timedOut.body.code, 'INTAKE_TIMEOUT');
    assert.equal(timedOut.body.accepted, undefined);
    assert.match(timedOut.body.error, /may already be saved/);
    assert.equal(timedOut.headers['X-Request-ID'], timedOut.body.requestId);
    assert.equal(timedOut.headers['Cache-Control'], 'no-store');
    const retry = await receiveContact(request, {environment: configured, fetcher});
    assert.equal(retry.status, 202);
    assert.equal(retry.body.duplicate, true);
    assert.equal(retry.body.id, 'timeout-retry');
    assert.deepEqual(operationIds, ['timeout-retry', 'timeout-retry']);
  });
}

test('configuration rejects editor URLs, credentials, query strings and arbitrary origins', () => {
  for (const endpoint of ['https://example.test/exec', 'https://script.google.com/macros/s/test/edit',
    'https://script.google.com:444/macros/s/test/exec',
    'https://user:password@script.google.com/macros/s/test/exec', `${configured.APPS_SCRIPT_WEB_APP_URL}?secret=old`]) {
    assert.equal(intakeConfiguration({...configured, APPS_SCRIPT_WEB_APP_URL: endpoint}).ready, false);
  }
  assert.equal(intakeConfiguration(configured).ready, true);
});

test('proxy forwards stable idempotency and only claims confirmed classification', async () => {
  let sent;
  const result = await receiveContact({method: 'POST', body: inquiry, idempotencyKey: 'stable-request'}, {
    environment: configured, fetcher: async (url, options) => {
      sent = JSON.parse(options.body);
      return {ok: true, json: async () => ({success: true, duplicate: true, rowId: 'stable-request', classification: {intent: 'general'}})};
    },
  });
  assert.equal(sent.requestId, 'stable-request');
  assert.equal(result.status, 202);
  assert.equal(result.body.duplicate, true);
  assert.equal(result.body.processingStatus, 'classified');
  assert.equal(JSON.stringify(result.body).includes(configured.APPS_SCRIPT_INTAKE_SECRET), false);
});

test('invalid requests never reach Apps Script', async () => {
  const options = {environment: configured, fetcher: async () => {throw Error('Unexpected upstream call');}};
  for (const body of ['{', [], {...inquiry, email: 'invalid'}, {...inquiry, message: 'x'.repeat(12001)}]) {
    assert.equal((await receiveContact({method: 'POST', body}, options)).status, 400);
  }
  assert.equal((await receiveContact({method: 'POST', body: 'x'.repeat(20001)}, options)).status, 413);
  assert.equal((await receiveContact({method: 'POST', body: inquiry, idempotencyKey: 'bad key'}, options)).status, 400);
  const unsupported = await receiveContact({method: 'GET'}, options);
  assert.equal(unsupported.status, 405);
  assert.equal(unsupported.headers.Allow, 'POST');
});

test('storage conflicts and ambiguous failures remain safe and correlated', async () => {
  const conflict = await receiveContact({method: 'POST', body: inquiry}, {
    environment: configured, fetcher: async () => ({ok: true, json: async () => ({success: false, code: 'IDEMPOTENCY_CONFLICT'})}),
  });
  assert.equal(conflict.status, 409);
  for (const fetcher of [async () => {throw Error('secret provider details');},
    async () => ({ok: true, json: async () => {throw Error('HTML sign-in page');}}),
    async () => ({ok: true, json: async () => null}),
    async () => ({ok: true, json: async () => ({success: true, rowId: ''})})]) {
    const failed = await receiveContact({method: 'POST', body: inquiry}, {environment: configured, fetcher});
    assert.equal(failed.status, 502);
    assert.equal(failed.body.accepted, undefined);
    assert.equal(failed.headers['X-Request-ID'], failed.body.requestId);
    assert.equal(failed.headers['Cache-Control'], 'no-store');
    assert.equal(JSON.stringify(failed).includes('secret provider details'), false);
  }
});

test('Apps Script contact proxy fails closed without configuration', async () => {
  const previousUrl = process.env.APPS_SCRIPT_WEB_APP_URL;
  const previousSecret = process.env.APPS_SCRIPT_INTAKE_SECRET;
  delete process.env.APPS_SCRIPT_WEB_APP_URL;
  delete process.env.APPS_SCRIPT_INTAKE_SECRET;
  try {
    const result = response();
    await handler({method: 'POST', body: {}}, result);
    assert.equal(result.statusCode, 503);
  } finally {
    if (previousUrl !== undefined) process.env.APPS_SCRIPT_WEB_APP_URL = previousUrl;
    if (previousSecret !== undefined) process.env.APPS_SCRIPT_INTAKE_SECRET = previousSecret;
  }
});

test('Apps Script contact proxy does not claim success when storage rejects a row', async () => {
  const previousUrl = process.env.APPS_SCRIPT_WEB_APP_URL;
  const previousSecret = process.env.APPS_SCRIPT_INTAKE_SECRET;
  const originalFetch = global.fetch;
  process.env.APPS_SCRIPT_WEB_APP_URL = 'https://script.google.com/macros/s/AKfytest/exec';
  process.env.APPS_SCRIPT_INTAKE_SECRET = 'test-only-secret';
  global.fetch = async () => ({ok: true, json: async () => ({success: false, message: 'Unauthorized'})});
  try {
    const result = response();
    await handler({method: 'POST', body: {name: 'Mira', email: 'mira@example.com', company: 'Acme', message: 'Please call'}}, result);
    assert.equal(result.statusCode, 502);
    assert.equal(result.body.accepted, undefined);
  } finally {
    global.fetch = originalFetch;
    if (previousUrl === undefined) delete process.env.APPS_SCRIPT_WEB_APP_URL;
    else process.env.APPS_SCRIPT_WEB_APP_URL = previousUrl;
    if (previousSecret === undefined) delete process.env.APPS_SCRIPT_INTAKE_SECRET;
    else process.env.APPS_SCRIPT_INTAKE_SECRET = previousSecret;
  }
});
