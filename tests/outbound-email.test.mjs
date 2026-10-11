import assert from 'node:assert/strict';
import {test} from 'node:test';
import {sendInquiryEmail, validateOutboundEmail, senderFor, safeSenderName} from '../server/outbound-email.mjs';

test('managed sender stays gated and sanitizes the company name', () => {
  const environment = {OUTBOUND_EMAIL_FROM: 'NodalX <reply@nodalx.in>',
    WORKSPACE_EMAIL_DOMAIN: 'reply.nodalx.in', WORKSPACE_INBOUND_ENABLED: 'true',
    WORKSPACE_INBOUND_RECEIVING_ENABLED: 'true'};
  const workspace = {name: 'Acme\r\nBcc: x@example.com <bad> "Co"', email_alias: 'acme'};
  assert.deepEqual(senderFor('owner@gmail.com', environment, workspace), {
    from: 'Acme Bcc: bad Co <acme@reply.nodalx.in>', replyTo: 'acme@reply.nodalx.in',
  });
  assert.equal(safeSenderName('My Workspace', 'Owner'), 'Owner');
  assert.equal(safeSenderName('My Workspace', 'User'), 'NodalX');
  assert.equal(senderFor('owner@gmail.com', {...environment, WORKSPACE_INBOUND_RECEIVING_ENABLED: 'false'}, workspace).from,
    'NodalX <reply@nodalx.in>');
  assert.equal(senderFor('owner@gmail.com', environment, {...workspace, email_alias: 'x\r\nBcc'}).from,
    'NodalX <reply@nodalx.in>');
});

test('managed send reads the workspace alias on the server and replies return to it', async () => {
  let sent; let savedMessageId;
  const admin = {rpc: async () => ({error: null, data: {created: true, id: 'mail-id', state: 'prepared',
    recipient: 'lead@example.com', subject: 'Hello', body: 'Message'}}), from(table) {
    if (table === 'workspaces') return {select() {return chain({name: 'Acme', email_alias: 'acme'});}};
    if (table === 'profiles') return {select() {return chain({display_name: 'Owner'});}};
    if (table === 'inquiries') return {select() {return chain({status: 'Qualified'});}, update() {return chain(null, false);}};
    if (table === 'inquiry_events') return {insert() {return Promise.resolve({error: null});}};
    return {update(value) {savedMessageId = value.provider_rfc_message_id; return chain({id: 'mail-id'});}};
  }};
  await sendInquiryEmail({workspaceId: 'workspace-a', inquiryId: 'inquiry-a', accountEmail: 'owner@gmail.com',
    body: {requestKey: 'request_123', subject: 'Hello', body: 'Message', confirmed: true}}, {
    environment: {OUTBOUND_EMAIL_ENABLED: 'true', RESEND_API_KEY: 'test',
      OUTBOUND_EMAIL_FROM: 'NodalX <reply@nodalx.in>', WORKSPACE_INBOUND_ENABLED: 'true',
      WORKSPACE_INBOUND_RECEIVING_ENABLED: 'true', WORKSPACE_EMAIL_DOMAIN: 'reply.nodalx.in',
      SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'test'},
    createClient: () => admin,
    fetch: async (_url, init) => {
      if (!init.body) return {ok: true, json: async () => ({message_id: '<sent-rfc-id>'})};
      sent = JSON.parse(init.body); return {ok: true, json: async () => ({id: 'provider-id'})};
    },
  });
  assert.equal(sent.from, 'Acme <acme@reply.nodalx.in>');
  assert.equal(sent.reply_to, 'acme@reply.nodalx.in');
  assert.deepEqual(sent.to, ['lead@example.com']);
  assert.equal(savedMessageId, '<sent-rfc-id>');
});

test('missing managed alias fails before an outbound reservation', async () => {
  let reserved = false;
  await assert.rejects(sendInquiryEmail({workspaceId: 'workspace-a', inquiryId: 'inquiry-a',
    body: {requestKey: 'request_123', subject: 'Hello', body: 'Message', confirmed: true}}, {
    environment: {OUTBOUND_EMAIL_ENABLED: 'true', RESEND_API_KEY: 'test',
      OUTBOUND_EMAIL_FROM: 'NodalX <reply@nodalx.in>', WORKSPACE_INBOUND_ENABLED: 'true',
      WORKSPACE_INBOUND_RECEIVING_ENABLED: 'true', WORKSPACE_EMAIL_DOMAIN: 'reply.nodalx.in',
      SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'test'},
    createClient: () => ({rpc() {reserved = true;}, from() {return {select() {return chain({name: 'Acme', email_alias: null});}};}}),
  }), error => error.code === 'EMAIL_UNAVAILABLE');
  assert.equal(reserved, false);
});

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

