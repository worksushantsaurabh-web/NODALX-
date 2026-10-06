CREATE FUNCTION private.current_workspace_id()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT workspace_id FROM public.identity_bindings WHERE auth_user_id = (SELECT auth.uid())
$$;
REVOKE ALL ON FUNCTION private.current_workspace_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.current_workspace_id() TO authenticated, service_role;

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.workspaces FROM anon, authenticated;
GRANT ALL ON public.workspaces TO service_role;
GRANT SELECT ON public.workspaces TO authenticated;
CREATE POLICY workspaces_tenant_read ON public.workspaces FOR SELECT TO authenticated USING (id = (SELECT private.current_workspace_id()));

ALTER TABLE public.identity_bindings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.identity_bindings FROM anon, authenticated;
GRANT ALL ON public.identity_bindings TO service_role;
GRANT SELECT ON public.identity_bindings TO authenticated;
CREATE POLICY identity_bindings_tenant_read ON public.identity_bindings FOR SELECT TO authenticated USING (auth_user_id = (SELECT auth.uid()));

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.profiles FROM anon, authenticated;
GRANT ALL ON public.profiles TO service_role;
GRANT SELECT ON public.profiles TO authenticated;
CREATE POLICY profiles_tenant_read ON public.profiles FOR SELECT TO authenticated USING (workspace_id = (SELECT private.current_workspace_id()));

ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.inquiries FROM anon, authenticated;
GRANT ALL ON public.inquiries TO service_role;
GRANT SELECT ON public.inquiries TO authenticated;
CREATE POLICY inquiries_tenant_read ON public.inquiries FOR SELECT TO authenticated USING (workspace_id = (SELECT private.current_workspace_id()));

ALTER TABLE public.flows ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.flows FROM anon, authenticated;
GRANT ALL ON public.flows TO service_role;
GRANT SELECT ON public.flows TO authenticated;
CREATE POLICY flows_tenant_read ON public.flows FOR SELECT TO authenticated USING (workspace_id = (SELECT private.current_workspace_id()));

ALTER TABLE public.connectors ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.connectors FROM anon, authenticated;
GRANT ALL ON public.connectors TO service_role;
GRANT SELECT ON public.connectors TO authenticated;
CREATE POLICY connectors_tenant_read ON public.connectors FOR SELECT TO authenticated USING (workspace_id = (SELECT private.current_workspace_id()));

ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notification_settings FROM anon, authenticated;
GRANT ALL ON public.notification_settings TO service_role;
GRANT SELECT ON public.notification_settings TO authenticated;
CREATE POLICY notification_settings_tenant_read ON public.notification_settings FOR SELECT TO authenticated USING (workspace_id = (SELECT private.current_workspace_id()));

ALTER TABLE public.sheet_connections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sheet_connections FROM anon, authenticated;
GRANT ALL ON public.sheet_connections TO service_role;
GRANT SELECT ON public.sheet_connections TO authenticated;
CREATE POLICY sheet_connections_tenant_read ON public.sheet_connections FOR SELECT TO authenticated USING (workspace_id = (SELECT private.current_workspace_id()));

ALTER TABLE public.artifacts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.artifacts FROM anon, authenticated;
GRANT ALL ON public.artifacts TO service_role;
GRANT SELECT ON public.artifacts TO authenticated;
CREATE POLICY artifacts_tenant_read ON public.artifacts FOR SELECT TO authenticated USING (workspace_id = (SELECT private.current_workspace_id()));

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.jobs FROM anon, authenticated;
GRANT ALL ON public.jobs TO service_role;
GRANT SELECT ON public.jobs TO authenticated;
CREATE POLICY jobs_tenant_read ON public.jobs FOR SELECT TO authenticated USING (workspace_id = (SELECT private.current_workspace_id()));

ALTER TABLE public.job_rows ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.job_rows FROM anon, authenticated;
GRANT ALL ON public.job_rows TO service_role;
GRANT SELECT ON public.job_rows TO authenticated;
CREATE POLICY job_rows_tenant_read ON public.job_rows FOR SELECT TO authenticated USING (workspace_id = (SELECT private.current_workspace_id()));

