CREATE OR REPLACE FUNCTION public.enqueue_own_analysis(record_id text, request_key text DEFAULT NULL)
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
  fingerprint := encode(sha256(convert_to(snapshot::text, 'UTF8')), 'hex');
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
  IF counters.used + counters.reserved >= credit_cap OR
    (SELECT count(*) FROM public.jobs WHERE workspace_id = owned_workspace AND state IN ('queued','processing')) >= job_cap THEN
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
