CREATE TABLE private.intake_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL REFERENCES public.workspaces(id),
  source_binding_id uuid NOT NULL REFERENCES private.intake_sources(id),
  source_inquiry_id text NOT NULL,
  payload jsonb NOT NULL,
  content_hash text NOT NULL,
  state text NOT NULL DEFAULT 'queued' CHECK (state IN ('queued','processing','stored','failed')),
  attempts integer NOT NULL DEFAULT 0,
  lease_token uuid,
  lease_until timestamptz,
  receipt jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, source_inquiry_id)
);
ALTER TABLE private.intake_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.intake_deliveries FROM PUBLIC, anon, authenticated;
GRANT SELECT ON private.intake_deliveries TO service_role;
CREATE INDEX intake_deliveries_claim_idx ON private.intake_deliveries(created_at) WHERE state IN ('queued','processing');

CREATE TABLE private.intake_delivery_gates (
  source_binding_id uuid PRIMARY KEY REFERENCES private.intake_sources(id),
  window_start timestamptz NOT NULL DEFAULT now(),
  received_count integer NOT NULL DEFAULT 0
);
ALTER TABLE private.intake_delivery_gates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.intake_delivery_gates FROM PUBLIC, anon, authenticated;

CREATE FUNCTION private.canonical_intake_payload(inquiry jsonb)
RETURNS jsonb LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  IF inquiry IS NULL OR jsonb_typeof(inquiry) IS DISTINCT FROM 'object' OR octet_length(inquiry::text) > 20000 THEN
    RAISE EXCEPTION 'Invalid inquiry' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_each(inquiry) field WHERE
    field.key NOT IN ('name','email','company','message','phone','industry','service')
    OR jsonb_typeof(field.value) IS DISTINCT FROM 'string'
    OR length(field.value #>> '{}') > CASE WHEN field.key = 'message' THEN 12000 ELSE 500 END)
    OR coalesce(length(btrim(inquiry->>'name')), 0) = 0
    OR coalesce(length(btrim(inquiry->>'company')), 0) = 0
    OR coalesce(length(btrim(inquiry->>'message')), 0) = 0
    OR coalesce(inquiry->>'email','') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RAISE EXCEPTION 'Invalid inquiry' USING ERRCODE = '22023';
  END IF;
  RETURN jsonb_build_object('name',inquiry->>'name','email',inquiry->>'email','company',inquiry->>'company',
    'message',inquiry->>'message','phone',coalesce(inquiry->>'phone',''),
    'industry',coalesce(inquiry->>'industry',''),'service',coalesce(inquiry->>'service',''));
END;
$$;
REVOKE ALL ON FUNCTION private.canonical_intake_payload(jsonb) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.stage_source_inquiry(source_key_hash text, source_id text, inquiry jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  source private.intake_sources;
  delivery private.intake_deliveries;
  gate private.intake_delivery_gates;
  canonical jsonb;
  digest text;
BEGIN
  SELECT * INTO source FROM private.intake_sources WHERE secret_hash = source_key_hash AND enabled FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Intake source denied' USING ERRCODE = '42501'; END IF;
  IF source_id IS NULL OR source_id !~ '^[A-Za-z0-9_-]{8,128}$' THEN RAISE EXCEPTION 'Invalid source ID' USING ERRCODE = '22023'; END IF;
  canonical := private.canonical_intake_payload(inquiry);
  digest := encode(sha256(convert_to(canonical::text,'UTF8')),'hex');
  INSERT INTO private.intake_delivery_gates(source_binding_id) VALUES (source.id) ON CONFLICT DO NOTHING;
  SELECT * INTO gate FROM private.intake_delivery_gates WHERE source_binding_id = source.id FOR UPDATE;
  IF gate.window_start <= now() - interval '1 minute' THEN
    UPDATE private.intake_delivery_gates SET window_start = now(), received_count = 1 WHERE source_binding_id = source.id;
  ELSE
    IF gate.received_count >= 60 THEN RAISE EXCEPTION 'Intake rate exceeded' USING ERRCODE = 'P0429'; END IF;
    UPDATE private.intake_delivery_gates SET received_count = received_count + 1 WHERE source_binding_id = source.id;
  END IF;
  SELECT * INTO delivery FROM private.intake_deliveries WHERE workspace_id = source.workspace_id AND source_inquiry_id = source_id FOR UPDATE;
  IF FOUND THEN
    IF delivery.content_hash <> digest OR delivery.source_binding_id <> source.id THEN
      RAISE EXCEPTION 'Source inquiry conflicts' USING ERRCODE = 'P0409';
    END IF;
    RETURN jsonb_build_object('id',delivery.id,'status',delivery.state,'sourceInquiryId',source_id,'duplicate',true);
  END IF;
  IF (SELECT count(*) FROM private.intake_deliveries WHERE workspace_id = source.workspace_id AND state IN ('queued','processing')) >= 1000 THEN
    RAISE EXCEPTION 'Intake backlog full' USING ERRCODE = 'P0503';
  END IF;
  INSERT INTO private.intake_deliveries(workspace_id,source_binding_id,source_inquiry_id,payload,content_hash)
  VALUES (source.workspace_id,source.id,source_id,canonical,digest) RETURNING * INTO delivery;
  RETURN jsonb_build_object('id',delivery.id,'status','queued','sourceInquiryId',source_id,'duplicate',false);
END;
$$;
REVOKE ALL ON FUNCTION public.stage_source_inquiry(text,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.stage_source_inquiry(text,text,jsonb) TO service_role;

CREATE FUNCTION public.claim_intake_delivery()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE delivery private.intake_deliveries;
BEGIN
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

CREATE FUNCTION public.complete_intake_delivery(record_delivery uuid, token uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE delivery private.intake_deliveries; source private.intake_sources; result jsonb;
BEGIN
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

CREATE FUNCTION public.retry_intake_delivery(record_delivery uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE delivery private.intake_deliveries;
BEGIN
  SELECT * INTO delivery FROM private.intake_deliveries WHERE id = record_delivery;
  IF NOT FOUND THEN RETURN false; END IF;
  PERFORM id FROM private.intake_sources WHERE id = delivery.source_binding_id AND enabled FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  UPDATE private.intake_deliveries SET state = 'queued', attempts = 0, lease_token = NULL,
    lease_until = NULL, updated_at = now() WHERE id = record_delivery AND state = 'failed';
  RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.retry_intake_delivery(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.retry_intake_delivery(uuid) TO service_role;