ALTER TABLE public.job_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.job_events FROM anon, authenticated;
GRANT ALL ON public.job_events TO service_role;
GRANT SELECT ON public.job_events TO authenticated;
CREATE POLICY job_events_tenant_read ON public.job_events FOR SELECT TO authenticated USING (workspace_id = (SELECT private.current_workspace_id()));

ALTER TABLE public.import_recipes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.import_recipes FROM anon, authenticated;
GRANT ALL ON public.import_recipes TO service_role;
GRANT SELECT ON public.import_recipes TO authenticated;
CREATE POLICY import_recipes_tenant_read ON public.import_recipes FOR SELECT TO authenticated USING (workspace_id = (SELECT private.current_workspace_id()));

ALTER TABLE public.import_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.import_runs FROM anon, authenticated;
GRANT ALL ON public.import_runs TO service_role;
GRANT SELECT ON public.import_runs TO authenticated;
CREATE POLICY import_runs_tenant_read ON public.import_runs FOR SELECT TO authenticated USING (workspace_id = (SELECT private.current_workspace_id()));

ALTER TABLE public.review_exceptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.review_exceptions FROM anon, authenticated;
GRANT ALL ON public.review_exceptions TO service_role;
GRANT SELECT ON public.review_exceptions TO authenticated;
CREATE POLICY review_exceptions_tenant_read ON public.review_exceptions FOR SELECT TO authenticated USING (workspace_id = (SELECT private.current_workspace_id()));

ALTER TABLE public.usage_periods ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.usage_periods FROM anon, authenticated;
GRANT ALL ON public.usage_periods TO service_role;
GRANT SELECT ON public.usage_periods TO authenticated;
CREATE POLICY usage_periods_tenant_read ON public.usage_periods FOR SELECT TO authenticated USING (workspace_id = (SELECT private.current_workspace_id()));

ALTER TABLE public.usage_reservations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.usage_reservations FROM anon, authenticated;
GRANT ALL ON public.usage_reservations TO service_role;
GRANT SELECT ON public.usage_reservations TO authenticated;
CREATE POLICY usage_reservations_tenant_read ON public.usage_reservations FOR SELECT TO authenticated USING (workspace_id = (SELECT private.current_workspace_id()));

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.subscriptions FROM anon, authenticated;
GRANT ALL ON public.subscriptions TO service_role;
GRANT SELECT ON public.subscriptions TO authenticated;
CREATE POLICY subscriptions_tenant_read ON public.subscriptions FOR SELECT TO authenticated USING (workspace_id = (SELECT private.current_workspace_id()));

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.api_keys FROM anon, authenticated;
GRANT ALL ON public.api_keys TO service_role;

ALTER TABLE public.connector_credentials ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.connector_credentials FROM anon, authenticated;
GRANT ALL ON public.connector_credentials TO service_role;

ALTER TABLE public.billing_bindings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.billing_bindings FROM anon, authenticated;
GRANT ALL ON public.billing_bindings TO service_role;

ALTER TABLE public.webhook_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.webhook_receipts FROM anon, authenticated;
GRANT ALL ON public.webhook_receipts TO service_role;

ALTER TABLE public.outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.outbox FROM anon, authenticated;
GRANT ALL ON public.outbox TO service_role;

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.feedback FROM anon, authenticated;
GRANT ALL ON public.feedback TO service_role;

