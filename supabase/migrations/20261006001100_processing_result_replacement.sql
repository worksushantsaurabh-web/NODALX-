CREATE OR REPLACE FUNCTION public.finish_processing_job(owned_workspace text, record_job text, token uuid, output jsonb DEFAULT NULL)
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
      CASE WHEN field.key = 'fit_score' THEN CASE WHEN jsonb_typeof(field.value) = 'number' THEN (field.value #>> '{}')::numeric < 0 OR (field.value #>> '{}')::numeric > 100 ELSE true END
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
    payload = CASE WHEN completed THEN (payload - ARRAY['intent','urgency','fit_score','category','summary','suggested_action']) || output ELSE payload END, updated_at = now()
  WHERE workspace_id = owned_workspace AND id = job.inquiry_id;
  INSERT INTO public.job_events(workspace_id, id, job_id, event_type) VALUES
    (owned_workspace, gen_random_uuid()::text, record_job, CASE WHEN completed THEN 'completed' ELSE 'failed' END);
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.finish_processing_job(text, text, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finish_processing_job(text, text, uuid, jsonb) TO service_role;
