ALTER TABLE public.jobs ADD COLUMN inquiry_id text;
ALTER TABLE public.jobs ADD COLUMN reservation_id text;
ALTER TABLE public.jobs ADD COLUMN lease_token uuid;
ALTER TABLE public.jobs ADD COLUMN attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0);
ALTER TABLE public.jobs ADD CONSTRAINT jobs_inquiry_fk FOREIGN KEY (workspace_id, inquiry_id) REFERENCES public.inquiries(workspace_id, id);
ALTER TABLE public.jobs ADD CONSTRAINT jobs_reservation_fk FOREIGN KEY (workspace_id, reservation_id) REFERENCES public.usage_reservations(workspace_id, id);
CREATE UNIQUE INDEX jobs_active_inquiry_idx ON public.jobs(workspace_id, inquiry_id)
WHERE inquiry_id IS NOT NULL AND state IN ('queued', 'processing');
CREATE INDEX jobs_claim_idx ON public.jobs(created_at) WHERE state IN ('queued', 'processing');

CREATE TABLE private.processing_configuration (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  enabled boolean NOT NULL DEFAULT false
);
INSERT INTO private.processing_configuration VALUES (true, false);
ALTER TABLE private.processing_configuration ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.processing_configuration FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO service_role;
GRANT SELECT, UPDATE ON private.processing_configuration TO service_role;

CREATE FUNCTION public.processing_available()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT enabled FROM private.processing_configuration WHERE singleton $$;
REVOKE ALL ON FUNCTION public.processing_available() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.processing_available() TO authenticated;

