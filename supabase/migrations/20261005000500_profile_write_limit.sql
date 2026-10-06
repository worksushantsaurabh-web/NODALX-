-- Bound authenticated profile mutations without per-process serverless counters.
CREATE TABLE private.profile_write_limits (
  workspace_id text NOT NULL REFERENCES public.workspaces(id),
  window_start timestamptz NOT NULL,
  submissions integer NOT NULL CHECK (submissions > 0),
  PRIMARY KEY (workspace_id, window_start)
);
ALTER TABLE private.profile_write_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.profile_write_limits FROM PUBLIC, anon, authenticated;

ALTER FUNCTION public.update_own_profile(jsonb) SET SCHEMA private;
REVOKE ALL ON FUNCTION private.update_own_profile(jsonb) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.update_own_profile(updates jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  owned_workspace text := private.current_workspace_id();
  count integer;
BEGIN
  IF owned_workspace IS NULL THEN
    RAISE EXCEPTION 'Workspace unavailable' USING ERRCODE = '42501';
  END IF;
  INSERT INTO private.profile_write_limits VALUES (owned_workspace, date_trunc('minute', now()), 1)
  ON CONFLICT (workspace_id, window_start) DO UPDATE
    SET submissions = private.profile_write_limits.submissions + 1
  RETURNING submissions INTO count;
  IF count > 20 THEN
    RAISE EXCEPTION 'Profile rate limit reached' USING ERRCODE = 'P0001';
  END IF;
  PERFORM private.update_own_profile(updates);
END;
$$;
REVOKE ALL ON FUNCTION public.update_own_profile(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_own_profile(jsonb) TO authenticated;
