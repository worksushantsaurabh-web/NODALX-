-- Test-database-only fixtures. nodalx_test must be able to run the shared
-- pgTAP suite even where the RDS application database intentionally differs
-- from hosted Supabase. Never apply this to nodalx_app.
--
-- 1. Storage: migrate-rds.mjs excludes 20261005000300_private_storage.sql
--    (hosted Supabase owns Storage), but tenant_security.test.sql asserts the
--    artifact bucket is private, so the minimal storage shapes are recreated
--    here and the migration itself then runs against them.
-- 2. Auth mirror parity: rds/bootstrap.sql creates a minimal auth.users mirror;
--    the test seeds email the way hosted Supabase Auth's real table has it.
CREATE SCHEMA IF NOT EXISTS storage;
CREATE TABLE IF NOT EXISTS storage.buckets (
  id text PRIMARY KEY,
  name text NOT NULL,
  public boolean NOT NULL DEFAULT false,
  file_size_limit bigint
);
CREATE TABLE IF NOT EXISTS storage.objects (
  name text NOT NULL,
  bucket_id text NOT NULL
);
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS email text;
