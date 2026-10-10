import { test } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/send-email.mjs';

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

test('send-email rejects non-POST methods with 405', async () => {
  const req = { method: 'GET' };
  const res = mockRes();
  await handler(req, res);
  assert.equal(res.statusCode, 405);
  assert.equal(res.body.success, false);
});

test('send-email returns 500 if RESEND_API_KEY is missing', async () => {
  const previous = process.env.RESEND_API_KEY;
  delete process.env.RESEND_API_KEY;
  try {
    const req = { method: 'POST', body: { to: 'test@example.com', subject: 'Hi', message: 'Hello' } };
    const res = mockRes();
    await handler(req, res);
    assert.equal(res.statusCode, 500);
    assert.equal(res.body.success, false);
    assert.match(res.body.error, /RESEND_API_KEY/);
  } finally {
    if (previous) process.env.RESEND_API_KEY = previous;
  }
});

test('send-email validates required fields', async () => {
  process.env.RESEND_API_KEY = 're_mock_test_key';
  try {
    // Missing "to"
    const req1 = { method: 'POST', body: { subject: 'Hi', message: 'Hello' } };
    const res1 = mockRes();
    await handler(req1, res1);
    assert.equal(res1.statusCode, 400);
    assert.match(res1.body.error, /"to"/);

    // Invalid "to"
    const req2 = { method: 'POST', body: { to: 'invalid-email', subject: 'Hi', message: 'Hello' } };
    const res2 = mockRes();
    await handler(req2, res2);
    assert.equal(res2.statusCode, 400);

    // Missing "subject"
    const req3 = { method: 'POST', body: { to: 'user@example.com', message: 'Hello' } };
    const res3 = mockRes();
    await handler(req3, res3);
    assert.equal(res3.statusCode, 400);
    assert.match(res3.body.error, /"subject"/);

    // Missing "message" / "html"
    const req4 = { method: 'POST', body: { to: 'user@example.com', subject: 'Hi' } };
    const res4 = mockRes();
    await handler(req4, res4);
    assert.equal(res4.statusCode, 400);
    assert.match(res4.body.error, /"message"/);
  } finally {
    delete process.env.RESEND_API_KEY;
  }
});
