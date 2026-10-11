-- Managed reply identities. Nothing in this migration enables outbound use.
ALTER TABLE public.workspaces ADD COLUMN email_alias text;
ALTER TABLE public.outbound_emails ADD COLUMN provider_rfc_message_id text;
CREATE INDEX outbound_emails_rfc_message_idx ON public.outbound_emails(workspace_id, provider_rfc_message_id)
  WHERE provider_rfc_message_id IS NOT NULL;
ALTER TABLE public.workspaces ADD CONSTRAINT workspaces_email_alias_format CHECK (
  email_alias IS NULL OR (
    length(email_alias) BETWEEN 3 AND 30
    AND email_alias ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$'
    AND email_alias !~ '--'
    AND email_alias <> ALL (ARRAY['admin','support','postmaster','abuse','noreply','security','billing','help','root','www'])
  )
);
CREATE UNIQUE INDEX workspaces_email_alias_unique ON public.workspaces(email_alias);

CREATE TABLE private.workspace_email_alias_history (
  alias text PRIMARY KEY,
  new_alias text NOT NULL,
  workspace_id text NOT NULL REFERENCES public.workspaces(id) ON DELETE RESTRICT,
  changed_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  retired_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE private.workspace_email_alias_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.workspace_email_alias_history FROM PUBLIC, anon, authenticated;
GRANT SELECT ON private.workspace_email_alias_history TO service_role;

CREATE FUNCTION private.allocate_workspace_email_alias() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE candidate text; attempt integer := 0;
BEGIN
  -- Serialize allocation and explicit changes across concurrent workspaces.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('nodalx.workspace_email_alias'));
  LOOP
    candidate := 'w-' || substr(md5(NEW.id || ':' || attempt::text), 1, 20);
    IF NOT EXISTS (SELECT 1 FROM private.workspace_email_alias_history WHERE alias = candidate)
      AND NOT EXISTS (SELECT 1 FROM public.workspaces WHERE email_alias = candidate) THEN
      NEW.email_alias := candidate;
      RETURN NEW;
    END IF;
    attempt := attempt + 1;
    IF attempt > 100 THEN RAISE EXCEPTION 'Alias allocation unavailable' USING ERRCODE = 'P0001'; END IF;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION private.allocate_workspace_email_alias() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER allocate_workspace_email_alias BEFORE INSERT ON public.workspaces
FOR EACH ROW EXECUTE FUNCTION private.allocate_workspace_email_alias();

DO $$
DECLARE workspace_row record; candidate text; attempt integer;
BEGIN
  FOR workspace_row IN SELECT id FROM public.workspaces WHERE email_alias IS NULL ORDER BY id LOOP
    attempt := 0;
    LOOP
      candidate := 'w-' || substr(md5(workspace_row.id || ':' || attempt::text), 1, 20);
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.workspaces WHERE email_alias = candidate);
      attempt := attempt + 1;
      IF attempt > 100 THEN RAISE EXCEPTION 'Alias backfill unavailable'; END IF;
    END LOOP;
    UPDATE public.workspaces SET email_alias = candidate WHERE id = workspace_row.id;
  END LOOP;
END;
$$;
ALTER TABLE public.workspaces ALTER COLUMN email_alias SET NOT NULL;

CREATE FUNCTION private.guard_workspace_email_alias_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF OLD.email_alias IS DISTINCT FROM NEW.email_alias THEN
    IF current_setting('nodalx.alias_change', true) IS DISTINCT FROM 'allowed' THEN
      RAISE EXCEPTION 'Alias changes require the dedicated action' USING ERRCODE = '42501';
    END IF;
    IF EXISTS (SELECT 1 FROM private.workspace_email_alias_history WHERE alias = NEW.email_alias) THEN
      RAISE EXCEPTION 'Alias unavailable' USING ERRCODE = '23505';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.guard_workspace_email_alias_change() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER guard_workspace_email_alias_change BEFORE UPDATE OF email_alias ON public.workspaces
FOR EACH ROW EXECUTE FUNCTION private.guard_workspace_email_alias_change();

