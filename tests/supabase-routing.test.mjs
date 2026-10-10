import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import handler from '../api/migration.mjs';

test('migration routing preserves public liveness without requiring an account', async () => {
  const headers = {};
  let status;
  let body;
  const response = {
    setHeader(name, value) {headers[name] = value;},
    status(value) {status = value; return this;},
    json(value) {body = value; return this;},
  };
  await handler({url: '/api/migration?path=health/live', method: 'GET', headers: {}}, response);
  assert.equal(status, 200);
  assert.equal(body.status, 'alive');
  assert.equal(headers['Cache-Control'], 'no-store');
});

test('protected migration routes cannot bypass authentication through the router', async () => {
  let status;
  let body;
  const response = {
    setHeader() {},
    status(value) {status = value; return this;},
    json(value) {body = value; return this;},
  };
  await handler({url: '/api/migration?path=workspace/inquiries&limit=1', method: 'GET', headers: {}}, response);
  assert.equal(status, 401);
  assert.equal(typeof body.requestId, 'string');
});

test('the root deployment bundles Supabase handlers instead of proxying suspended Firebase', () => {
  const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  assert.equal(existsSync(new URL('../frontend/vercel.json', import.meta.url)), false);
  assert.equal(config.rewrites.some(rule => rule.destination.includes('firebase') || rule.destination.includes('web.app')), false);
  assert.equal(config.rewrites[0].destination, '/api/migration?path=:path*');
  assert.equal(config.functions['api/contact.mjs'].maxDuration, 60);
  assert.match(config.installCommand, /npm ci --omit=dev/);
  assert.match(config.installCommand, /frontend ci --include=dev/);
  const allowlist = readFileSync(new URL('../.vercelignore', import.meta.url), 'utf8').split('\n');
  assert.match(config.rewrites[0].source, /automation/);
  for (const file of ['api/migration.mjs', 'api/automation.mjs', 'server/make-processing.mjs', 'server/processing-daemon.mjs', 'server/processing-worker.mjs', 'server/gemini-processor.mjs', 'server/supabase-account.mjs', 'server/rds-client.mjs', 'server/supabase-workspace.mjs', 'server/outbound-email.mjs', 'certs/rds-us-east-1-bundle.pem', 'package-lock.json']) {
    assert.ok(allowlist.includes(`!${file}`));
  }
});
