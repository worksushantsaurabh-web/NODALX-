REVOKE ALL ON FUNCTION public.prepare_own_outbound_email(text, text, text, text, text) FROM authenticated, service_role;
DROP FUNCTION public.prepare_own_outbound_email(text, text, text, text, text);

CREATE FUNCTION public.reserve_outbound_email_service(
  owned_workspace text,
  record_id text,
  requested_key text,
  email_subject text,
  email_body text,
  content_hash text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  inquiry public.inquiries;
  existing public.outbound_emails;
  prepared public.outbound_emails;
  send_count integer;
BEGIN
  IF current_user NOT IN ('service_role', 'postgres') THEN
    RAISE EXCEPTION 'Service role required' USING ERRCODE = '42501';
  END IF;
  IF owned_workspace IS NULL OR record_id IS NULL OR requested_key IS NULL OR requested_key !~ '^[A-Za-z0-9_-]{8,128}$'
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
REVOKE ALL ON FUNCTION public.reserve_outbound_email_service(text, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_outbound_email_service(text, text, text, text, text, text) TO service_role;
