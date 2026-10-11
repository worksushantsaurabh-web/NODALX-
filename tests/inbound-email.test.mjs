import assert from 'node:assert/strict';
import {test} from 'node:test';
import {acceptReceivedEmail, receivedAlias} from '../server/inbound-email.mjs';

const environment = {WORKSPACE_INBOUND_RECEIVING_ENABLED: 'true', WORKSPACE_EMAIL_DOMAIN: 'reply.nodalx.in',
  RESEND_WEBHOOK_SECRET: 'whsec_test', RESEND_API_KEY: 're_test'};

test('recipient extraction rejects multiple workspaces and lookalike domains', () => {
  assert.equal(receivedAlias({to: ['acme@reply.nodalx.in']}), 'acme');
  assert.equal(receivedAlias({to: ['acme@reply.nodalx.in', 'other@reply.nodalx.in']}), null);
  assert.equal(receivedAlias({to: ['acme@reply.nodalx.in.evil.com']}), null);
});

test('inbound remains closed until receiving is enabled and signature is verified', async () => {
  const disabled = await acceptReceivedEmail('{}', {}, {environment: {...environment, WORKSPACE_INBOUND_RECEIVING_ENABLED: 'false'}});
  assert.equal(disabled.status, 503);
  const invalid = await acceptReceivedEmail('{}', {}, {environment,
    resend: {webhooks: {verify() {throw Error('bad signature');}}}});
  assert.equal(invalid.status, 401);
});

test('verified inbound event retrieves content and stores it through the service RPC', async () => {
  let call;
  const result = await acceptReceivedEmail('{}', {'svix-id': 'id', 'svix-timestamp': '123', 'svix-signature': 'sig'}, {
    environment,
    resend: {webhooks: {verify() {return {type: 'email.received', data: {email_id: 'provider-id'}};}},
      emails: {receiving: {get: async () => ({data: {from: 'Lead <lead@example.com>',
        to: ['acme@reply.nodalx.in'], subject: 'Re: quote', text: 'Thanks', message_id: '<rfc-id>',
        headers: {'In-Reply-To': '<sent-rfc-id>'}}, error: null})}}},
    admin: {rpc: async (name, args) => {call = {name, args}; return {data: true, error: null};}},
  });
  assert.deepEqual(result, {status: 200, body: {accepted: true}});
  assert.equal(call.name, 'store_received_email_service');
  assert.equal(call.args.recipient_alias, 'acme');
  assert.equal(call.args.sender_address, 'lead@example.com');
  assert.equal(call.args.email_body, 'Thanks');
  assert.equal(call.args.in_reply_to, '<sent-rfc-id>');
});

test('HTML-only received mail is stored as escaped display text', async () => {
  let stored;
  const result = await acceptReceivedEmail('{}', {}, {environment,
    resend: {webhooks: {verify() {return {type: 'email.received', data: {email_id: 'provider-id'}};}},
      emails: {receiving: {get: async () => ({data: {from: 'lead@example.com',
        to: ['acme@reply.nodalx.in'], subject: 'Hello', text: null,
        html: '<script>steal()</script><p>Thanks &amp; hello</p>', message_id: '<id>'}, error: null})}}},
    admin: {rpc: async (_name, args) => {stored = args; return {data: true, error: null};}},
  });
  assert.equal(result.status, 200);
  assert.equal(stored.email_body, 'Thanks & hello');
});
