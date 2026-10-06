BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;
SELECT plan(33);

INSERT INTO auth.users(id, email, email_confirmed_at, raw_user_meta_data) VALUES
  ('00000000-0000-4000-8000-000000000001', 'a@example.invalid', now(), '{}'),
  ('00000000-0000-4000-8000-000000000002', 'b@example.invalid', now(), '{}'),
  ('00000000-0000-4000-8000-000000000003', 'c@example.invalid', now(), '{"workspace_id":"legacy-a","tier":"full"}'),
  ('00000000-0000-4000-8000-000000000004', 'unconfirmed@example.invalid', NULL, '{}');
INSERT INTO public.workspaces(id) VALUES ('legacy-a'), ('legacy-b');
INSERT INTO public.identity_bindings(auth_user_id, workspace_id, legacy_firebase_uid) VALUES
  ('00000000-0000-4000-8000-000000000001', 'legacy-a', 'legacy-a'),
  ('00000000-0000-4000-8000-000000000002', 'legacy-b', 'legacy-b');
INSERT INTO public.profiles(workspace_id) VALUES ('legacy-a'), ('legacy-b');
INSERT INTO public.subscriptions(workspace_id) VALUES ('legacy-a'), ('legacy-b');
INSERT INTO public.inquiries(workspace_id, id, original_message) VALUES
  ('legacy-a', 'same-id', 'Original A'), ('legacy-b', 'same-id', 'Original B');

SELECT ok((SELECT bool_and(relrowsecurity) FROM pg_class JOIN pg_namespace ON pg_namespace.oid = relnamespace
  WHERE nspname = 'public' AND relkind = 'r'), 'every public table has RLS');
SELECT ok((SELECT bool_and(NOT has_table_privilege('anon', pg_class.oid, 'SELECT')) FROM pg_class JOIN pg_namespace ON pg_namespace.oid = relnamespace
  WHERE nspname = 'public' AND relkind = 'r'), 'no anonymous table read grants');
SELECT ok((SELECT bool_and(NOT has_table_privilege('authenticated', pg_class.oid, 'INSERT,UPDATE,DELETE,TRUNCATE')) FROM pg_class JOIN pg_namespace ON pg_namespace.oid = relnamespace
  WHERE nspname = 'public' AND relkind = 'r'), 'no direct browser table mutation grants');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
SELECT is((SELECT count(*) FROM public.inquiries), 1::bigint, 'only one tenant inquiry visible');
SELECT is((SELECT original_message FROM public.inquiries), 'Original A', 'original inquiry and stable owner preserved');
SELECT is((SELECT count(*) FROM public.identity_bindings), 1::bigint, 'only own identity binding visible');
SELECT throws_ok('UPDATE public.identity_bindings SET workspace_id = ''legacy-b''', '42501', NULL, 'binding mutation denied');
SELECT throws_ok('UPDATE public.subscriptions SET entitlement = ''full''', '42501', NULL, 'entitlement mutation denied');
SELECT throws_ok('UPDATE public.inquiries SET workspace_id = ''legacy-b''', '42501', NULL, 'ownership mutation denied');
SELECT throws_ok('SELECT * FROM public.api_keys', '42501', NULL, 'API key hashes hidden');
SELECT throws_ok('SELECT * FROM public.connector_credentials', '42501', NULL, 'connector credentials hidden');
SELECT throws_ok('SELECT * FROM public.outbox', '42501', NULL, 'worker payloads hidden');
SELECT throws_ok('SELECT private.provision_auth_workspace(''00000000-0000-4000-8000-000000000002'')', '42501', NULL, 'privileged bootstrap denied');
SELECT lives_ok('SELECT public.update_own_profile(''{"displayName":"Alice","role":"CEO","notifications":{"weeklySummary":false}}'')', 'own profile edit succeeds');
SELECT is((SELECT display_name FROM public.profiles), 'Alice', 'allowed display field persisted');
SELECT throws_ok('SELECT public.update_own_profile(''{"tier":"full"}'')', '22023', NULL, 'profile rejects entitlement escalation');
SELECT throws_ok('SELECT public.update_own_profile(''{"workspaceId":"legacy-b"}'')', '22023', NULL, 'profile rejects client ownership');
SELECT throws_ok('SELECT public.update_own_profile(''{"notifications":{"securityAlerts":"yes"}}'')', '22023', NULL, 'invalid notification type rejected');
SELECT throws_ok('SELECT public.update_own_profile(''null'')', '22023', NULL, 'null profile rejected');
SELECT is(public.bootstrap_workspace(), 'legacy-a', 'bootstrap preserves legacy binding');
SELECT lives_ok('SELECT public.submit_own_feedback(''{"type":"widget","category":"general","message":"Local test"}'')', 'feedback persists through owned RPC');
SELECT throws_ok('SELECT public.submit_own_feedback(''{"type":"widget","category":"general","message":"X","workspaceId":"legacy-b"}'')', '22023', NULL, 'feedback rejects client ownership');
SELECT throws_ok('SELECT public.submit_own_feedback(''{"type":"survey","surveyContext":"form_submission","rating":6,"message":""}'')', '22023', NULL, 'survey validates rating');
SELECT throws_ok('SELECT public.submit_own_feedback(''{"type":"widget","category":"general","message":" "}'')', '22023', NULL, 'empty feedback is not acknowledged');
SELECT public.submit_own_feedback('{"type":"widget","category":"general","message":"Rate test"}') FROM generate_series(1, 9);
SELECT throws_ok('SELECT public.submit_own_feedback(''{"type":"widget","category":"general","message":"Rate test"}'')', 'P0001', NULL, 'durable feedback limit rejects eleventh request');

SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
SELECT is((SELECT display_name FROM public.profiles), 'User', 'other tenant profile unchanged');
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000003', true);
SELECT set_config('request.jwt.claim.workspace_id', 'legacy-a', true);
SELECT is((SELECT count(*) FROM public.inquiries), 0::bigint, 'forged workspace claim and missing binding fail closed');
SELECT is(public.bootstrap_workspace(), 'supabase:00000000-0000-4000-8000-000000000003', 'new workspace ignores client metadata ownership');
SELECT is(public.bootstrap_workspace(), 'supabase:00000000-0000-4000-8000-000000000003', 'bootstrap is idempotent');
SELECT is((SELECT entitlement FROM public.subscriptions), 'free', 'metadata cannot elevate plan');
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000004', true);
SELECT throws_ok('SELECT public.bootstrap_workspace()', '42501', NULL, 'unconfirmed account denied');

RESET ROLE;
SELECT is((SELECT count(*) FROM public.feedback WHERE workspace_id = 'legacy-a'), 10::bigint, 'rejected feedback does not persist a row');
SELECT is((SELECT public FROM storage.buckets WHERE id = 'workspace-artifacts'), false, 'artifact bucket is private');
SELECT * FROM finish();
ROLLBACK;
