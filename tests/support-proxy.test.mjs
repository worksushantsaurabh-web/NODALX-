import {test} from 'node:test';
import assert from 'node:assert/strict';
import {signSupportProxy, verifiedSupportProxyIp} from '../server/support-proxy-auth.mjs';
import {createSupportProxy} from '../api/support-proxy.mjs';
import {createSupportEmailHandler} from '../api/send-email.mjs';

const key = 'ab'.repeat(32);
const body = {subject: 'Synthetic', message: 'Synthetic only'};
const timestamp = 1791964800;
test('support proxy verifies fresh body-bound IP and rejects forged, stale and altered claims', () => {
  const headers = signSupportProxy('192.0.2.1', body, key, timestamp);
  const request = {method: 'POST', headers, body};
  assert.equal(verifiedSupportProxyIp(request, key, timestamp), '192.0.2.1');
  assert.equal(verifiedSupportProxyIp(request, key, timestamp + 61), null);
  assert.equal(verifiedSupportProxyIp(request, key, timestamp - 61), null);
  assert.equal(verifiedSupportProxyIp({...request, body: {...body, message: 'changed'}}, key, timestamp), null);
  assert.equal(verifiedSupportProxyIp({...request, method: 'GET'}, key, timestamp), null);
  assert.equal(verifiedSupportProxyIp({...request, headers: {...headers, 'x-nodalx-client-ip': '192.0.2.2'}}, key, timestamp), null);
  assert.equal(verifiedSupportProxyIp(request, 'cd'.repeat(32), timestamp), null);
  assert.equal(verifiedSupportProxyIp({method: 'POST', headers: {'x-nodalx-client-ip': '192.0.2.1'}, body}, key, timestamp), null);
});

function response() {
  return {headers: {}, setHeader(name, value) {this.headers[name] = value;},
    status(value) {this.statusCode = value;return this;}, json(value) {this.body = value;return this;}};
}
test('support proxy overwrites caller claims and forwards only signed IP, Origin and JSON', async () => {
  let forwarded;
  const handler = createSupportProxy({environment: {VERCEL: '1', SUPPORT_PROXY_SIGNING_KEY: key},
    fetchImpl: async (url, options) => {forwarded = {url, options};
      return new Response(JSON.stringify({code: 'SUPPORT_EMAIL_DISABLED'}), {status: 503, headers: {via: '1.1 Caddy'}});}});
  const res = response();
  await handler({method: 'POST', body, headers: {origin: 'https://preview.example',
    'x-vercel-forwarded-for': '192.0.2.99', 'x-forwarded-for': '192.0.2.1',
    'x-nodalx-client-ip': '192.0.2.99', authorization: 'Bearer do-not-forward'}}, res);
  assert.equal(forwarded.url, 'https://api-staging.nodalx.in/api/send-email');
  assert.equal(forwarded.options.redirect, 'error');
  assert.equal(forwarded.options.headers.authorization, undefined);
  assert.equal(forwarded.options.headers.origin, 'https://preview.example');
  assert.equal(verifiedSupportProxyIp({method: 'POST', headers: forwarded.options.headers,
    body: JSON.parse(forwarded.options.body)}, key), '192.0.2.1');
  assert.equal(res.statusCode, 503);
  assert.equal(res.headers.via, '1.1 Caddy');
});
test('support proxy fails closed without platform identity, valid IP, key or Origin', async () => {
  let calls = 0;
  const request = {method: 'POST', body, headers: {origin: 'https://preview.example', 'x-forwarded-for': '192.0.2.1'}};
  for (const environment of [{}, {VERCEL: '1'}, {VERCEL: '0', SUPPORT_PROXY_SIGNING_KEY: key}]) {
    const res = response();
    await createSupportProxy({environment, fetchImpl: async () => {calls++;}})(request, res);
    assert.equal(res.statusCode, 503);
  }
  for (const headers of [{origin: 'https://preview.example', 'x-forwarded-for': '192.0.2.1, 192.0.2.2'},
    {'x-forwarded-for': '192.0.2.1'}]) {
    const res = response();
    await createSupportProxy({environment: {VERCEL: '1', SUPPORT_PROXY_SIGNING_KEY: key},
      fetchImpl: async () => {calls++;}})({...request, headers}, res);
    assert.ok([403,503].includes(res.statusCode));
  }
  assert.equal(calls, 0);
});

test('AWS support limits signed callers independently behind one proxy without sending emails', async () => {
  const values = {SUPPORT_EMAIL_ENABLED: 'true', RESEND_API_KEY: 're_synthetic',
    SUPPORT_EMAIL_ALLOWED_ORIGINS: 'https://preview.example', SUPPORT_PROXY_SIGNING_KEY: key};
  const previous = Object.fromEntries(Object.keys(values).map(name => [name, process.env[name]]));
  Object.assign(process.env, values);
  let sends = 0;
  const handler = createSupportEmailHandler({store: new Map(), resendFactory: () => {sends++;throw Error('Unexpected send');}});
  const invoke = async ip => {
    const res = response();
    await handler({method: 'POST', body: {}, headers: {origin: 'https://preview.example',
      'x-forwarded-for': '198.51.100.1', ...signSupportProxy(ip, {}, key)}}, res);
    return res.statusCode;
  };
  try {
    for (let i = 0; i < 5; i++) assert.equal(await invoke('192.0.2.1'), 400);
    assert.equal(await invoke('192.0.2.1'), 429);
    assert.equal(await invoke('192.0.2.2'), 400);
    assert.equal(sends, 0);
  } finally {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  }
});
