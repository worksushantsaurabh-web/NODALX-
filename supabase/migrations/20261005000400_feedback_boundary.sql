CREATE TABLE private.feedback_limits (
  workspace_id text NOT NULL REFERENCES public.workspaces(id),
  window_start timestamptz NOT NULL,
  submissions integer NOT NULL CHECK (submissions >= 0),
  PRIMARY KEY (workspace_id, window_start)
);
ALTER TABLE private.feedback_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.feedback_limits FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.submit_own_feedback(submission jsonb)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  owned_workspace text;
  submission_id uuid;
  submission_count integer;
BEGIN
  owned_workspace := private.current_workspace_id();
  IF owned_workspace IS NULL THEN
    RAISE EXCEPTION 'Workspace unavailable' USING ERRCODE = '42501';
  END IF;
  IF submission IS NULL OR jsonb_typeof(submission) IS DISTINCT FROM 'object' OR EXISTS (
    SELECT 1 FROM jsonb_object_keys(submission) field
    WHERE field NOT IN ('type', 'category', 'surveyContext', 'rating', 'message', 'page')
  ) THEN
    RAISE EXCEPTION 'Invalid feedback fields' USING ERRCODE = '22023';
  END IF;
  IF submission->>'type' NOT IN ('widget', 'survey') OR submission->>'type' IS NULL
    OR jsonb_typeof(submission->'message') IS DISTINCT FROM 'string'
    OR length(submission->>'message') > 4000
    OR (submission ? 'page' AND (jsonb_typeof(submission->'page') IS DISTINCT FROM 'string' OR length(submission->>'page') > 300)) THEN
    RAISE EXCEPTION 'Invalid feedback values' USING ERRCODE = '22023';
  END IF;
  IF submission->>'type' = 'widget' AND (
    submission->>'category' IS NULL OR submission->>'category' NOT IN ('bug', 'feature', 'question', 'general')
    OR length(trim(submission->>'message')) = 0
  ) THEN
    RAISE EXCEPTION 'Invalid feedback category' USING ERRCODE = '22023';
  END IF;
  IF submission->>'type' = 'survey' AND (
    submission->>'surveyContext' IS NULL OR submission->>'surveyContext' NOT IN ('form_submission', 'onboarding_complete', 'key_generated')
    OR jsonb_typeof(submission->'rating') IS DISTINCT FROM 'number'
    OR coalesce(submission->>'rating', '') NOT IN ('1', '2', '3', '4', '5')
  ) THEN
    RAISE EXCEPTION 'Invalid survey values' USING ERRCODE = '22023';
  END IF;
  INSERT INTO private.feedback_limits(workspace_id, window_start, submissions)
  VALUES (owned_workspace, date_trunc('hour', now()), 1)
  ON CONFLICT (workspace_id, window_start) DO UPDATE
    SET submissions = private.feedback_limits.submissions + 1
  RETURNING submissions INTO submission_count;
  IF submission_count > 10 THEN
    RAISE EXCEPTION 'Feedback rate limit reached' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.feedback(workspace_id, type, category, survey_context, rating, message, page)
  VALUES (
    owned_workspace, submission->>'type',
    CASE WHEN submission->>'type' = 'widget' THEN submission->>'category' END,
    CASE WHEN submission->>'type' = 'survey' THEN submission->>'surveyContext' END,
    CASE WHEN submission->>'type' = 'survey' THEN (submission->>'rating')::integer END,
    submission->>'message', coalesce(submission->>'page', '/')
  ) RETURNING id INTO submission_id;
  RETURN submission_id;
END;
$$;
REVOKE ALL ON FUNCTION public.submit_own_feedback(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_own_feedback(jsonb) TO authenticated;
