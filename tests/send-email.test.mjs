import { test } from 'node:test';
import assert from 'node:assert/strict';
import {createSupportEmailHandler} from '../api/send-email.mjs';

function newHandler() {
  const sent = [];
  const store = new Map();
  const handler = createSupportEmailHandler({
    store,
    resendFactory: () => ({emails: {send: async payload => {sent.push(payload); return {data: {id: 'msg_test'}, error: null};}}}),
  });
  return {handler, sent, store};
}

function mockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(key, value) {
      this.headers[key] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
  };
}

let nextClient = 0;
function post(body, headers = {}) {
  nextClient += 1;
  return {method: 'POST', headers: {'host': 'nodalx.in', origin: 'https://nodalx.in', 'x-forwarded-for': `203.0.113.${nextClient}`, ...headers}, body, socket: {remoteAddress: `203.0.113.${nextClient}`}};
}

function enabled() {
  process.env.SUPPORT_EMAIL_ENABLED = 'true';
  process.env.RESEND_API_KEY = 're_mock_test_key';
}

function clear() {
  delete process.env.SUPPORT_EMAIL_ENABLED;
  delete process.env.RESEND_API_KEY;
  delete process.env.SUPPORT_EMAIL_TO;
  delete process.env.SUPPORT_EMAIL_FROM;
  delete process.env.SUPPORT_EMAIL_ALLOWED_ORIGINS;
}

test('send-email rejects non-POST methods with 405', async () => {
  const res = mockRes();
  await newHandler().handler({method: 'GET'}, res);
  assert.equal(res.statusCode, 405);
  assert.equal(res.headers.Allow, 'POST');
});

test('send-email fails closed when the support gate is not enabled', async () => {
  clear();
  process.env.RESEND_API_KEY = 're_mock_test_key';
  try {
    const res = mockRes();
    await newHandler().handler(post({subject: 'Hi', message: 'Hello'}), res);
    assert.equal(res.statusCode, 503);
    assert.equal(res.body.code, 'SUPPORT_EMAIL_DISABLED');
  } finally {
    clear();
  }
});

test('send-email rejects a request with no Origin header', async () => {
  enabled();
  try {
    const req = post({subject: 'Hi', message: 'Hello'});
    delete req.headers.origin;
    const res = mockRes();
    await newHandler().handler(req, res);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.code, 'ORIGIN_NOT_ALLOWED');
  } finally {
    clear();
  }
});

test('send-email rejects a cross-origin browser request', async () => {
  enabled();
  try {
    const res = mockRes();
    await newHandler().handler(post({subject: 'Hi', message: 'Hello'}, {origin: 'https://evil.example'}), res);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.code, 'ORIGIN_NOT_ALLOWED');
  } finally {
    clear();
  }
});

