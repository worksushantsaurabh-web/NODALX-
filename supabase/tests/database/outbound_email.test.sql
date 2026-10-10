BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;
SELECT plan(10);

INSERT INTO auth.users(id, email_confirmed_at) VALUES
  ('00000000-0000-4000-8000-000000000031', now()),
  ('00000000-0000-4000-8000-000000000032', now());
INSERT INTO public.workspaces(id) VALUES ('email-a'), ('email-b');
INSERT INTO public.identity_bindings(auth_user_id, workspace_id) VALUES
  ('00000000-0000-4000-8000-000000000031', 'email-a'),
  ('00000000-0000-4000-8000-000000000032', 'email-b');
INSERT INTO public.inquiries(workspace_id, id, original_message, email) VALUES
  ('email-a', 'owned', 'Original A', 'Lead@Example.com'),
  ('email-b', 'foreign', 'Original B', 'foreign@example.com');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000031', true);
SELECT throws_ok($$SELECT public.prepare_own_outbound_email('owned', 'request_001', 'Hello', 'Message', repeat('a', 64))$$, '42883', NULL, 'browser reservation RPC is unavailable');
SELECT throws_ok($$INSERT INTO public.outbound_emails(workspace_id, inquiry_id, request_key, payload_hash, recipient, subject, body) VALUES ('email-a', 'owned', 'request_bad', repeat('d', 64), 'other@example.com', 'Hello', 'Message')$$, '42501', NULL, 'browser cannot bypass reservation');
RESET ROLE;
SET LOCAL ROLE service_role;
SELECT lives_ok($$SELECT public.reserve_outbound_email_service('email-a', 'owned', 'request_001', 'Hello', 'Message', repeat('a', 64))$$, 'service reservation succeeds');
SELECT is((SELECT state FROM public.outbound_emails WHERE workspace_id = 'email-a'), 'prepared', 'reservation starts prepared');
SELECT is((SELECT recipient FROM public.outbound_emails WHERE workspace_id = 'email-a'), 'lead@example.com', 'recipient comes from the stored inquiry');
SELECT is((public.reserve_outbound_email_service('email-a', 'owned', 'request_001', 'Hello', 'Message', repeat('a', 64))->>'created')::boolean, false, 'same request replays without another send');
SELECT is((SELECT count(*) FROM public.outbound_emails WHERE workspace_id = 'email-a'), 1::bigint, 'replay creates no duplicate ledger row');
SELECT throws_ok($$SELECT public.reserve_outbound_email_service('email-a', 'owned', 'request_001', 'Changed', 'Message', repeat('b', 64))$$, 'P0409', NULL, 'changed content conflicts');
SELECT throws_ok($$SELECT public.reserve_outbound_email_service('email-a', 'foreign', 'request_002', 'Hello', 'Message', repeat('c', 64))$$, 'P0002', NULL, 'foreign inquiry cannot be addressed through the owned workspace');
SELECT public.reserve_outbound_email_service('email-a', 'owned', 'request_' || number, 'Hello', 'Message', md5(number::text) || md5(number::text)) FROM generate_series(2, 10) number;
SELECT throws_ok($$SELECT public.reserve_outbound_email_service('email-a', 'owned', 'request_011', 'Hello', 'Message', repeat('e', 64))$$, 'P0001', NULL, 'workspace send rate is bounded');

SELECT * FROM finish();
ROLLBACK;
