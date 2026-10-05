import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHandler} from '../aws/handlers/contact.mjs';

const environment = {APPS_SCRIPT_WEB_APP_URL: 'https://script.google.com/macros/s/AKfytest/exec', APPS_SCRIPT_INTAKE_SECRET: 'test-only-secret'};
const payload = {name: 'Mira', email: 'mira@example.test', company: 'Example', message: 'Hello'};
const event = {version: '2.0', rawPath: '/api/contact', requestContext: {http: {method: 'POST'}},
  headers: {'Idempotency-Key': 'lambda-request'}, body: JSON.stringify(payload)};

test('AWS HTTP API adapter uses the same validated intake and stable request ID', async () => {
  let sent;
  const handler = createHandler({environment, fetcher: async (url, options) => {
    sent = JSON.parse(options.body);
    return {ok: true, json: async () => ({success: true, rowId: 'lambda-request'})};
  }});
  for (const input of [event, {...event, isBase64Encoded: true, body: Buffer.from(event.body).toString('base64')}]) {
    const result = await handler(input);
    assert.equal(result.statusCode, 202);
    assert.equal(JSON.parse(result.body).accepted, true);
    assert.equal(sent.requestId, 'lambda-request');
    assert.equal(JSON.stringify(result).includes(environment.APPS_SCRIPT_INTAKE_SECRET), false);
  }
});

test('AWS adapter rejects unknown routes, invalid encoding and excessive bodies without provider calls', async () => {
  const handler = createHandler({environment, fetcher: async () => {throw Error('Unexpected provider call');}});
  assert.equal((await handler({...event, rawPath: '/api/workspace/inquiries'})).statusCode, 404);
  assert.equal((await handler({...event, version: '1.0'})).statusCode, 404);
  assert.equal((await handler({...event, isBase64Encoded: true, body: 'invalid!!!'})).statusCode, 400);
  assert.equal((await handler({...event, body: 'x'.repeat(30001)})).statusCode, 413);
  assert.equal((await handler({...event, body: '{}'})).statusCode, 400);
  assert.equal((await handler({...event, requestContext: {http: {method: 'GET'}}})).statusCode, 405);
});

test('AWS template is explicitly intake-only with secret references and stage throttling', async () => {
  const template = JSON.parse(await readFile(new URL('../aws/template.json', import.meta.url), 'utf8'));
  const properties = template.Resources.ContactFunction.Properties;
  assert.equal(properties.Runtime, 'nodejs22.x');
  assert.equal(properties.Events.Contact.Properties.Path, '/api/contact');
  assert.equal(properties.CodeUri, 'build/intake/');
  assert.equal(Object.keys(properties.Events).length, 1);
  assert.match(properties.Environment.Variables.APPS_SCRIPT_INTAKE_SECRET['Fn::Sub'], /resolve:secretsmanager/);
  assert.equal(template.Resources.ContactApi.Properties.DefaultRouteSettings.ThrottlingRateLimit, 1);
  assert.equal(template.Resources.ContactLogs.Properties.RetentionInDays, 14);
});

test('Vercel rewrites reserve contact for the local function and do not rewrite unknown API routes to HTML', async () => {
  const configuration = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
  assert.ok(configuration.rewrites[0].source.includes('(?!contact'));
  assert.ok(configuration.rewrites[1].source.includes('(?!api'));
  const legacyApi = new RegExp(`^/api/${configuration.rewrites[0].source.slice('/api/:path('.length, -1)}$`);
  const spa = new RegExp(`^/${configuration.rewrites[1].source.slice('/:path('.length, -1)}$`);
  for (const path of ['/api/contact', '/api/contact/nested']) {
    assert.equal(legacyApi.test(path), false);
    assert.equal(spa.test(path), false);
  }
  for (const path of ['/api/health/live', '/api/workspace/inquiries']) {
    assert.equal(legacyApi.test(path), true);
    assert.equal(spa.test(path), false);
  }
  for (const path of ['/', '/dashboard', '/contact', '/application']) {
    assert.equal(legacyApi.test(path), false);
    assert.equal(spa.test(path), true);
  }
});