CREATE FUNCTION public.enqueue_own_analysis(record_id text, request_key text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  owned_workspace text := private.current_workspace_id();
  subscription public.subscriptions;
  original public.inquiries;
  snapshot jsonb;
  fingerprint text;
  dedupe text;
  existing public.jobs;
  counters public.usage_periods;
  usage_period text;
  credit_cap integer;
  job_cap integer;
  job_id text := gen_random_uuid()::text;
BEGIN
  IF owned_workspace IS NULL THEN RAISE EXCEPTION 'Workspace unavailable' USING ERRCODE = '42501'; END IF;
  IF request_key IS NOT NULL AND request_key !~ '^[A-Za-z0-9_-]{8,128}$' THEN
    RAISE EXCEPTION 'Invalid request key' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO subscription FROM public.subscriptions WHERE workspace_id = owned_workspace FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Subscription unavailable' USING ERRCODE = 'P0503'; END IF;
  SELECT * INTO original FROM public.inquiries WHERE workspace_id = owned_workspace AND id = record_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Inquiry not found' USING ERRCODE = 'P0002'; END IF;
  snapshot := jsonb_build_object('id', original.id, 'name', original.name, 'email', original.email,
    'message', original.original_message, 'company', original.payload->>'company',
    'criteria', coalesce((SELECT criteria FROM public.workspace_settings WHERE workspace_id = owned_workspace), ''));
  fingerprint := md5(snapshot::text);
  dedupe := coalesce(request_key, 'inquiry:' || record_id || ':' || fingerprint);
  SELECT * INTO existing FROM public.jobs WHERE workspace_id = owned_workspace AND idempotency_key = dedupe;
  IF FOUND THEN
    IF existing.payload_hash <> fingerprint THEN RAISE EXCEPTION 'Request key conflicts with original input' USING ERRCODE = 'P0409'; END IF;
    IF existing.state = 'failed' THEN RAISE EXCEPTION 'Previous job failed; retry with a new request key' USING ERRCODE = 'P0409'; END IF;
    RETURN jsonb_build_object('id', existing.id, 'status', existing.state, 'duplicate', true);
  END IF;
  SELECT * INTO existing FROM public.jobs WHERE workspace_id = owned_workspace AND inquiry_id = record_id AND state IN ('queued', 'processing');
  IF FOUND THEN RETURN jsonb_build_object('id', existing.id, 'status', existing.state, 'duplicate', true); END IF;
  IF NOT public.processing_available() THEN RAISE EXCEPTION 'Processing worker is not enabled' USING ERRCODE = 'P0503'; END IF;
  IF subscription.status NOT IN ('trialing', 'active', 'legacy') OR subscription.period_start > now() OR subscription.period_end <= now() THEN
    RAISE EXCEPTION 'An active plan is required' USING ERRCODE = '42501';
  END IF;
  credit_cap := CASE subscription.plan WHEN 'trial' THEN 50 WHEN 'starter' THEN 500 WHEN 'growth' THEN 2000 END;
  job_cap := CASE subscription.plan WHEN 'growth' THEN 2 ELSE 1 END;
  usage_period := CASE WHEN subscription.plan = 'trial' THEN 'trial' ELSE (floor(extract(epoch FROM subscription.period_start) * 1000))::text END;
  INSERT INTO public.usage_periods(workspace_id, period) VALUES (owned_workspace, usage_period) ON CONFLICT DO NOTHING;
  SELECT * INTO counters FROM public.usage_periods WHERE workspace_id = owned_workspace AND period = usage_period FOR UPDATE;
  IF counters.used + counters.reserved >= credit_cap OR counters.active_jobs >= job_cap THEN
    RAISE EXCEPTION 'Processing allowance or job limit reached' USING ERRCODE = 'P0429';
  END IF;
  PERFORM private.limit_desk_write();
  INSERT INTO public.usage_reservations(workspace_id, id, period, idempotency_key, payload_hash, credits, state)
  VALUES (owned_workspace, job_id, usage_period, dedupe, fingerprint, 1, 'reserved');
  INSERT INTO public.jobs(workspace_id, id, inquiry_id, reservation_id, mode, idempotency_key, payload_hash, progress)
  VALUES (owned_workspace, job_id, record_id, job_id, 'process', dedupe, fingerprint, '{"total":1,"processed":0,"succeeded":0,"failed":0,"skipped":0}');
  INSERT INTO public.job_rows(workspace_id, id, job_id, original_row, source_reference)
  VALUES (owned_workspace, job_id, job_id, snapshot, jsonb_build_object('inquiryId', record_id));
  UPDATE public.usage_periods SET reserved = reserved + 1, active_jobs = active_jobs + 1, updated_at = now()
  WHERE workspace_id = owned_workspace AND period = usage_period;
  UPDATE public.inquiries SET processing_status = 'queued', updated_at = now() WHERE workspace_id = owned_workspace AND id = record_id;
  INSERT INTO public.job_events(workspace_id, id, job_id, event_type) VALUES (owned_workspace, gen_random_uuid()::text, job_id, 'queued');
  RETURN jsonb_build_object('id', job_id, 'status', 'queued', 'duplicate', false);
END;
$$;
REVOKE ALL ON FUNCTION public.enqueue_own_analysis(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enqueue_own_analysis(text, text) TO authenticated;

CREATE FUNCTION public.claim_processing_job()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  candidate public.jobs;
  token uuid := gen_random_uuid();
BEGIN
  IF NOT public.processing_available() THEN RETURN NULL; END IF;
  SELECT * INTO candidate FROM public.jobs
  WHERE mode = 'process' AND inquiry_id IS NOT NULL AND
    (state = 'queued' OR (state = 'processing' AND lease_until <= now()))
  ORDER BY created_at, id LIMIT 1 FOR UPDATE SKIP LOCKED;
  IF NOT FOUND THEN RETURN NULL; END IF;
  UPDATE public.jobs SET state = 'processing', lease_token = token, lease_until = now() + interval '120 seconds',
    attempts = attempts + 1, updated_at = now() WHERE workspace_id = candidate.workspace_id AND id = candidate.id;
  UPDATE public.inquiries SET processing_status = 'processing' WHERE workspace_id = candidate.workspace_id AND id = candidate.inquiry_id;
  RETURN jsonb_build_object('workspaceId', candidate.workspace_id, 'id', candidate.id, 'leaseToken', token,
    'attempt', candidate.attempts + 1, 'input', (SELECT original_row FROM public.job_rows WHERE workspace_id = candidate.workspace_id AND job_id = candidate.id LIMIT 1));
END;
$$;
REVOKE ALL ON FUNCTION public.claim_processing_job() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_processing_job() TO service_role;

CREATE FUNCTION public.finish_processing_job(owned_workspace text, record_job text, token uuid, output jsonb DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  job public.jobs;
  reservation public.usage_reservations;
  completed boolean := output IS NOT NULL;
BEGIN
  SELECT * INTO job FROM public.jobs WHERE workspace_id = owned_workspace AND id = record_job FOR UPDATE;
  IF NOT FOUND OR job.state <> 'processing' OR job.lease_token IS DISTINCT FROM token OR job.lease_until <= now() THEN RETURN false; END IF;
  IF completed AND (jsonb_typeof(output) IS DISTINCT FROM 'object' OR output = '{}'::jsonb
    OR EXISTS (SELECT 1 FROM jsonb_object_keys(output) field WHERE field NOT IN ('intent','urgency','fit_score','category','summary','suggested_action'))
    OR EXISTS (SELECT 1 FROM jsonb_each(output) field WHERE
      CASE WHEN field.key = 'fit_score' THEN jsonb_typeof(field.value) IS DISTINCT FROM 'number'
      ELSE jsonb_typeof(field.value) IS DISTINCT FROM 'string' OR length(field.value #>> '{}') > 4000 END)) THEN
    RAISE EXCEPTION 'Invalid processing output' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO reservation FROM public.usage_reservations WHERE workspace_id = owned_workspace AND id = job.reservation_id FOR UPDATE;
  IF NOT FOUND OR reservation.state <> 'reserved' THEN RAISE EXCEPTION 'Reservation unavailable' USING ERRCODE = 'P0503'; END IF;
  UPDATE public.usage_periods SET reserved = reserved - reservation.credits,
    used = used + CASE WHEN completed THEN reservation.credits ELSE 0 END,
    active_jobs = active_jobs - 1, updated_at = now()
  WHERE workspace_id = owned_workspace AND period = reservation.period;
  UPDATE public.usage_reservations SET state = CASE WHEN completed THEN 'committed' ELSE 'released' END, updated_at = now()
  WHERE workspace_id = owned_workspace AND id = reservation.id;
  UPDATE public.jobs SET state = CASE WHEN completed THEN 'completed' ELSE 'failed' END,
    lease_token = NULL, lease_until = NULL, updated_at = now(),
    progress = jsonb_build_object('total',1,'processed',1,'succeeded',completed::integer,'failed',(NOT completed)::integer,'skipped',0)
  WHERE workspace_id = owned_workspace AND id = record_job;
  UPDATE public.job_rows SET state = CASE WHEN completed THEN 'succeeded' ELSE 'failed' END, result = output, updated_at = now()
  WHERE workspace_id = owned_workspace AND job_id = record_job;
  UPDATE public.inquiries SET processing_status = CASE WHEN completed THEN 'completed' ELSE 'failed' END,
    payload = CASE WHEN completed THEN payload || output ELSE payload END, updated_at = now()
  WHERE workspace_id = owned_workspace AND id = job.inquiry_id;
  INSERT INTO public.job_events(workspace_id, id, job_id, event_type) VALUES
    (owned_workspace, gen_random_uuid()::text, record_job, CASE WHEN completed THEN 'completed' ELSE 'failed' END);
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.finish_processing_job(text, text, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finish_processing_job(text, text, uuid, jsonb) TO service_role;