CREATE FUNCTION private.provision_auth_workspace(target_user_id uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  existing_workspace text;
  new_workspace text;
  auth_record auth.users;
BEGIN
  SELECT * INTO auth_record FROM auth.users WHERE id = target_user_id FOR UPDATE;
  IF NOT FOUND OR coalesce(auth_record.is_anonymous, false) THEN
    RAISE EXCEPTION 'Verified account required' USING ERRCODE = '42501';
  END IF;
  SELECT workspace_id INTO existing_workspace FROM public.identity_bindings WHERE auth_user_id = target_user_id;
  IF existing_workspace IS NOT NULL THEN
    RETURN existing_workspace;
  END IF;
  new_workspace := 'supabase:' || target_user_id::text;
  INSERT INTO public.workspaces(id, name)
    VALUES (new_workspace, coalesce(nullif(left(trim(auth_record.raw_user_meta_data->>'company_name'), 120), ''), 'My Workspace'));
  INSERT INTO public.identity_bindings(auth_user_id, workspace_id) VALUES (target_user_id, new_workspace);
  INSERT INTO public.profiles(workspace_id, display_name)
    VALUES (new_workspace, coalesce(nullif(left(trim(auth_record.raw_user_meta_data->>'full_name'), 120), ''), 'User'));
  INSERT INTO public.subscriptions(workspace_id) VALUES (new_workspace);
  INSERT INTO public.notification_settings(workspace_id) VALUES (new_workspace);
  RETURN new_workspace;
END;
$$;
REVOKE ALL ON FUNCTION private.provision_auth_workspace(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.provision_auth_workspace(uuid) TO service_role;

CREATE FUNCTION public.bootstrap_workspace()
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM auth.users WHERE id = auth.uid()
      AND (email_confirmed_at IS NOT NULL OR phone_confirmed_at IS NOT NULL)
      AND NOT coalesce(is_anonymous, false)
  ) THEN
    RAISE EXCEPTION 'Verified account required' USING ERRCODE = '42501';
  END IF;
  RETURN private.provision_auth_workspace(auth.uid());
END;
$$;
REVOKE ALL ON FUNCTION public.bootstrap_workspace() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bootstrap_workspace() TO authenticated;

CREATE FUNCTION public.update_own_profile(updates jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  owned_workspace text;
BEGIN
  owned_workspace := private.current_workspace_id();
  IF owned_workspace IS NULL THEN
    RAISE EXCEPTION 'Workspace unavailable' USING ERRCODE = '42501';
  END IF;
  IF updates IS NULL OR jsonb_typeof(updates) IS DISTINCT FROM 'object' OR EXISTS (
    SELECT 1 FROM jsonb_object_keys(updates) field
    WHERE field NOT IN ('displayName', 'workspace', 'role', 'timezone', 'notifications')
  ) THEN
    RAISE EXCEPTION 'Invalid profile fields' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_each(updates) field WHERE field.key <> 'notifications'
      AND (jsonb_typeof(field.value) <> 'string' OR length(trim(field.value #>> '{}')) NOT BETWEEN 1 AND 120)
  ) THEN
    RAISE EXCEPTION 'Invalid profile values' USING ERRCODE = '22023';
  END IF;
  IF updates ? 'notifications' THEN
    IF jsonb_typeof(updates->'notifications') <> 'object' THEN
      RAISE EXCEPTION 'Invalid notifications' USING ERRCODE = '22023';
    END IF;
    IF EXISTS (
      SELECT 1 FROM jsonb_each(updates->'notifications') field
      WHERE field.key NOT IN ('flowFailure', 'weeklySummary', 'securityAlerts') OR jsonb_typeof(field.value) <> 'boolean'
    ) THEN
      RAISE EXCEPTION 'Invalid notifications' USING ERRCODE = '22023';
    END IF;
  END IF;
  IF updates ? 'workspace' THEN
    UPDATE public.workspaces SET name = trim(updates->>'workspace'), updated_at = now() WHERE id = owned_workspace;
  END IF;
  UPDATE public.profiles SET
    display_name = coalesce(trim(updates->>'displayName'), display_name),
    job_title = coalesce(trim(updates->>'role'), job_title),
    timezone = coalesce(trim(updates->>'timezone'), timezone),
    notifications = notifications || coalesce(updates->'notifications', '{}'::jsonb),
    updated_at = now()
  WHERE workspace_id = owned_workspace;
END;
$$;
REVOKE ALL ON FUNCTION public.update_own_profile(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_own_profile(jsonb) TO authenticated;
