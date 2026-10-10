import assert from 'node:assert/strict';
import {test} from 'node:test';
import {sendInquiryEmail, validateOutboundEmail} from '../server/outbound-email.mjs';

test('outbound email validation requires explicit confirmation and rejects header injection', () => {
  assert.throws(() => validateOutboundEmail({requestKey: 'request_123', subject: 'Hello', body: 'Message', confirmed: false}), /Review and confirm/);
  assert.throws(() => validateOutboundEmail({requestKey: 'request_123', subject: 'Hello\nBcc: x@example.com', body: 'Message', confirmed: true}), /line breaks/);
  assert.deepEqual(validateOutboundEmail({requestKey: 'request_123', subject: ' Hello ', body: ' Message ', confirmed: true}),
    {requestKey: 'request_123', subject: 'Hello', body: 'Message'});
});

test('outbound email fails closed before reserving when provider configuration is disabled', async () => {
  let called = false;
  await assert.rejects(sendInquiryEmail({client: {rpc() {called = true;}}, workspaceId: 'ws', inquiryId: 'inq',
    body: {requestKey: 'request_123', subject: 'Hello', body: 'Message', confirmed: true}}, {environment: {}}), error => error.code === 'EMAIL_DISABLED');
  assert.equal(called, false);
});

test('outbound email uses stored recipient, provider idempotency and marks accepted mail sent', async () => {
  const updates = [];
  const admin = {rpc: async () => ({error: null, data: {created: true, id: 'mail-id', state: 'prepared',
    recipient: 'lead@example.com', subject: 'Hello', body: 'Message'}}), from(table) {
    if (table === 'outbound_emails') return {update(value) {updates.push({table, value}); return chain({id: 'mail-id'});}};
    if (table === 'inquiries') return {
      select() {return chain({status: 'Qualified'});},
      update(value) {updates.push({table, value}); return chain(null, false);},
    };
    if (table === 'inquiry_events') return {insert(value) {updates.push({table, value}); return Promise.resolve({error: null});}};
    throw new Error(`Unexpected table ${table}`);
  }};
  let request;
  const result = await sendInquiryEmail({workspaceId: 'workspace-a', inquiryId: 'inquiry-a',
    body: {requestKey: 'request_123', subject: 'Hello', body: 'Message', confirmed: true}}, {
    environment: {OUTBOUND_EMAIL_ENABLED: 'true', RESEND_API_KEY: 'server-secret', OUTBOUND_EMAIL_FROM: 'NodalX <reply@nodalx.in>',
      SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'service-secret'},
    createClient: () => admin,
    fetch: async (url, init) => {request = {url, init}; return {ok: true, json: async () => ({id: 'provider-id'})};},
  });
  assert.equal(result.sent, true);
  assert.equal(request.url, 'https://api.resend.com/emails');
  assert.equal(request.init.headers['Idempotency-Key'], 'nodalx/workspace-a/request_123');
  assert.deepEqual(JSON.parse(request.init.body).to, ['lead@example.com']);
  assert.equal(updates.some(update => update.table === 'inquiries' && update.value.status === 'Contacted'), true);
  assert.equal(updates.some(update => update.table === 'inquiry_events' && update.value.changes.emailSent === true), true);
});

function chain(data, terminal = true) {
  const value = {
    eq() {return value;}, select() {return value;},
    maybeSingle() {return Promise.resolve({data, error: null});},
    then(resolve) {return terminal ? Promise.resolve({data, error: null}).then(resolve) : Promise.resolve({error: null}).then(resolve);},
  };
  return value;
}
