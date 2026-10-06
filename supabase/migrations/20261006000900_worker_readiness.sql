CREATE TABLE private.processing_workers (
  id uuid PRIMARY KEY,
  last_seen timestamptz NOT NULL DEFAULT now(),
  ready boolean NOT NULL DEFAULT false
);
ALTER TABLE private.processing_workers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.processing_workers FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.processing_worker_heartbeat(worker_id uuid, is_ready boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF worker_id IS NULL OR is_ready IS NULL THEN RAISE EXCEPTION 'Invalid worker heartbeat' USING ERRCODE = '22023'; END IF;
  INSERT INTO private.processing_workers(id, ready) VALUES (worker_id, is_ready)
  ON CONFLICT (id) DO UPDATE SET ready = excluded.ready, last_seen = now();
END;
$$;
REVOKE ALL ON FUNCTION public.processing_worker_heartbeat(uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.processing_worker_heartbeat(uuid, boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.processing_available()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT enabled AND EXISTS (
    SELECT 1 FROM private.processing_workers WHERE ready AND last_seen > now() - interval '60 seconds'
  ) FROM private.processing_configuration WHERE singleton
$$;
REVOKE ALL ON FUNCTION public.processing_available() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.processing_available() TO authenticated;

CREATE FUNCTION public.processing_readiness()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT jsonb_build_object('enabled', enabled,
    'workerReady', EXISTS (SELECT 1 FROM private.processing_workers WHERE ready AND last_seen > now() - interval '60 seconds'),
    'available', public.processing_available())
  FROM private.processing_configuration WHERE singleton
$$;
REVOKE ALL ON FUNCTION public.processing_readiness() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.processing_readiness() TO authenticated;
