CREATE TABLE private.intake_router_gate (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  window_start timestamptz NOT NULL DEFAULT now(),
  request_count integer NOT NULL DEFAULT 0
);
INSERT INTO private.intake_router_gate(singleton) VALUES (true);
ALTER TABLE private.intake_router_gate ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.intake_router_gate FROM PUBLIC, anon, authenticated;

CREATE FUNCTION private.limit_intake_router()
RETURNS void LANGUAGE plpgsql SET search_path = ''
AS $$
DECLARE gate private.intake_router_gate;
BEGIN
  SELECT * INTO gate FROM private.intake_router_gate WHERE singleton FOR UPDATE;
  IF gate.window_start <= now() - interval '1 minute' THEN
    UPDATE private.intake_router_gate SET window_start = now(), request_count = 1 WHERE singleton;
  ELSE
    IF gate.request_count >= 120 THEN RAISE EXCEPTION 'Router rate exceeded' USING ERRCODE = 'P0429'; END IF;
    UPDATE private.intake_router_gate SET request_count = request_count + 1 WHERE singleton;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION private.limit_intake_router() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.claim_intake_delivery()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE delivery private.intake_deliveries;
BEGIN
  PERFORM private.limit_intake_router();
  WITH exhausted AS (
    SELECT id FROM private.intake_deliveries WHERE state = 'processing' AND lease_until <= now() AND attempts >= 8
    ORDER BY created_at LIMIT 100 FOR UPDATE SKIP LOCKED
  ) UPDATE private.intake_deliveries SET state = 'failed', lease_token = NULL, lease_until = NULL, updated_at = now()
    WHERE id IN (SELECT id FROM exhausted);
  SELECT pending.* INTO delivery FROM private.intake_deliveries pending
  JOIN private.intake_sources source ON source.id = pending.source_binding_id
  WHERE source.enabled AND (pending.state = 'queued' OR (pending.state = 'processing' AND pending.lease_until <= now()))
  ORDER BY pending.created_at, pending.id LIMIT 1 FOR UPDATE OF pending SKIP LOCKED;
  IF NOT FOUND THEN RETURN NULL; END IF;
  UPDATE private.intake_deliveries SET state = 'processing', attempts = attempts + 1,
    lease_token = gen_random_uuid(), lease_until = now() + interval '120 seconds', updated_at = now()
  WHERE id = delivery.id RETURNING * INTO delivery;
  RETURN jsonb_build_object('status','claimed','deliveryId',delivery.id,'leaseToken',delivery.lease_token,
    'sourceInquiryId',delivery.source_inquiry_id);
END;
$$;
REVOKE ALL ON FUNCTION public.claim_intake_delivery() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_intake_delivery() TO service_role;
CREATE OR REPLACE FUNCTION public.complete_intake_delivery(record_delivery uuid, token uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE delivery private.intake_deliveries; source private.intake_sources; result jsonb;
BEGIN
  PERFORM private.limit_intake_router();
  SELECT * INTO delivery FROM private.intake_deliveries WHERE id = record_delivery;
  IF NOT FOUND THEN RAISE EXCEPTION 'Delivery lease unavailable' USING ERRCODE = 'P0409'; END IF;
  SELECT * INTO source FROM private.intake_sources WHERE id = delivery.source_binding_id AND enabled FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Intake source denied' USING ERRCODE = '42501'; END IF;
  SELECT * INTO delivery FROM private.intake_deliveries WHERE id = record_delivery FOR UPDATE;
  IF delivery.lease_token IS DISTINCT FROM token OR token IS NULL THEN
    RAISE EXCEPTION 'Delivery lease unavailable' USING ERRCODE = 'P0409';
  END IF;
  IF delivery.state = 'stored' THEN RETURN delivery.receipt || jsonb_build_object('duplicate',true); END IF;
  IF delivery.state <> 'processing' OR delivery.lease_until <= now() THEN
    RAISE EXCEPTION 'Delivery lease unavailable' USING ERRCODE = 'P0409';
  END IF;
  result := public.ingest_source_inquiry(source.secret_hash,delivery.source_inquiry_id,delivery.payload);
  UPDATE private.intake_deliveries SET state = 'stored', receipt = result, payload = '{}'::jsonb,
    lease_until = NULL, updated_at = now() WHERE id = delivery.id;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.complete_intake_delivery(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_intake_delivery(uuid,uuid) TO service_role;
