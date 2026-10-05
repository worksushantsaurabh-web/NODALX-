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
const receiptUrl = 'https://script.googleusercontent.com/macros/echo?user_content_key=test-only-receipt-token';

function confirmedReceipt(operationId = 'receipt-request', duplicate = false) {
  return Response.json({success: true, rowId: operationId, duplicate});
}

function redirectReceipt(location = receiptUrl) {
  return new Response(null, {status: 302, headers: {Location: location}});
}

test('confirmation redirects use GET without forwarding the intake secret or customer body', async () => {
  const requests = [];
  const result = await receiveContact({method: 'POST', body: inquiry, idempotencyKey: 'receipt-request'}, {
    environment: configured, fetcher: async (url, options) => {
      requests.push({url: String(url), options});
      return requests.length === 1 ? redirectReceipt() : confirmedReceipt();
    },
  });
  assert.equal(result.status, 202);
  assert.equal(requests.length, 2);
  assert.equal(requests[0].options.method, 'POST');
  assert.equal(requests[1].options.method, 'GET');
  assert.equal(requests[1].options.body, undefined);
  assert.deepEqual(requests[1].options.headers, {Accept: 'application/json'});
  assert.equal(requests[1].url, receiptUrl);
  assert.equal(JSON.stringify(requests[1]).includes(configured.APPS_SCRIPT_INTAKE_SECRET), false);
  assert.equal(requests[0].options.signal, requests[1].options.signal);
  assert.ok(requests.every(request => request.options.redirect === 'manual'));
});

for (const status of [404, 410]) {
  test(`an expired ${status} receipt obtains a fresh receipt with the same payload, without another stored row or email`, async () => {
    const stored = new Set();
    const payloads = [];
    const logs = [];
    let receiptReads = 0;
    let notifications = 0;
    const result = await receiveContact({method: 'POST', body: inquiry, idempotencyKey: 'receipt-request'}, {
      environment: configured, logger: entry => logs.push(entry), fetcher: async (url, options) => {
        if (options.method === 'POST') {
          payloads.push(options.body);
          const payload = JSON.parse(options.body);
          if (!stored.has(payload.requestId)) notifications++;
          stored.add(payload.requestId);
          return redirectReceipt(`${receiptUrl}&receipt=${payloads.length}`);
        }
        receiptReads++;
        return receiptReads === 1 ? new Response('<html>Missing receipt</html>', {status, headers: {'Content-Type': 'text/html'}}) : confirmedReceipt('receipt-request', true);
      },
    });
    assert.equal(result.status, 202);
    assert.equal(result.body.id, 'receipt-request');
    assert.equal(result.body.duplicate, true);
    assert.equal(stored.size, 1);
    assert.equal(notifications, 1);
    assert.equal(payloads.length, 2);
    assert.equal(payloads[0], payloads[1]);
    assert.equal(logs[0].event, 'intake_receipt_retry');
    assert.equal(logs[0].phase, 'confirmation_request');
    assert.equal(logs[0].providerStatus, status);
  });
}

test('receipt refresh is bounded and never treats a redirect or missing receipt as acceptance', async () => {
  let calls = 0;
  const failed = await receiveContact({method: 'POST', body: inquiry, idempotencyKey: 'receipt-request'}, {
    environment: configured, fetcher: async (url, options) => {
      calls++;
      return options.method === 'POST' ? redirectReceipt() : new Response('Missing', {status: 404});
    },
  });
  assert.equal(calls, 4);
  assert.equal(failed.status, 502);
  assert.equal(failed.body.accepted, undefined);
  assert.equal(failed.headers['Retry-After'], '3');
});

test('transient POST transport failure retries an identical operation only', async () => {
  const payloads = [];
  const signals = [];
  const result = await receiveContact({method: 'POST', body: inquiry, idempotencyKey: 'receipt-request'}, {
    environment: configured, fetcher: async (url, options) => {
      payloads.push(options.body);
      signals.push(options.signal);
      if (payloads.length === 1) throw new TypeError('private transport details', {cause: {code: 'ECONNRESET'}});
      return confirmedReceipt();
    },
  });
  assert.equal(result.status, 202);
  assert.deepEqual(payloads, [payloads[0], payloads[0]]);
  assert.equal(signals[0], signals[1]);
});

test('transient receipt status and body failures retry GET without replaying the stored POST', async () => {
  let writes = 0;
  let reads = 0;
  const result = await receiveContact({method: 'POST', body: inquiry, idempotencyKey: 'receipt-request'}, {
    environment: configured, fetcher: async (url, options) => {
      if (options.method === 'POST') {writes++; return redirectReceipt();}
      reads++;
      if (reads === 1) return new Response('Unavailable', {status: 503});
      if (reads === 2) return {ok: true, status: 200, json: async () => {
        throw new TypeError('private body failure', {cause: {code: 'UND_ERR_SOCKET'}});
      }};
      return confirmedReceipt();
    },
  });
  assert.equal(result.status, 202);
  assert.equal(writes, 1);
  assert.equal(reads, 3);
});

