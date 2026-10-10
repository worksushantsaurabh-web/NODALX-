CREATE TABLE public.outbound_emails (
  workspace_id text NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  inquiry_id text NOT NULL,
  request_key text NOT NULL CHECK (request_key ~ '^[A-Za-z0-9_-]{8,128}$'),
  payload_hash text NOT NULL CHECK (length(payload_hash) = 64),
  recipient text NOT NULL CHECK (length(recipient) BETWEEN 3 AND 320),
  subject text NOT NULL CHECK (length(subject) BETWEEN 1 AND 200),
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 10000),
  state text NOT NULL DEFAULT 'prepared' CHECK (state IN ('prepared', 'sent', 'failed', 'unknown')),
  provider_message_id text,
  failure_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  PRIMARY KEY (workspace_id, id),
  UNIQUE (workspace_id, request_key),
  FOREIGN KEY (workspace_id, inquiry_id) REFERENCES public.inquiries(workspace_id, id)
);

CREATE INDEX outbound_emails_inquiry_feed_idx
  ON public.outbound_emails(workspace_id, inquiry_id, created_at DESC);

ALTER TABLE public.outbound_emails ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.outbound_emails FROM anon, authenticated;
GRANT SELECT ON public.outbound_emails TO authenticated;
GRANT ALL ON public.outbound_emails TO service_role;
CREATE POLICY outbound_emails_tenant_read ON public.outbound_emails FOR SELECT TO authenticated
USING (workspace_id = (SELECT private.current_workspace_id()));

CREATE TABLE private.outbound_email_limits (
  workspace_id text NOT NULL REFERENCES public.workspaces(id),
  window_start timestamptz NOT NULL,
  count integer NOT NULL CHECK (count > 0),
  PRIMARY KEY (workspace_id, window_start)
);
ALTER TABLE private.outbound_email_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.outbound_email_limits FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.prepare_own_outbound_email(
  record_id text,
  requested_key text,
  email_subject text,
  email_body text,
  content_hash text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  owned_workspace text := private.current_workspace_id();
  inquiry public.inquiries;
  existing public.outbound_emails;
  prepared public.outbound_emails;
  send_count integer;
BEGIN
  IF owned_workspace IS NULL THEN
    RAISE EXCEPTION 'Workspace unavailable' USING ERRCODE = '42501';
  END IF;
  IF record_id IS NULL OR requested_key IS NULL OR requested_key !~ '^[A-Za-z0-9_-]{8,128}$'
    OR email_subject IS NULL OR length(trim(email_subject)) NOT BETWEEN 1 AND 200
    OR email_body IS NULL OR length(trim(email_body)) NOT BETWEEN 1 AND 10000
    OR content_hash IS NULL OR content_hash !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'Invalid outbound email' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO inquiry FROM public.inquiries
  WHERE workspace_id = owned_workspace AND id = record_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inquiry not found' USING ERRCODE = 'P0002';
  END IF;
  IF inquiry.email IS NULL OR inquiry.email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' OR length(inquiry.email) > 320 THEN
    RAISE EXCEPTION 'Inquiry email unavailable' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO existing FROM public.outbound_emails
  WHERE workspace_id = owned_workspace AND request_key = requested_key;
  IF FOUND THEN
    IF existing.payload_hash <> content_hash OR existing.inquiry_id <> record_id THEN
      RAISE EXCEPTION 'Outbound email request conflict' USING ERRCODE = 'P0409';
    END IF;
    RETURN jsonb_build_object('created', false, 'id', existing.id, 'state', existing.state,
      'recipient', existing.recipient, 'subject', existing.subject, 'body', existing.body);
  END IF;

  INSERT INTO private.outbound_email_limits VALUES (owned_workspace, date_trunc('minute', now()), 1)
  ON CONFLICT (workspace_id, window_start) DO UPDATE SET count = private.outbound_email_limits.count + 1
  RETURNING count INTO send_count;
  IF send_count > 10 THEN
    RAISE EXCEPTION 'Outbound email rate limit reached' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.outbound_emails(workspace_id, inquiry_id, request_key, payload_hash, recipient, subject, body)
  VALUES (owned_workspace, record_id, requested_key, content_hash, lower(trim(inquiry.email)), trim(email_subject), trim(email_body))
  RETURNING * INTO prepared;
  RETURN jsonb_build_object('created', true, 'id', prepared.id, 'state', prepared.state,
    'recipient', prepared.recipient, 'subject', prepared.subject, 'body', prepared.body);
END;
$$;
REVOKE ALL ON FUNCTION public.prepare_own_outbound_email(text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prepare_own_outbound_email(text, text, text, text, text) TO authenticated;
