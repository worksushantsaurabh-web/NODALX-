CREATE TABLE private.make_claim_gate (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  last_claim timestamptz NOT NULL DEFAULT '-infinity'
);
INSERT INTO private.make_claim_gate(singleton) VALUES (true);
ALTER TABLE private.make_claim_gate ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.make_claim_gate FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.claim_make_processing_job()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE previous timestamptz;
BEGIN
  SELECT last_claim INTO previous FROM private.make_claim_gate WHERE singleton FOR UPDATE;
  IF previous > now() - interval '2 seconds' THEN
    RAISE EXCEPTION 'Claim rate exceeded' USING ERRCODE = 'P0429';
  END IF;
  UPDATE private.make_claim_gate SET last_claim = now() WHERE singleton;
  PERFORM public.processing_worker_heartbeat('00000000-0000-4000-8000-000000000001'::uuid, true);
  RETURN public.claim_processing_job();
END;
$$;
REVOKE ALL ON FUNCTION public.claim_make_processing_job() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_make_processing_job() TO service_role;
