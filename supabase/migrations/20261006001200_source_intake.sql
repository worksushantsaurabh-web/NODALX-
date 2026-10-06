CREATE TABLE private.intake_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL REFERENCES public.workspaces(id) ON DELETE RESTRICT,
  secret_hash text NOT NULL UNIQUE CHECK (secret_hash ~ '^[a-f0-9]{64}$'),
  enabled boolean NOT NULL DEFAULT false,
  window_start timestamptz NOT NULL DEFAULT now(),
  received_count integer NOT NULL DEFAULT 0 CHECK (received_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE private.intake_sources ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.intake_sources FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON private.intake_sources TO service_role;

ALTER TABLE public.inquiries
  ADD COLUMN source_inquiry_id text,
  ADD COLUMN content_hash text,
  ADD COLUMN intake_source_id uuid REFERENCES private.intake_sources(id) ON DELETE RESTRICT,
  ADD CONSTRAINT inquiries_source_shape CHECK (
    (source_inquiry_id IS NULL AND content_hash IS NULL AND intake_source_id IS NULL) OR
    (source_inquiry_id IS NOT NULL AND source_inquiry_id ~ '^[A-Za-z0-9_-]{8,128}$'
      AND content_hash IS NOT NULL AND content_hash ~ '^[a-f0-9]{64}$' AND intake_source_id IS NOT NULL)
  ),
  ADD CONSTRAINT inquiries_workspace_source_unique UNIQUE (workspace_id, source_inquiry_id);
ALTER TABLE public.inquiries DROP CONSTRAINT IF EXISTS inquiries_workspace_id_fingerprint_key;
CREATE INDEX inquiries_content_hash_idx ON public.inquiries(workspace_id, content_hash) WHERE content_hash IS NOT NULL;

CREATE FUNCTION private.preserve_inquiry_origin()
RETURNS trigger LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  IF NEW.workspace_id IS DISTINCT FROM OLD.workspace_id OR NEW.id IS DISTINCT FROM OLD.id
    OR NEW.original_message IS DISTINCT FROM OLD.original_message
    OR NEW.source_inquiry_id IS DISTINCT FROM OLD.source_inquiry_id
    OR NEW.content_hash IS DISTINCT FROM OLD.content_hash
    OR NEW.intake_source_id IS DISTINCT FROM OLD.intake_source_id THEN
    RAISE EXCEPTION 'Inquiry origin is immutable' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.preserve_inquiry_origin() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER preserve_inquiry_origin BEFORE UPDATE ON public.inquiries
FOR EACH ROW EXECUTE FUNCTION private.preserve_inquiry_origin();

CREATE FUNCTION public.ingest_source_inquiry(source_key_hash text, source_id text, inquiry jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  source private.intake_sources;
  stored public.inquiries;
  canonical jsonb;
  digest text;
  inserted integer;
BEGIN
  IF source_key_hash IS NULL OR source_key_hash !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'Intake source denied' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO source FROM private.intake_sources WHERE secret_hash = source_key_hash AND enabled FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Intake source denied' USING ERRCODE = '42501'; END IF;
  IF source_id IS NULL OR source_id !~ '^[A-Za-z0-9_-]{8,128}$'
    OR inquiry IS NULL OR jsonb_typeof(inquiry) IS DISTINCT FROM 'object'
    OR octet_length(inquiry::text) > 20000 THEN
    RAISE EXCEPTION 'Invalid inquiry' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_each(inquiry) field WHERE
    field.key NOT IN ('name','email','company','message','phone','industry','service')
    OR jsonb_typeof(field.value) IS DISTINCT FROM 'string'
    OR length(field.value #>> '{}') > CASE WHEN field.key = 'message' THEN 12000 ELSE 500 END)
    OR coalesce(length(btrim(inquiry->>'name')), 0) = 0
    OR coalesce(length(btrim(inquiry->>'company')), 0) = 0
    OR coalesce(length(btrim(inquiry->>'message')), 0) = 0
    OR coalesce(inquiry->>'email', '') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RAISE EXCEPTION 'Invalid inquiry' USING ERRCODE = '22023';
  END IF;
  IF source.window_start <= now() - interval '1 minute' THEN
    UPDATE private.intake_sources SET window_start = now(), received_count = 1 WHERE id = source.id;
  ELSE
    IF source.received_count >= 60 THEN RAISE EXCEPTION 'Intake rate exceeded' USING ERRCODE = 'P0429'; END IF;
    UPDATE private.intake_sources SET received_count = received_count + 1 WHERE id = source.id;
  END IF;
  canonical := jsonb_build_object('name', inquiry->>'name', 'email', inquiry->>'email',
    'company', inquiry->>'company', 'message', inquiry->>'message',
    'phone', coalesce(inquiry->>'phone', ''), 'industry', coalesce(inquiry->>'industry', ''),
    'service', coalesce(inquiry->>'service', ''));
  digest := encode(sha256(convert_to(canonical::text, 'UTF8')), 'hex');
  INSERT INTO public.inquiries(workspace_id, id, original_message, name, email, payload,
    source_inquiry_id, content_hash, intake_source_id, source_reference)
  VALUES (source.workspace_id, gen_random_uuid()::text, inquiry->>'message', inquiry->>'name', inquiry->>'email',
    canonical - ARRAY['name','email','message'], source_id, digest, source.id,
    jsonb_build_object('kind','make','sourceInquiryId',source_id))
  ON CONFLICT (workspace_id, source_inquiry_id) DO NOTHING;
  GET DIAGNOSTICS inserted = ROW_COUNT;
  SELECT * INTO stored FROM public.inquiries
  WHERE workspace_id = source.workspace_id AND source_inquiry_id = source_id FOR UPDATE;
  IF stored.content_hash IS DISTINCT FROM digest OR stored.intake_source_id IS DISTINCT FROM source.id THEN
    RAISE EXCEPTION 'Source inquiry conflicts' USING ERRCODE = 'P0409';
  END IF;
  RETURN jsonb_build_object('id',stored.id,'status','stored','duplicate',inserted = 0);
END;
$$;
REVOKE ALL ON FUNCTION public.ingest_source_inquiry(text,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ingest_source_inquiry(text,text,jsonb) TO service_role;
