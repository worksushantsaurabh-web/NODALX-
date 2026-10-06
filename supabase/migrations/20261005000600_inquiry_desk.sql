ALTER TABLE public.inquiries ADD COLUMN note text NOT NULL DEFAULT '' CHECK (length(note) <= 4000);
ALTER TABLE public.inquiries ADD COLUMN follow_up_at timestamptz;
ALTER TABLE public.inquiries ADD COLUMN processing_status text NOT NULL DEFAULT 'awaiting_analysis';
ALTER TABLE public.subscriptions ADD COLUMN cancel_at_period_end boolean NOT NULL DEFAULT false;

CREATE TABLE public.workspace_settings (
  workspace_id text PRIMARY KEY REFERENCES public.workspaces(id),
  criteria text NOT NULL DEFAULT '' CHECK (length(criteria) <= 4000),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.workspace_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.workspace_settings FROM anon, authenticated;
GRANT SELECT ON public.workspace_settings TO authenticated;
GRANT ALL ON public.workspace_settings TO service_role;
CREATE POLICY workspace_settings_tenant_read ON public.workspace_settings FOR SELECT TO authenticated
USING (workspace_id = (SELECT private.current_workspace_id()));

CREATE TABLE public.inquiry_events (
  workspace_id text NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  inquiry_id text NOT NULL,
  previous_status text NOT NULL,
  changes jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, id),
  FOREIGN KEY (workspace_id, inquiry_id) REFERENCES public.inquiries(workspace_id, id)
);
CREATE INDEX inquiry_events_feed_idx ON public.inquiry_events(workspace_id, inquiry_id, created_at DESC);
CREATE INDEX inquiries_feed_idx ON public.inquiries(workspace_id, created_at DESC, id DESC);
ALTER TABLE public.inquiry_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.inquiry_events FROM anon, authenticated;
GRANT SELECT ON public.inquiry_events TO authenticated;
GRANT ALL ON public.inquiry_events TO service_role;
CREATE POLICY inquiry_events_tenant_read ON public.inquiry_events FOR SELECT TO authenticated
USING (workspace_id = (SELECT private.current_workspace_id()));

CREATE TABLE private.desk_write_limits (
  workspace_id text NOT NULL REFERENCES public.workspaces(id),
  window_start timestamptz NOT NULL,
  count integer NOT NULL CHECK (count > 0),
  PRIMARY KEY (workspace_id, window_start)
);
ALTER TABLE private.desk_write_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.desk_write_limits FROM PUBLIC, anon, authenticated;

CREATE FUNCTION private.limit_desk_write()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  owned_workspace text := private.current_workspace_id();
  write_count integer;
BEGIN
  IF owned_workspace IS NULL THEN
    RAISE EXCEPTION 'Workspace unavailable' USING ERRCODE = '42501';
  END IF;
  INSERT INTO private.desk_write_limits VALUES (owned_workspace, date_trunc('minute', now()), 1)
  ON CONFLICT (workspace_id, window_start) DO UPDATE SET count = private.desk_write_limits.count + 1
  RETURNING count INTO write_count;
  IF write_count > 60 THEN
    RAISE EXCEPTION 'Desk rate limit reached' USING ERRCODE = 'P0001';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION private.limit_desk_write() FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.update_own_inquiry(record_id text, updates jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  owned_workspace text := private.current_workspace_id();
  current_record public.inquiries;
BEGIN
  IF updates IS NULL OR jsonb_typeof(updates) IS DISTINCT FROM 'object'
    OR updates = '{}'::jsonb OR EXISTS (
      SELECT 1 FROM jsonb_object_keys(updates) field WHERE field NOT IN ('status', 'note', 'followUpAt')
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
    updated_at = now()
  WHERE workspace_id = owned_workspace AND id = record_id;
  INSERT INTO public.inquiry_events(workspace_id, inquiry_id, previous_status, changes)
  VALUES (owned_workspace, record_id, current_record.status, updates);
END;
$$;
REVOKE ALL ON FUNCTION public.update_own_inquiry(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_own_inquiry(text, jsonb) TO authenticated;

CREATE FUNCTION public.update_own_criteria(value text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF value IS NULL OR length(value) > 4000 THEN
    RAISE EXCEPTION 'Invalid criteria' USING ERRCODE = '22023';
  END IF;
  PERFORM private.limit_desk_write();
  INSERT INTO public.workspace_settings(workspace_id, criteria) VALUES (private.current_workspace_id(), trim(value))
  ON CONFLICT (workspace_id) DO UPDATE SET criteria = excluded.criteria, updated_at = now();
END;
$$;
REVOKE ALL ON FUNCTION public.update_own_criteria(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_own_criteria(text) TO authenticated;

CREATE FUNCTION public.own_workspace_overview(selected_days integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
  owned_workspace text := private.current_workspace_id();
  since_time timestamptz;
  status_totals jsonb;
  processing_totals jsonb;
  source_totals jsonb;
  overdue bigint;
  total bigint;
BEGIN
  IF selected_days IS NULL OR selected_days NOT IN (7, 30, 90) THEN
    RAISE EXCEPTION 'Invalid report period' USING ERRCODE = '22023';
  END IF;
  IF owned_workspace IS NULL THEN
    RAISE EXCEPTION 'Workspace unavailable' USING ERRCODE = '42501';
  END IF;
  since_time := now() - make_interval(days => selected_days);
  SELECT count(*) INTO total FROM public.inquiries WHERE workspace_id = owned_workspace AND created_at >= since_time;
  SELECT coalesce(jsonb_object_agg(label, count), '{}') INTO status_totals FROM (
    SELECT CASE WHEN lower(trim(status)) IN ('new', 'pending', 'review', 'needs review') THEN 'Pending' ELSE status END AS label, count(*)
    FROM public.inquiries WHERE workspace_id = owned_workspace AND created_at >= since_time GROUP BY label
  ) groups;
  SELECT coalesce(jsonb_object_agg(label, count), '{}') INTO processing_totals FROM (
    SELECT processing_status AS label, count(*) FROM public.inquiries
    WHERE workspace_id = owned_workspace AND created_at >= since_time GROUP BY label
  ) groups;
  SELECT coalesce(jsonb_object_agg(label, count), '{}') INTO source_totals FROM (
    SELECT coalesce(nullif(payload->>'source', ''), 'other') AS label, count(*) FROM public.inquiries
    WHERE workspace_id = owned_workspace AND created_at >= since_time GROUP BY label
  ) groups;
  SELECT count(*) INTO overdue FROM public.inquiries WHERE workspace_id = owned_workspace
    AND lower(trim(status)) IN ('new', 'pending', 'review', 'needs review', 'qualified', 'contacted')
    AND follow_up_at > to_timestamp(0) AND follow_up_at < now();
  RETURN jsonb_build_object('days', selected_days, 'since', since_time, 'total', total,
    'statuses', status_totals, 'processing', processing_totals, 'sources', source_totals,
    'overdue', overdue, 'generatedAt', floor(extract(epoch FROM now()) * 1000));
END;
$$;
REVOKE ALL ON FUNCTION public.own_workspace_overview(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.own_workspace_overview(integer) TO authenticated;
