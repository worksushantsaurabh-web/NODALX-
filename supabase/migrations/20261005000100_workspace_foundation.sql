CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;
REVOKE CREATE ON SCHEMA public FROM PUBLIC, anon, authenticated;

CREATE TABLE public.workspaces (
  id text PRIMARY KEY,
  name text NOT NULL DEFAULT 'My Workspace' CHECK (length(name) BETWEEN 1 AND 120),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.identity_bindings (
  auth_user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
  workspace_id text NOT NULL UNIQUE REFERENCES public.workspaces(id) ON DELETE RESTRICT,
  legacy_firebase_uid text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.profiles (
  workspace_id text PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE RESTRICT,
  display_name text NOT NULL DEFAULT 'User' CHECK (length(display_name) BETWEEN 1 AND 120),
  photo_url text NOT NULL DEFAULT '',
  job_title text NOT NULL DEFAULT 'Founder' CHECK (length(job_title) <= 120),
  timezone text NOT NULL DEFAULT 'UTC',
  notifications jsonb NOT NULL DEFAULT '{"flowFailure":true,"weeklySummary":true,"securityAlerts":true}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.inquiries (
  workspace_id text NOT NULL REFERENCES public.workspaces(id) ON DELETE RESTRICT,
  id text NOT NULL,
  original_message text NOT NULL,
  name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'new',
  source_reference jsonb NOT NULL DEFAULT '{}',
  payload jsonb NOT NULL DEFAULT '{}',
  fingerprint text,
  PRIMARY KEY (workspace_id, id),
  UNIQUE (workspace_id, fingerprint),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX inquiries_workspace_created_idx ON public.inquiries (workspace_id, created_at DESC);

CREATE TABLE public.flows (
  workspace_id text NOT NULL REFERENCES public.workspaces(id) ON DELETE RESTRICT,
  id text NOT NULL,
  name text NOT NULL,
  configuration jsonb NOT NULL DEFAULT '{}',
  enabled boolean NOT NULL DEFAULT false,
  PRIMARY KEY (workspace_id, id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX flows_workspace_created_idx ON public.flows (workspace_id, created_at DESC);

CREATE TABLE public.connectors (
  workspace_id text NOT NULL REFERENCES public.workspaces(id) ON DELETE RESTRICT,
  id text NOT NULL,
  kind text NOT NULL,
  status text NOT NULL DEFAULT 'disconnected',
  public_configuration jsonb NOT NULL DEFAULT '{}',
  PRIMARY KEY (workspace_id, id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX connectors_workspace_created_idx ON public.connectors (workspace_id, created_at DESC);

CREATE TABLE public.notification_settings (
  workspace_id text NOT NULL REFERENCES public.workspaces(id) ON DELETE RESTRICT,
  settings jsonb NOT NULL DEFAULT '{}',
  PRIMARY KEY (workspace_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notification_settings_workspace_created_idx ON public.notification_settings (workspace_id, created_at DESC);

CREATE TABLE public.sheet_connections (
  workspace_id text NOT NULL REFERENCES public.workspaces(id) ON DELETE RESTRICT,
  id text NOT NULL,
  spreadsheet_id text NOT NULL,
  state text NOT NULL DEFAULT 'unverified',
  source_reference jsonb NOT NULL DEFAULT '{}',
  PRIMARY KEY (workspace_id, id),
  UNIQUE (spreadsheet_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sheet_connections_workspace_created_idx ON public.sheet_connections (workspace_id, created_at DESC);

CREATE TABLE public.artifacts (
  workspace_id text NOT NULL REFERENCES public.workspaces(id) ON DELETE RESTRICT,
  id text NOT NULL,
  object_path text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes >= 0),
  expires_at timestamptz,
  PRIMARY KEY (workspace_id, id),
  UNIQUE (object_path),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX artifacts_workspace_created_idx ON public.artifacts (workspace_id, created_at DESC);

CREATE TABLE public.jobs (
  workspace_id text NOT NULL REFERENCES public.workspaces(id) ON DELETE RESTRICT,
  id text NOT NULL,
  artifact_id text,
  mode text NOT NULL CHECK (mode IN ('import', 'process')),
  state text NOT NULL DEFAULT 'queued',
  progress jsonb NOT NULL DEFAULT '{}',
  lease_until timestamptz,
  idempotency_key text,
  payload_hash text,
  PRIMARY KEY (workspace_id, id),
  UNIQUE (workspace_id, idempotency_key),
  FOREIGN KEY (workspace_id, artifact_id) REFERENCES public.artifacts(workspace_id, id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX jobs_workspace_created_idx ON public.jobs (workspace_id, created_at DESC);

CREATE TABLE public.job_rows (
  workspace_id text NOT NULL REFERENCES public.workspaces(id) ON DELETE RESTRICT,
  id text NOT NULL,
  job_id text NOT NULL,
  original_row jsonb NOT NULL,
  result jsonb,
  state text NOT NULL DEFAULT 'pending',
  source_reference jsonb NOT NULL DEFAULT '{}',
  PRIMARY KEY (workspace_id, id),
  FOREIGN KEY (workspace_id, job_id) REFERENCES public.jobs(workspace_id, id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX job_rows_workspace_created_idx ON public.job_rows (workspace_id, created_at DESC);

CREATE TABLE public.job_events (
  workspace_id text NOT NULL REFERENCES public.workspaces(id) ON DELETE RESTRICT,
  id text NOT NULL,
  job_id text NOT NULL,
  event_type text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}',
  PRIMARY KEY (workspace_id, id),
  FOREIGN KEY (workspace_id, job_id) REFERENCES public.jobs(workspace_id, id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX job_events_workspace_created_idx ON public.job_events (workspace_id, created_at DESC);

CREATE TABLE public.import_recipes (
  workspace_id text NOT NULL REFERENCES public.workspaces(id) ON DELETE RESTRICT,
  id text NOT NULL,
  sheet_connection_id text,
  name text NOT NULL,
  mapping jsonb NOT NULL DEFAULT '{}',
  enabled boolean NOT NULL DEFAULT false,
  configuration jsonb NOT NULL DEFAULT '{}',
  PRIMARY KEY (workspace_id, id),
  FOREIGN KEY (workspace_id, sheet_connection_id) REFERENCES public.sheet_connections(workspace_id, id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX import_recipes_workspace_created_idx ON public.import_recipes (workspace_id, created_at DESC);

CREATE TABLE public.import_runs (
  workspace_id text NOT NULL REFERENCES public.workspaces(id) ON DELETE RESTRICT,
  id text NOT NULL,
  recipe_id text NOT NULL,
  job_id text,
  state text NOT NULL DEFAULT 'queued',
  idempotency_key text NOT NULL,
  PRIMARY KEY (workspace_id, id),
  UNIQUE (workspace_id, idempotency_key),
  FOREIGN KEY (workspace_id, recipe_id) REFERENCES public.import_recipes(workspace_id, id),
  FOREIGN KEY (workspace_id, job_id) REFERENCES public.jobs(workspace_id, id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX import_runs_workspace_created_idx ON public.import_runs (workspace_id, created_at DESC);

CREATE TABLE public.review_exceptions (
  workspace_id text NOT NULL REFERENCES public.workspaces(id) ON DELETE RESTRICT,
  id text NOT NULL,
  job_row_id text,
  state text NOT NULL DEFAULT 'open',
  reason text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}',
  PRIMARY KEY (workspace_id, id),
  FOREIGN KEY (workspace_id, job_row_id) REFERENCES public.job_rows(workspace_id, id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX review_exceptions_workspace_created_idx ON public.review_exceptions (workspace_id, created_at DESC);

CREATE TABLE public.usage_periods (
  workspace_id text NOT NULL REFERENCES public.workspaces(id) ON DELETE RESTRICT,
  period text NOT NULL,
  inquiries bigint NOT NULL DEFAULT 0 CHECK (inquiries >= 0),
  used bigint NOT NULL DEFAULT 0 CHECK (used >= 0),
  reserved bigint NOT NULL DEFAULT 0 CHECK (reserved >= 0),
  active_jobs integer NOT NULL DEFAULT 0 CHECK (active_jobs >= 0),
  PRIMARY KEY (workspace_id, period),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX usage_periods_workspace_created_idx ON public.usage_periods (workspace_id, created_at DESC);

CREATE TABLE public.usage_reservations (
  workspace_id text NOT NULL REFERENCES public.workspaces(id) ON DELETE RESTRICT,
  id text NOT NULL,
  period text NOT NULL,
  idempotency_key text NOT NULL,
  payload_hash text NOT NULL,
  inquiries bigint NOT NULL DEFAULT 0 CHECK (inquiries >= 0),
  credits bigint NOT NULL DEFAULT 0 CHECK (credits >= 0),
  state text NOT NULL CHECK (state IN ('reserved', 'committed', 'released')),
  PRIMARY KEY (workspace_id, id),
  UNIQUE (workspace_id, idempotency_key),
  FOREIGN KEY (workspace_id, period) REFERENCES public.usage_periods(workspace_id, period),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX usage_reservations_workspace_created_idx ON public.usage_reservations (workspace_id, created_at DESC);

CREATE TABLE public.subscriptions (
  workspace_id text NOT NULL REFERENCES public.workspaces(id) ON DELETE RESTRICT,
  plan text NOT NULL DEFAULT 'trial' CHECK (plan IN ('trial', 'starter', 'growth')),
  status text NOT NULL DEFAULT 'trialing',
  period_start timestamptz NOT NULL DEFAULT now(),
  period_end timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  entitlement text NOT NULL DEFAULT 'free' CHECK (entitlement IN ('free', 'full')),
  PRIMARY KEY (workspace_id),
  CHECK (period_end >= period_start),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX subscriptions_workspace_created_idx ON public.subscriptions (workspace_id, created_at DESC);

CREATE TABLE public.api_keys (
  workspace_id text NOT NULL REFERENCES public.workspaces(id) ON DELETE RESTRICT,
  id text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  masked text NOT NULL,
  revoked_at timestamptz,
  PRIMARY KEY (workspace_id, id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX api_keys_workspace_created_idx ON public.api_keys (workspace_id, created_at DESC);

CREATE TABLE public.connector_credentials (
  workspace_id text NOT NULL REFERENCES public.workspaces(id) ON DELETE RESTRICT,
  connector_id text NOT NULL,
  secret_reference text NOT NULL,
  PRIMARY KEY (workspace_id, connector_id),
  FOREIGN KEY (workspace_id, connector_id) REFERENCES public.connectors(workspace_id, id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX connector_credentials_workspace_created_idx ON public.connector_credentials (workspace_id, created_at DESC);

CREATE TABLE public.billing_bindings (
  workspace_id text NOT NULL REFERENCES public.workspaces(id) ON DELETE RESTRICT,
  provider text NOT NULL,
  provider_subscription_id text NOT NULL,
  PRIMARY KEY (workspace_id, provider, provider_subscription_id),
  UNIQUE (provider, provider_subscription_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX billing_bindings_workspace_created_idx ON public.billing_bindings (workspace_id, created_at DESC);

CREATE TABLE public.webhook_receipts (
  workspace_id text NOT NULL REFERENCES public.workspaces(id) ON DELETE RESTRICT,
  provider text NOT NULL,
  event_id text NOT NULL,
  payload_hash text NOT NULL,
  processed_at timestamptz,
  PRIMARY KEY (workspace_id, provider, event_id),
  UNIQUE (provider, event_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX webhook_receipts_workspace_created_idx ON public.webhook_receipts (workspace_id, created_at DESC);

CREATE TABLE public.outbox (
  workspace_id text NOT NULL REFERENCES public.workspaces(id) ON DELETE RESTRICT,
  id text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  dedupe_key text NOT NULL,
  state text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at timestamptz NOT NULL DEFAULT now(),
  lease_until timestamptz,
  PRIMARY KEY (workspace_id, id),
  UNIQUE (workspace_id, dedupe_key),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX outbox_workspace_created_idx ON public.outbox (workspace_id, created_at DESC);

CREATE TABLE public.feedback (
  workspace_id text NOT NULL REFERENCES public.workspaces(id) ON DELETE RESTRICT,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('widget', 'survey')),
  category text CHECK (category IN ('bug', 'feature', 'question', 'general')),
  survey_context text CHECK (survey_context IN ('form_submission', 'onboarding_complete', 'key_generated')),
  rating integer CHECK (rating BETWEEN 1 AND 5),
  message text NOT NULL CHECK (length(message) <= 4000),
  page text NOT NULL DEFAULT '/' CHECK (length(page) <= 300),
  PRIMARY KEY (workspace_id, id),
  CHECK ((type = 'widget' AND category IS NOT NULL AND length(trim(message)) > 0) OR (type = 'survey' AND survey_context IS NOT NULL AND rating IS NOT NULL)),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX feedback_workspace_created_idx ON public.feedback (workspace_id, created_at DESC);