test('send-email honours an explicit allowed-origin list', async () => {
  enabled();
  process.env.SUPPORT_EMAIL_ALLOWED_ORIGINS = 'https://nodalx.in';
  try {
    const {handler: run, sent} = newHandler();
    const res = mockRes();
    await run(post({subject: 'Hi', message: 'Hello'}, {origin: 'https://nodalx.in'}), res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(sent[0].to, ['support@nodalx.in']);
  } finally {
    clear();
  }
});

test('send-email refuses a client-chosen recipient', async () => {
  enabled();
  try {
    const res = mockRes();
    await newHandler().handler(post({to: 'attacker@evil.example', subject: 'Hi', message: 'Hello'}), res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.code, 'INVALID_INPUT');
  } finally {
    clear();
  }
});

test('send-email rejects unknown fields including html', async () => {
  enabled();
  try {
    for (const field of ['html', 'from', 'cc', 'bcc']) {
      const res = mockRes();
      await newHandler().handler(post({subject: 'Hi', message: 'Hello', [field]: 'x'}), res);
      assert.equal(res.statusCode, 400, field);
      assert.equal(res.body.code, 'INVALID_INPUT');
    }
  } finally {
    clear();
  }
});

test('send-email validates the permitted fields', async () => {
  enabled();
  try {
    const cases = [
      {message: 'Hello'},
      {subject: '   ', message: 'Hello'},
      {subject: 'Hi'},
      {subject: 'Hi', message: ''},
      {subject: 'Hi', message: 'Hello', replyTo: 'not-an-email'},
      {subject: 'Hi\r\nBcc: victim@evil.example', message: 'Hello'},
      {subject: 'Hi', message: 'Hello', replyTo: 'a@b.co\r\nBcc: victim@evil.example'},
      {subject: 'x'.repeat(201), message: 'Hello'},
      {subject: 'Hi', message: 'x'.repeat(8001)},
    ];
    for (const body of cases) {
      const res = mockRes();
      await newHandler().handler(post(body), res);
      assert.equal(res.statusCode, 400, JSON.stringify(Object.keys(body)));
      assert.equal(res.body.code, 'INVALID_INPUT');
    }
  } finally {
    clear();
  }
});

test('send-email cannot be used as an open relay even with a valid same-origin browser request', async () => {
  enabled();
  try {
    const {handler: run, sent} = newHandler();
    const res = mockRes();
    await run(post({to: 'victim@evil.example', subject: 'Free money', message: 'click here',
      html: '<a href="evil">x</a>', from: 'attacker@evil.example'}), res);
    assert.equal(res.statusCode, 400);
    assert.equal(sent.length, 0);
  } finally {
    clear();
  }
});

test('send-email pins the recipient server-side and honours replyTo', async () => {
  enabled();
  try {
    const {handler: run, sent} = newHandler();
    const res = mockRes();
    await run(post({replyTo: 'visitor@example.com', subject: 'Question', message: 'Hello there'}), res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(sent[0].to, ['support@nodalx.in']);
    assert.equal(sent[0].reply_to, 'visitor@example.com');
    assert.equal(sent[0].text, 'Hello there');
    assert.equal(sent[0].html, undefined);
  } finally {
    clear();
  }
});

test('send-email honours a server-configured support recipient', async () => {
  enabled();
  process.env.SUPPORT_EMAIL_TO = 'help@nodalx.in';
  try {
    const {handler: run, sent} = newHandler();
    const res = mockRes();
    await run(post({subject: 'Question', message: 'Hello'}), res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(sent[0].to, ['help@nodalx.in']);
  } finally {
    clear();
  }
});

test('send-email fails closed on an invalid configured recipient', async () => {
  enabled();
  process.env.SUPPORT_EMAIL_TO = 'not-an-email';
  try {
    const {handler: run, sent} = newHandler();
    const res = mockRes();
    await run(post({subject: 'Question', message: 'Hello'}), res);
    assert.equal(res.statusCode, 503);
    assert.equal(sent.length, 0);
  } finally {
    clear();
  }
});

test('send-email returns a generic error and never leaks provider detail', async () => {
  enabled();
  try {
    const handler = createSupportEmailHandler({
      store: new Map(),
      resendFactory: () => ({emails: {send: async () => ({data: null, error: {message: 'Resend internal: key re_re_123 leaked'}})}}),
    });
    const res = mockRes();
    await handler(post({subject: 'Question', message: 'Hello'}), res);
    assert.equal(res.statusCode, 502);
    assert.equal(res.body.error, 'Support email could not be delivered.');
    assert.doesNotMatch(JSON.stringify(res.body), /re_re_123|Resend internal/);
  } finally {
    clear();
  }
});

test('send-email rate limits repeated submissions from one client', async () => {
  enabled();
  try {
    let limited = 0;
    const shared = newHandler();
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const res = mockRes();
      await shared.handler(post({subject: 'Hi', message: 'Hello'}, {'x-forwarded-for': '198.51.100.77'}), res);
      if (res.statusCode === 429) {
        limited += 1;
        assert.equal(res.body.code, 'RATE_LIMITED');
        assert.equal(res.headers['Retry-After'], '600');
      }
    }
    assert.equal(limited, 7);
  } finally {
    clear();
  }
});

test('send-email does not rate limit a distinct client', async () => {
  enabled();
  try {
    const res = mockRes();
    await newHandler().handler(post({subject: 'Hi', message: 'Hello'}, {'x-forwarded-for': '198.51.100.200'}), res);
    assert.notEqual(res.body.code, 'RATE_LIMITED');
  } finally {
    clear();
  }
});
