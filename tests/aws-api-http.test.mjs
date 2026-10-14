import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createHmac} from 'node:crypto';
import {createAwsApiServer} from '../server/aws-api-http.mjs';

async function withServer(run, options) {
  const server = createAwsApiServer({logger: {info() {}, error() {}}, ...options});
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
}

test('AWS access log correlates a response without recording query strings or credentials', async () => {
  const entries = [];
  await withServer(async origin => {
    const result = await fetch(`${origin}/api/workspace/overview?secret=do-not-log`, {
      headers: {Authorization: 'Bearer do-not-log'},
    });
    assert.equal(result.status, 503);
    assert.equal(entries.length, 1);
    assert.deepEqual(entries[0], {
      method: 'GET', route: '/api/workspace/*', status: 503,
      requestId: result.headers.get('x-request-id'),
    });
    assert.ok(!JSON.stringify(entries).includes('do-not-log'));
  }, {logger: {info(_message, fields) { entries.push(fields); }, error() {}}});
});

test('AWS adapter preserves catch-all and direct route behavior without credentials', async () => {
  await withServer(async origin => {
    const live = await fetch(`${origin}/api/health/live`);
    assert.equal(live.status, 200);
    assert.deepEqual(await live.json(), {status: 'alive'});
    const privateRoute = await fetch(`${origin}/api/workspace/inquiries`);
    assert.equal(privateRoute.status, 401);
    const missing = await fetch(`${origin}/elsewhere`);
    assert.equal(missing.status, 404);
  });
});

test('AWS adapter enforces JSON parsing while preserving raw Resend webhook body', async () => {
  await withServer(async origin => {
    const malformed = await fetch(`${origin}/api/contact`, {method: 'POST',
      headers: {'content-type': 'application/json'}, body: '{bad'});
    assert.equal(malformed.status, 400);
    assert.equal((await malformed.json()).code, 'INVALID_INPUT');
    const unsupported = await fetch(`${origin}/api/contact`, {method: 'POST',
      headers: {'content-type': 'text/plain'}, body: '{}'});
    assert.equal(unsupported.status, 400);
    const inbound = await fetch(`${origin}/api/resend-inbound`, {method: 'POST',
      headers: {'content-type': 'application/json'}, body: '{}'});
    assert.equal(inbound.status, 503);
    assert.equal((await inbound.json()).code, 'INBOUND_DISABLED');
  });
});

test('AWS adapter dispatches every dedicated route with its existing failure gate', async () => {
  const old = {
    DATA_BACKEND: process.env.DATA_BACKEND,
    RDS_INTAKE_ENABLED: process.env.RDS_INTAKE_ENABLED,
    SUPPORT_EMAIL_ENABLED: process.env.SUPPORT_EMAIL_ENABLED,
    WORKSPACE_INBOUND_RECEIVING_ENABLED: process.env.WORKSPACE_INBOUND_RECEIVING_ENABLED,
  };
  process.env.DATA_BACKEND = 'rds';
  process.env.RDS_INTAKE_ENABLED = 'false';
  process.env.SUPPORT_EMAIL_ENABLED = 'false';
  process.env.WORKSPACE_INBOUND_RECEIVING_ENABLED = 'false';
  try {
    await withServer(async origin => {
      const paths = [
        ['/api/contact', 'INTAKE_DISABLED'],
        ['/api/send-email', 'SUPPORT_EMAIL_DISABLED'],
        ['/api/resend-inbound', 'INBOUND_DISABLED'],
      ];
      for (const [path, code] of paths) {
        const result = await fetch(`${origin}${path}`, {method: 'POST',
          headers: {'content-type': 'application/json'}, body: '{}'});
        assert.equal((await result.json()).code, code, path);
      }
      for (const [path, method] of [['/api/feedback', 'POST'], ['/api/user/profile', 'GET']]) {
        const result = await fetch(`${origin}${path}`, {method});
        assert.equal(result.status, 401, path);
      }
      const unknown = await fetch(`${origin}/api/unrecognized`);
      assert.equal(unknown.status, 401);
    });
  } finally {
    for (const [key, value] of Object.entries(old)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test('AWS adapter preserves signed raw webhook bytes and rejects missing, forged and expired signatures', async () => {
  const values = {WORKSPACE_INBOUND_RECEIVING_ENABLED: 'true',
    WORKSPACE_EMAIL_DOMAIN: 'reply.nodalx.in', RESEND_API_KEY: 're_synthetic_stage6c',
    RESEND_WEBHOOK_SECRET: `whsec_${Buffer.from('synthetic-stage6c-key').toString('base64')}`};
  const previous = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]));
  Object.assign(process.env, values);
  const payload = '{\n  "type": "stage6c.ignored", "data": {}\n}\n';
  const id = 'msg_stage6c_synthetic';
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = time => `v1,${createHmac('sha256', Buffer.from('synthetic-stage6c-key'))
    .update(`${id}.${time}.${payload}`).digest('base64')}`;
  try {
    await withServer(async origin => {
      const send = headers => fetch(`${origin}/api/resend-inbound`, {method: 'POST',
        headers: {'content-type': 'application/json', ...headers}, body: payload});
      const valid = await send({'svix-id': id, 'svix-timestamp': timestamp,
        'svix-signature': signature(timestamp)});
      assert.equal(valid.status, 200);
      assert.deepEqual(await valid.json(), {accepted: false});
      const expired = String(Number(timestamp) - 600);
      for (const headers of [{}, {'svix-id': id, 'svix-timestamp': timestamp,
        'svix-signature': 'v1,Zm9yZ2Vk'}, {'svix-id': id, 'svix-timestamp': expired,
        'svix-signature': signature(expired)}]) {
        const result = await send(headers);
        assert.equal(result.status, 401);
        assert.deepEqual(await result.json(), {code: 'INVALID_WEBHOOK'});
      }
    });
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
