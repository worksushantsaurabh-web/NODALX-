BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;
SELECT plan(20);

INSERT INTO auth.users(id, email_confirmed_at) VALUES
  ('00000000-0000-4000-8000-000000000041', now()),
  ('00000000-0000-4000-8000-000000000042', now());
INSERT INTO public.workspaces(id, name) VALUES ('alias-a', 'Acme'), ('alias-b', 'Other');
INSERT INTO public.identity_bindings(auth_user_id, workspace_id) VALUES
  ('00000000-0000-4000-8000-000000000041', 'alias-a'),
  ('00000000-0000-4000-8000-000000000042', 'alias-b');

SELECT isnt((SELECT email_alias FROM public.workspaces WHERE id = 'alias-a'),
  (SELECT email_alias FROM public.workspaces WHERE id = 'alias-b'), 'allocation is unique');
SELECT matches((SELECT email_alias FROM public.workspaces WHERE id = 'alias-a'),
  '^w-[a-f0-9]{20}$', 'allocation is deterministic and valid');
SELECT throws_ok($$UPDATE public.workspaces SET email_alias = 'valid-but-direct' WHERE id = 'alias-a'$$,
  '42501', NULL, 'even service writes need the dedicated action');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000041', true);
SELECT is((SELECT count(*) FROM public.workspaces), 1::bigint, 'owner reads only own workspace');
SELECT throws_ok($$UPDATE public.workspaces SET email_alias = 'hijack' WHERE id = 'alias-a'$$,
  '42501', NULL, 'browser cannot change alias');
SELECT throws_ok($$SELECT public.change_workspace_email_alias_service('alias-a', 'new-acme', '00000000-0000-4000-8000-000000000041')$$,
  '42501', NULL, 'browser cannot call service change action');
RESET ROLE;

SET LOCAL ROLE service_role;
SELECT throws_ok($$SELECT public.change_workspace_email_alias_service('alias-a', 'support', '00000000-0000-4000-8000-000000000041')$$,
  '22023', NULL, 'reserved alias rejected by database action');
SELECT throws_ok($$SELECT public.change_workspace_email_alias_service('alias-a', 'bad--alias', '00000000-0000-4000-8000-000000000041')$$,
  '22023', NULL, 'consecutive hyphens rejected by database action');
SELECT throws_ok($$SELECT public.change_workspace_email_alias_service('alias-b', 'stolen', '00000000-0000-4000-8000-000000000041')$$,
  '42501', NULL, 'wrong actor cannot change a workspace');
SELECT is(public.change_workspace_email_alias_service('alias-a', 'new-acme', '00000000-0000-4000-8000-000000000041'),
  'new-acme', 'owner-requested change succeeds');
SELECT is((SELECT count(*) FROM private.workspace_email_alias_history WHERE workspace_id = 'alias-a'),
  1::bigint, 'old alias retained in audit history');
SELECT is((SELECT new_alias FROM private.workspace_email_alias_history WHERE workspace_id = 'alias-a'),
  'new-acme', 'audit entry records the new alias');
SELECT throws_ok($$SELECT public.change_workspace_email_alias_service('alias-b',
  (SELECT alias FROM private.workspace_email_alias_history WHERE workspace_id = 'alias-a'),
  '00000000-0000-4000-8000-000000000042')$$, '23505', NULL, 'retired alias cannot be claimed');
SELECT throws_ok($$SELECT public.change_workspace_email_alias_service('alias-a', 'second-change', '00000000-0000-4000-8000-000000000041')$$,
  'P0001', NULL, 'change is limited to one per 24 hours');
INSERT INTO public.inquiries(workspace_id, id, original_message, email) VALUES
  ('alias-a', 'inquiry-a', 'Please quote', 'lead@example.com');
INSERT INTO public.outbound_emails(workspace_id, inquiry_id, request_key, payload_hash,
  recipient, subject, body, state, provider_rfc_message_id) VALUES
  ('alias-a', 'inquiry-a', 'request_123', repeat('a', 64),
   'lead@example.com', 'Quote', 'Here is a quote', 'sent', '<sent-id>');
SELECT is(public.store_received_email_service('mail-1', 'new-acme', 'lead@example.com', 'Hi', 'Message', '<id>', NULL),
  true, 'current alias accepts inbound mail');
SELECT is(public.store_received_email_service('mail-2',
  (SELECT alias FROM private.workspace_email_alias_history WHERE workspace_id = 'alias-a'),
  'lead@example.com', 'Hi', 'Old thread', '<id2>', NULL), true, 'retired alias still receives replies');
SELECT is((SELECT inquiry_id FROM public.inbound_emails WHERE provider_email_id = 'mail-1'),
  NULL, 'sender alone does not claim a conversation');
SELECT is(public.store_received_email_service('mail-3', 'new-acme', 'lead@example.com',
  'Re: Quote', 'Thanks', '<id3>', '<sent-id>'), true, 'message-id reply is stored');
SELECT is((SELECT inquiry_id FROM public.inbound_emails WHERE provider_email_id = 'mail-3'),
  'inquiry-a', 'RFC message id and stored recipient link the conversation');
SELECT lives_ok($$SELECT public.store_received_email_service('mail-1', 'new-acme', 'lead@example.com', 'Hi', 'Message', '<id>', NULL)$$,
  'provider retry is idempotent');

SELECT * FROM finish();
ROLLBACK;
