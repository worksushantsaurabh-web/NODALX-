import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import path from 'node:path';
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

test('AWS API package includes every local runtime import', () => {
  const packageSource = readFileSync(new URL('../scripts/package-aws-api.mjs', import.meta.url), 'utf8');
  const list = packageSource.match(/const files = \[([\s\S]*?)\];/)[1];
  const files = new Set([...list.matchAll(/'([^']+)'/g)].map(match => match[1]));
  const queue = ['server/aws-api-http.mjs', 'scripts/start-aws-api-from-secrets.mjs'];
  const visited = new Set();
  while (queue.length) {
    const file = queue.shift();
    if (visited.has(file)) continue;
    visited.add(file);
    assert.ok(files.has(file), `${file} missing from AWS API package`);
    const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    for (const match of source.matchAll(/(?:from\s+|import\()'(\.[^']+)'/g)) {
      queue.push(path.posix.normalize(path.posix.join(path.posix.dirname(file), match[1])));
    }
  }
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
  // Staging cutover routing: an ordered route ahead of filesystem matching sends
  // all /api/* to the AWS staging API; the rewrite is the fallback for the same
  // destination. Physical Vercel function files still exist, so an unordered
  // rewrite alone would lose the race and serve Vercel handlers instead of AWS.
  assert.deepEqual(config.routes?.[0], {src: '/api/send-email', dest: '/api/support-proxy'});
  const route = config.routes?.[1];
  assert.ok(route, 'ordered /api route to the AWS staging API is required');
  assert.match(route.src, /^\/api\//);
  assert.equal(route.dest, 'https://api-staging.nodalx.in/api/$1');
  assert.equal(config.rewrites[0].destination, '/api/support-proxy');
  assert.equal(config.rewrites[1].destination, 'https://api-staging.nodalx.in/api/:path*');
  assert.equal(config.functions['api/contact.mjs'].maxDuration, 60);
  assert.match(config.installCommand, /npm ci --omit=dev/);
  assert.match(config.installCommand, /frontend ci --include=dev/);
  const allowlist = readFileSync(new URL('../.vercelignore', import.meta.url), 'utf8').split('\n');
  for (const file of ['api/migration.mjs', 'api/automation.mjs', 'server/make-processing.mjs', 'server/processing-daemon.mjs', 'server/processing-worker.mjs', 'server/gemini-processor.mjs', 'server/supabase-account.mjs', 'server/rds-client.mjs', 'server/supabase-workspace.mjs', 'server/outbound-email.mjs', 'certs/rds-us-east-1-bundle.pem', 'package-lock.json']) {
    assert.ok(allowlist.includes(`!${file}`));
  }
  // A hand-maintained list cannot catch a newly added server module, and a
  // missing entry ships a function that dies at runtime with
  // ERR_MODULE_NOT_FOUND even though the build is green. Derive the required
  // set from the imports the deployed entrypoints actually use.
  const entrypoints = ['api/migration.mjs', 'api/automation.mjs', 'api/contact.mjs', 'api/intake.mjs',
    'api/feedback.mjs', 'api/send-email.mjs', 'api/support-proxy.mjs', 'api/user/profile.mjs'];
  const deployed = new Set(['certs/rds-us-east-1-bundle.pem', 'package.json', 'package-lock.json', 'vercel.json']);
  const queue = [...entrypoints];
  while (queue.length) {
    const file = queue.shift();
    const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    for (const match of source.matchAll(/from\s+'(\.[^']+)'/g)) {
      const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(file), match[1]));
      if (deployed.has(resolved)) continue;
      deployed.add(resolved);
      queue.push(resolved);
    }
  }
  for (const file of deployed) {
    assert.ok(allowlist.includes(`!${file}`), `${file} is reachable at runtime but missing from .vercelignore`);
  }
});