test('unavailable receipt retries stop at three GET attempts', async () => {
  let reads = 0;
  let writes = 0;
  const result = await receiveContact({method: 'POST', body: inquiry}, {
    environment: configured, fetcher: async (url, options) => {
      if (options.method === 'POST') {writes++; return redirectReceipt();}
      reads++;
      return new Response('Unavailable', {status: 503});
    },
  });
  assert.equal(result.status, 502);
  assert.equal(result.body.accepted, undefined);
  assert.equal(reads, 3);
  assert.equal(writes, 1);
});

test('provider configuration, authorization, malformed JSON and conflict failures are not retried', async () => {
  for (const upstream of [new Response('Missing deployment', {status: 404}),
    new Response('Unauthorized', {status: 401}), new Response('Forbidden', {status: 403}),
    new Response('<html>Sign in</html>', {status: 200}),
    Response.json({success: false, message: 'Unauthorized'}),
    Response.json({success: false, code: 'IDEMPOTENCY_CONFLICT'})]) {
    let calls = 0;
    const result = await receiveContact({method: 'POST', body: inquiry}, {
      environment: configured, fetcher: async () => {calls++; return upstream;},
    });
    assert.equal(calls, 1);
    assert.equal(result.body.accepted, undefined);
    assert.ok([409, 502].includes(result.status));
  }
});

test('receipt redirects reject untrusted origins, credentials, secret forwarding and method-preserving redirects', async () => {
  for (const location of ['https://example.test/macros/echo', 'https://accounts.google.com/login',
    'http://script.googleusercontent.com/macros/echo', 'https://script.googleusercontent.com.evil.test/macros/echo',
    'https://user:password@script.googleusercontent.com/macros/echo', 'https://script.googleusercontent.com:444/macros/echo',
    'https://script.googleusercontent.com/macros/echo?secret=test-only-secret',
    'https://script.googleusercontent.com/other', `${receiptUrl}#fragment`, '']) {
    let calls = 0;
    const result = await receiveContact({method: 'POST', body: inquiry}, {
      environment: configured, fetcher: async () => {calls++; return redirectReceipt(location);},
    });
    assert.equal(result.status, 502);
    assert.equal(calls, 1);
  }
  for (const status of [301, 307, 308]) {
    let calls = 0;
    const result = await receiveContact({method: 'POST', body: inquiry}, {
      environment: configured, fetcher: async () => {calls++; return new Response(null, {status, headers: {Location: receiptUrl}});},
    });
    assert.equal(result.status, 502);
    assert.equal(calls, 1);
  }
});

test('redirect loops are bounded', async () => {
  let calls = 0;
  const result = await receiveContact({method: 'POST', body: inquiry}, {
    environment: configured, fetcher: async () => {calls++; return redirectReceipt();},
  });
  assert.equal(result.status, 502);
  assert.equal(calls, 4);
});

test('provider backoff beyond the retry window is respected without more calls', async () => {
  for (const retryAfter of ['60', new Date(Date.now() + 60000).toUTCString()]) {
    let calls = 0;
    const result = await receiveContact({method: 'POST', body: inquiry}, {
      environment: configured, fetcher: async () => {
        calls++;
        return new Response('Unavailable', {status: 503, headers: {'Retry-After': retryAfter}});
      },
    });
    assert.equal(result.status, 502);
    assert.equal(calls, 1);
  }
});

test('safe diagnostics exclude payloads, operation keys, secrets, URLs and raw provider errors', async () => {
  const logs = [];
  await receiveContact({method: 'POST', body: inquiry, idempotencyKey: 'private-operation-key'}, {
    environment: configured, logger: entry => logs.push(entry), fetcher: async () => {
      throw new TypeError(`private-error ${configured.APPS_SCRIPT_INTAKE_SECRET} ${receiptUrl}`, {cause: {code: 'ENOTFOUND'}});
    },
  });
  assert.equal(logs.length, 1);
  assert.equal(logs[0].transportCode, 'ENOTFOUND');
  for (const privateValue of [inquiry.email, inquiry.message, configured.APPS_SCRIPT_INTAKE_SECRET,
    receiptUrl, 'test-only-receipt-token', 'private-operation-key', 'private-error']) {
    assert.equal(JSON.stringify(logs).includes(privateValue), false);
  }
  const failed = await receiveContact({method: 'POST', body: inquiry}, {
    environment: configured, logger: () => {throw Error('Logging unavailable');}, fetcher: async () => {throw Error('Unavailable');},
  });
  assert.equal(failed.status, 502);
});

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

test('retry backoff shares the original deadline and never starts another request after timeout', async context => {
  mockIntakeClock(context);
  let calls = 0;
  const pending = receiveContact({method: 'POST', body: inquiry}, {
    environment: configured, fetcher: async () => {calls++; return new Response('Unavailable', {status: 503});},
  });
  for (let microtask = 0; microtask < 8; microtask++) await Promise.resolve();
  context.mock.timers.tick(INTAKE_TIMEOUT_MS);
  const result = await pending;
  assert.equal(result.status, 502);
  assert.equal(result.body.code, 'INTAKE_TIMEOUT');
  assert.equal(calls, 1);
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
    for (let microtask = 0; microtask < 8; microtask++) await Promise.resolve();
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
