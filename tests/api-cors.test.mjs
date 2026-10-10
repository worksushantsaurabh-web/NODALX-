import {test} from 'node:test';
import assert from 'node:assert/strict';
import {apiCorsPolicy} from '../server/api-cors.mjs';

const origin = 'https://nodalx-frontend-git-nod-04bf63-worksushantsaurabh-web-projects.vercel.app';

test('API CORS allows only the configured staging frontend origin', () => {
  const allowed = apiCorsPolicy({headers: {origin}}, {API_ALLOWED_ORIGINS: origin});
  assert.equal(allowed.allowed, true);
  assert.equal(allowed.headers['Access-Control-Allow-Origin'], origin);
  assert.match(allowed.headers['Access-Control-Allow-Headers'], /Authorization/);
  assert.match(allowed.headers['Access-Control-Allow-Headers'], /Idempotency-Key/);

  const rejected = apiCorsPolicy({headers: {origin: 'https://attacker.example'}}, {API_ALLOWED_ORIGINS: origin});
  assert.equal(rejected.allowed, false);
  assert.equal(Object.hasOwn(rejected.headers, 'Access-Control-Allow-Origin'), false);
});

test('server-to-server requests without Origin do not require browser CORS', () => {
  assert.deepEqual(apiCorsPolicy({headers: {}}, {}), {allowed: true, headers: {Vary: 'Origin'}});
});