test('sender uses the verified account address only on a sendable domain and always falls back safely', () => {
  const environment = {OUTBOUND_EMAIL_FROM: 'NodalX <reply@nodalx.in>'};
  // Same verified domain: send directly from the operator's own address.
  assert.deepEqual(senderFor('sales@nodalx.in', environment), {from: 'sales@nodalx.in', replyTo: 'sales@nodalx.in'});
  assert.deepEqual(senderFor('Sales@NodalX.in', {OUTBOUND_EMAIL_FROM: 'NodalX <reply@nodalx.in>', OUTBOUND_EMAIL_DISPLAY_NAME: 'NodalX'}),
    {from: 'NodalX <sales@nodalx.in>', replyTo: 'sales@nodalx.in'});
  // Unverified/foreign domain: providers cannot send as it, so keep the NodalX
  // sender and route replies to the operator.
  assert.deepEqual(senderFor('owner@gmail.com', environment), {from: 'NodalX <reply@nodalx.in>', replyTo: 'owner@gmail.com'});
  // A lookalike domain must never be treated as sendable.
  assert.deepEqual(senderFor('attacker@nodalx.in.evil.com', environment), {from: 'NodalX <reply@nodalx.in>', replyTo: 'attacker@nodalx.in.evil.com'});
  // Missing or malformed identity keeps the configured sender with no reply-to.
  assert.deepEqual(senderFor(undefined, environment), {from: 'NodalX <reply@nodalx.in>', replyTo: null});
  assert.deepEqual(senderFor('not-an-email', environment), {from: 'NodalX <reply@nodalx.in>', replyTo: null});
  assert.deepEqual(senderFor('a@b.com\r\nBcc: x@evil.com', environment), {from: 'NodalX <reply@nodalx.in>', replyTo: null});
});

test('outbound email prefers the operator address as sender and sets reply-to otherwise', async () => {
  async function sentBody(accountEmail) {
    let request;
    await sendInquiryEmail({workspaceId: 'workspace-a', inquiryId: 'inquiry-a', accountEmail,
      body: {requestKey: 'request_123', subject: 'Hello', body: 'Message', confirmed: true}}, {
      environment: {OUTBOUND_EMAIL_ENABLED: 'true', RESEND_API_KEY: 'server-secret', OUTBOUND_EMAIL_FROM: 'NodalX <reply@nodalx.in>',
        SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'service-secret'},
      createClient: () => ({rpc: async () => ({error: null, data: {created: true, id: 'mail-id', state: 'prepared',
        recipient: 'lead@example.com', subject: 'Hello', body: 'Message'}}),
        from(table) {
          if (table === 'inquiries') return {select() {return chain({status: 'Qualified'});},
            update() {return chain(null, false);}};
          if (table === 'inquiry_events') return {insert() {return Promise.resolve({error: null});}};
          return {update() {return chain({id: 'mail-id'});}};
        }}),
      fetch: async (url, init) => {request = {url, init}; return {ok: true, json: async () => ({id: 'provider-id'})};},
    });
    return JSON.parse(request.init.body);
  }
  const owned = await sentBody('sales@nodalx.in');
  assert.equal(owned.from, 'sales@nodalx.in');
  assert.equal(owned.reply_to, 'sales@nodalx.in');
  const external = await sentBody('owner@gmail.com');
  assert.equal(external.from, 'NodalX <reply@nodalx.in>');
  assert.equal(external.reply_to, 'owner@gmail.com');
  assert.deepEqual(external.to, ['lead@example.com'], 'the lead still receives the reply at their own address');
});

function chain(data, terminal = true) {
  const value = {
    eq() {return value;}, select() {return value;},
    maybeSingle() {return Promise.resolve({data, error: null});},
    then(resolve) {return terminal ? Promise.resolve({data, error: null}).then(resolve) : Promise.resolve({error: null}).then(resolve);},
  };
  return value;
}
