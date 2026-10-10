BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;
SELECT plan(22);
INSERT INTO auth.users(id, email_confirmed_at) VALUES
  ('00000000-0000-4000-8000-000000000011', now()),
  ('00000000-0000-4000-8000-000000000012', now());
INSERT INTO public.workspaces(id) VALUES ('desk-a'), ('desk-b');
INSERT INTO public.identity_bindings(auth_user_id, workspace_id) VALUES
  ('00000000-0000-4000-8000-000000000011', 'desk-a'),
  ('00000000-0000-4000-8000-000000000012', 'desk-b');
INSERT INTO public.inquiries(workspace_id, id, original_message) VALUES
  ('desk-a', 'a', 'Immutable original'), ('desk-b', 'b', 'Foreign original');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000011', true);
SELECT lives_ok('SELECT public.update_own_inquiry(''a'', ''{"status":"Contacted","note":"Local note","followUpAt":1000}'')', 'owned inquiry edit accepted');
SELECT is((SELECT original_message FROM public.inquiries), 'Immutable original', 'original text is never overwritten');
SELECT is((SELECT status FROM public.inquiries), 'Contacted', 'status is persisted');
SELECT is((SELECT count(*) FROM public.inquiry_events), 1::bigint, 'activity is atomic with status change');
SELECT throws_ok('SELECT public.update_own_inquiry(''b'', ''{"status":"Won"}'')', 'P0002', NULL, 'foreign inquiry mutation denied');
SELECT throws_ok('SELECT public.update_own_inquiry(''a'', ''{"workspace_id":"desk-b"}'')', '22023', NULL, 'client ownership field denied');
SELECT throws_ok('SELECT public.update_own_inquiry(''a'', ''{"original_message":"replacement"}'')', '22023', NULL, 'original mutation denied');
SELECT lives_ok('SELECT public.update_own_criteria(''Local qualification criteria'')', 'owned criteria persists');
SELECT is((SELECT criteria FROM public.workspace_settings), 'Local qualification criteria', 'criteria uses bound workspace');
SELECT is((public.own_workspace_overview(30)->>'total')::integer, 1, 'overview counts only owned records');
SELECT throws_ok('SELECT public.own_workspace_overview(999)', '22023', NULL, 'unbounded reporting period denied');

-- Human review decisions: the operator decision is stored under a server-owned
-- payload key, must carry a known decision value, and can never rewrite the
-- original message or touch another workspace's record. Runs before the
-- durable rate-limit check below because every accepted edit spends the same
-- desk write budget.
SELECT lives_ok('SELECT public.update_own_inquiry(''a'', ''{"review_decision":{"decision":"accepted","notes":"Matches call"}}'')', 'accepted review decision recorded');
SELECT is((SELECT payload->'review_decision'->>'decision' FROM public.inquiries WHERE id = 'a'), 'accepted', 'review decision persists on owned inquiry');
SELECT is((SELECT original_message FROM public.inquiries WHERE id = 'a'), 'Immutable original', 'review decision never overwrites original text');
SELECT lives_ok('SELECT public.update_own_inquiry(''a'', ''{"reviewDecision":{"decision":"edited","edited_draft":"Ask for the panel size"}}'')', 'camelCase review decision recorded');
SELECT is((SELECT payload->'review_decision'->>'decision' FROM public.inquiries WHERE id = 'a'), 'edited', 'camelCase review decision normalizes to review_decision');
SELECT is((SELECT payload->'review_decision'->>'edited_draft' FROM public.inquiries WHERE id = 'a'), 'Ask for the panel size', 'edited draft persists for training curation');
SELECT throws_ok('SELECT public.update_own_inquiry(''a'', ''{"review_decision":{"decision":"auto_approve"}}'')', '22023', NULL, 'unknown review decision value denied');
SELECT throws_ok(format('SELECT public.update_own_inquiry(''a'', %L)', jsonb_build_object('review_decision', jsonb_build_object('decision','accepted','notes',repeat('x',1200)))::text), '22023', NULL, 'overlong review notes denied');
SELECT throws_ok('SELECT public.update_own_inquiry(''b'', ''{"review_decision":{"decision":"accepted"}}'')', 'P0002', NULL, 'review decision cannot reach a foreign inquiry');
SELECT is((SELECT count(*) FROM public.inquiry_events), 3::bigint, 'review decisions are recorded as desk activity');

-- Four accepted writes above (status edit, criteria, two review decisions)
-- plus these 56 reach the 60-write desk budget; the next call must be refused.
SELECT public.update_own_inquiry('a', '{"note":"Repeated local test"}') FROM generate_series(1, 56);
SELECT throws_ok('SELECT public.update_own_inquiry(''a'', ''{"note":"Rate limited"}'')', 'P0001', NULL, 'durable desk mutation rate limit enforced');
SELECT * FROM finish();
ROLLBACK;