CREATE FUNCTION public.change_workspace_email_alias_service(
  owned_workspace text, requested_alias text, actor_user_id uuid
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE old_alias text;
BEGIN
  IF actor_user_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.identity_bindings
    WHERE workspace_id = owned_workspace AND auth_user_id = actor_user_id
  ) THEN RAISE EXCEPTION 'Workspace owner required' USING ERRCODE = '42501'; END IF;
  IF requested_alias IS NULL OR length(requested_alias) NOT BETWEEN 3 AND 30
    OR requested_alias !~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$'
    OR requested_alias ~ '--'
    OR requested_alias = ANY (ARRAY['admin','support','postmaster','abuse','noreply','security','billing','help','root','www'])
  THEN RAISE EXCEPTION 'Invalid alias' USING ERRCODE = '22023'; END IF;
  SELECT email_alias INTO old_alias FROM public.workspaces WHERE id = owned_workspace FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Workspace unavailable' USING ERRCODE = 'P0002'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('nodalx.workspace_email_alias'));
  IF requested_alias = old_alias THEN RETURN old_alias; END IF;
  IF EXISTS (SELECT 1 FROM private.workspace_email_alias_history WHERE workspace_id = owned_workspace
    AND retired_at > now() - interval '24 hours') THEN
    RAISE EXCEPTION 'Alias changed recently' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM private.workspace_email_alias_history WHERE alias = requested_alias)
    OR EXISTS (SELECT 1 FROM public.workspaces WHERE email_alias = requested_alias) THEN
    RAISE EXCEPTION 'Alias unavailable' USING ERRCODE = '23505';
  END IF;
  INSERT INTO private.workspace_email_alias_history(alias, new_alias, workspace_id, changed_by)
    VALUES (old_alias, requested_alias, owned_workspace, actor_user_id);
  PERFORM set_config('nodalx.alias_change', 'allowed', true);
  UPDATE public.workspaces SET email_alias = requested_alias, updated_at = now() WHERE id = owned_workspace;
  PERFORM set_config('nodalx.alias_change', '', true);
  RETURN requested_alias;
END;
$$;
REVOKE ALL ON FUNCTION public.change_workspace_email_alias_service(text,text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.change_workspace_email_alias_service(text,text,uuid) TO service_role;

CREATE TABLE public.inbound_emails (
  workspace_id text NOT NULL REFERENCES public.workspaces(id) ON DELETE RESTRICT,
  provider_email_id text NOT NULL CHECK (length(provider_email_id) BETWEEN 1 AND 200),
  inquiry_id text,
  received_alias text NOT NULL CHECK (length(received_alias) BETWEEN 3 AND 30),
  sender text NOT NULL CHECK (length(sender) BETWEEN 3 AND 320),
  subject text NOT NULL DEFAULT '' CHECK (length(subject) <= 200),
  body text NOT NULL DEFAULT '' CHECK (length(body) <= 100000),
  message_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, provider_email_id),
  UNIQUE (provider_email_id),
  FOREIGN KEY (workspace_id, inquiry_id) REFERENCES public.inquiries(workspace_id, id)
);
CREATE INDEX inbound_emails_inquiry_feed_idx ON public.inbound_emails(workspace_id, inquiry_id, created_at DESC);
ALTER TABLE public.inbound_emails ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.inbound_emails FROM anon, authenticated;
GRANT SELECT ON public.inbound_emails TO authenticated;
GRANT ALL ON public.inbound_emails TO service_role;
CREATE POLICY inbound_emails_tenant_read ON public.inbound_emails FOR SELECT TO authenticated
USING (workspace_id = (SELECT private.current_workspace_id()));

CREATE FUNCTION public.store_received_email_service(
  provider_id text, recipient_alias text, sender_address text,
  email_subject text, email_body text, rfc_message_id text, in_reply_to text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE target_workspace text; matched_inquiry text;
BEGIN
  IF provider_id IS NULL OR length(provider_id) NOT BETWEEN 1 AND 200
    OR recipient_alias IS NULL OR recipient_alias !~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$'
    OR length(recipient_alias) NOT BETWEEN 3 AND 30
    OR sender_address IS NULL OR length(sender_address) NOT BETWEEN 3 AND 320
    OR email_subject IS NULL OR length(email_subject) > 200
    OR email_body IS NULL OR length(email_body) > 100000
    OR length(coalesce(rfc_message_id, '')) > 500
    OR length(coalesce(in_reply_to, '')) > 500
  THEN RAISE EXCEPTION 'Invalid received email' USING ERRCODE = '22023'; END IF;
  SELECT id INTO target_workspace FROM public.workspaces WHERE email_alias = recipient_alias;
  IF target_workspace IS NULL THEN
    SELECT workspace_id INTO target_workspace FROM private.workspace_email_alias_history WHERE alias = recipient_alias;
  END IF;
  IF target_workspace IS NULL THEN RETURN false; END IF;
  -- Sender alone is not proof of a thread. Match the sent RFC Message-ID and
  -- the stored recipient; otherwise leave the mail in the workspace inbox.
  IF in_reply_to IS NOT NULL AND in_reply_to <> '' THEN
    SELECT inquiry_id INTO matched_inquiry FROM public.outbound_emails
      WHERE workspace_id = target_workspace AND provider_rfc_message_id = in_reply_to
        AND lower(recipient) = lower(sender_address) AND state = 'sent'
      LIMIT 1;
  END IF;
  INSERT INTO public.inbound_emails(workspace_id, provider_email_id, inquiry_id,
    received_alias, sender, subject, body, message_id)
    VALUES (target_workspace, provider_id, matched_inquiry, recipient_alias,
      sender_address, email_subject, email_body, rfc_message_id)
    ON CONFLICT (provider_email_id) DO NOTHING;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.store_received_email_service(text,text,text,text,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.store_received_email_service(text,text,text,text,text,text,text) TO service_role;
