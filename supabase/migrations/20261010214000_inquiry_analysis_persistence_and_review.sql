-- Migration: Support versioned analysis packet persistence and human review decisions
-- Extends finish_processing_job to persist analysis_packet
-- Extends update_own_inquiry to accept and record review_decision

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
    OR EXISTS (SELECT 1 FROM jsonb_object_keys(output) field WHERE field NOT IN ('intent','urgency','fit_score','category','summary','suggested_action','analysis_packet'))
    OR EXISTS (SELECT 1 FROM jsonb_each(output) field WHERE
      CASE
        WHEN field.key = 'fit_score' THEN CASE WHEN jsonb_typeof(field.value) = 'number' THEN (field.value #>> '{}')::numeric < 0 OR (field.value #>> '{}')::numeric > 100 ELSE true END
        WHEN field.key = 'analysis_packet' THEN CASE WHEN jsonb_typeof(field.value) = 'object' THEN length(field.value #>> '{}') > 16000 OR field.value->>'schema_version' IS DISTINCT FROM 'nodalx-v3' ELSE true END
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
    payload = CASE WHEN completed THEN (payload - ARRAY['intent','urgency','fit_score','category','summary','suggested_action','analysis_packet']) || output ELSE payload END, updated_at = now()
  WHERE workspace_id = owned_workspace AND id = job.inquiry_id;
  INSERT INTO public.job_events(workspace_id, id, job_id, event_type) VALUES
    (owned_workspace, gen_random_uuid()::text, record_job, CASE WHEN completed THEN 'completed' ELSE 'failed' END);
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.finish_processing_job(text, text, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finish_processing_job(text, text, uuid, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.update_own_inquiry(record_id text, updates jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  owned_workspace text := private.current_workspace_id();
  current_record public.inquiries;
  rev_decision text;
BEGIN
  IF updates IS NULL OR jsonb_typeof(updates) IS DISTINCT FROM 'object'
    OR updates = '{}'::jsonb OR EXISTS (
      SELECT 1 FROM jsonb_object_keys(updates) field WHERE field NOT IN ('status', 'note', 'followUpAt', 'review_decision', 'reviewDecision')
    ) THEN
    RAISE EXCEPTION 'Invalid inquiry fields' USING ERRCODE = '22023';
  END IF;
  IF updates ? 'status' AND coalesce(updates->>'status', '') NOT IN ('Pending', 'Qualified', 'Contacted', 'Spam', 'Won', 'Lost') THEN
    RAISE EXCEPTION 'Invalid inquiry status' USING ERRCODE = '22023';
  END IF;
  IF updates ? 'note' AND (jsonb_typeof(updates->'note') IS DISTINCT FROM 'string' OR length(updates->>'note') > 4000) THEN
    RAISE EXCEPTION 'Invalid inquiry note' USING ERRCODE = '22023';
  END IF;
  IF updates ? 'followUpAt' AND updates->'followUpAt' <> 'null'::jsonb THEN
    IF jsonb_typeof(updates->'followUpAt') IS DISTINCT FROM 'number' THEN
      RAISE EXCEPTION 'Invalid follow-up time' USING ERRCODE = '22023';
    END IF;
    IF (updates->>'followUpAt')::numeric < 0 OR (updates->>'followUpAt')::numeric > 4102444800000 THEN
      RAISE EXCEPTION 'Invalid follow-up time' USING ERRCODE = '22023';
    END IF;
  END IF;
  IF (updates ? 'review_decision' OR updates ? 'reviewDecision') THEN
    rev_decision := coalesce(updates->'review_decision'->>'decision', updates->'reviewDecision'->>'decision', '');
    IF rev_decision NOT IN ('accepted', 'edited', 'dismissed') THEN
      RAISE EXCEPTION 'Invalid review decision' USING ERRCODE = '22023';
    END IF;
    IF length(coalesce(updates->'review_decision'->>'notes', updates->'reviewDecision'->>'notes', '')) > 1000 THEN
      RAISE EXCEPTION 'Invalid review decision notes' USING ERRCODE = '22023';
    END IF;
  END IF;
  SELECT * INTO current_record FROM public.inquiries
  WHERE workspace_id = owned_workspace AND id = record_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inquiry not found' USING ERRCODE = 'P0002';
  END IF;
  PERFORM private.limit_desk_write();
  UPDATE public.inquiries SET
    status = coalesce(updates->>'status', status),
    note = coalesce(updates->>'note', note),
    follow_up_at = CASE WHEN updates ? 'followUpAt' THEN to_timestamp((updates->>'followUpAt')::double precision / 1000) ELSE follow_up_at END,
    payload = CASE
      WHEN updates ? 'review_decision' THEN jsonb_set(payload, '{review_decision}', updates->'review_decision')
      WHEN updates ? 'reviewDecision' THEN jsonb_set(payload, '{review_decision}', updates->'reviewDecision')
      ELSE payload END,
    updated_at = now()
  WHERE workspace_id = owned_workspace AND id = record_id;
  INSERT INTO public.inquiry_events(workspace_id, inquiry_id, previous_status, changes)
  VALUES (owned_workspace, record_id, current_record.status, updates);
END;
$$;
REVOKE ALL ON FUNCTION public.update_own_inquiry(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_own_inquiry(text, jsonb) TO authenticated;
