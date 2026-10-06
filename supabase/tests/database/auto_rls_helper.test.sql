BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;
SELECT plan(3);
SELECT is((SELECT count(*) FROM pg_proc JOIN pg_namespace ON pg_namespace.oid=pronamespace
  WHERE nspname='public' AND proname='rls_auto_enable'
  AND (has_function_privilege('anon',pg_proc.oid,'EXECUTE')
    OR has_function_privilege('authenticated',pg_proc.oid,'EXECUTE'))),0::bigint,'optional cloud helper is not browser executable');
SELECT is((SELECT count(*) FROM pg_proc JOIN pg_namespace ON pg_namespace.oid=pronamespace
  WHERE nspname='public' AND prosecdef AND has_function_privilege('anon',pg_proc.oid,'EXECUTE')),0::bigint,'no anonymous public security-definer functions');
SELECT is((SELECT count(*) FROM pg_class JOIN pg_namespace ON pg_namespace.oid=relnamespace
  WHERE nspname IN ('public','private') AND relkind='r' AND NOT relrowsecurity),0::bigint,'tenant tables retain RLS');
SELECT * FROM finish();
ROLLBACK;
