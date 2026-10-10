-- Compatibility boundary for hosted Supabase Auth with app data on RDS.
-- These rows are a server-owned mirror of verified Supabase identities, not
-- an authentication service. Never accept user fields from an unverified client.
CREATE SCHEMA IF NOT EXISTS auth;
REVOKE ALL ON SCHEMA auth FROM PUBLIC;
GRANT USAGE ON SCHEMA auth TO authenticated, service_role;

CREATE TABLE auth.users (
  id uuid PRIMARY KEY,
  email_confirmed_at timestamptz,
  phone_confirmed_at timestamptz,
  is_anonymous boolean NOT NULL DEFAULT false,
  raw_user_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  synced_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON auth.users FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON auth.users TO service_role;

CREATE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql STABLE
SET search_path = ''
AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
REVOKE ALL ON FUNCTION auth.uid() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated, service_role;
