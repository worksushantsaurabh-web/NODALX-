import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createAwsApiServer} from '../server/aws-api-http.mjs';

async function withServer(run) {
  const server = createAwsApiServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
}

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
