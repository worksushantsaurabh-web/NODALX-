# Live processing rollout

Started 6 October 2026. Updated 10 October for the RDS target. Live activation
is pending, not completed.

The application database is now AWS RDS `nodalx_app`; Supabase remains the Auth
identity provider. The supervised worker supports `DATA_BACKEND=rds` with a
server-only `RDS_DATABASE_URL`. The packaged worker now includes its RDS client
and the pinned AWS RDS CA bundle. No worker host or processor has been activated.

## Phase A — Deployment readiness (locally implemented; not deployed)

- Add a supervised polling consumer rather than depending on a browser request or laptop.
- Require recent worker heartbeats for availability; keep the operator enable gate separate.
- Add safe cloud configuration, shutdown handling, bounded retries and redacted health output.
- Validate with synthetic local data, quota races, failed-provider and worker-loss tests.
- Keep customer processing disabled until both the operator gate and worker readiness pass.

## Phase B — Approve processor and hosting (owner input needed)

Owner selected a direct Google API. The prepared adapter uses Gemini Developer API,
not Vertex AI or the suspended Firebase project. The owner has no cloud Supabase
project or worker hosting account yet. No accounts or paid resources were created.

Google's [unpaid-service terms](https://ai.google.dev/gemini-api/terms) say not to submit
personal, sensitive or confidential information. Use synthetic fixtures only for an
unpaid staging rehearsal. Customer inquiries require reviewed privacy terms, an
approved eligible paid project and explicit billing/data-transmission approval.
Do not enable Google Cloud billing while the existing dispute remains unresolved.


- Processor selected: direct Google Gemini Developer API; exact model remains pending.
- Confirm synchronous results versus a signed asynchronous callback contract.
- Approve exactly which customer fields are sent, destination, retention and cost ceiling.
- Confirm cloud Supabase project/region and the supervised worker hosting account.
- Store privileged database and processor credentials in server-only secret stores.
- Review per-provider idempotency: database replay protection cannot prevent external charges
  if the provider does not honor the stable job key.

## Phase C — Staging release and verification (pending)

- Apply migrations to an approved staging project, with backup and restore rehearsal.
- Deploy Vercel API/frontend and the worker using separate reviewed deployment boundaries.
- Verify service authentication, fresh/stale heartbeats, tenant denial, limits, job completion,
  result provenance, privacy controls, provider timeout and duplicate/replayed delivery.
- Use synthetic inquiries first. A production Sheet inquiry/email test needs specific approval.
- Configure monitoring and a restart supervisor; verify failure disables new enqueue requests.

## Phase D — Live activation (pending)

- Confirm existing-user continuity, source sync and rollback; do not strand Firebase users.
- Obtain release approval and verify the actual custom domain and API deployment.
- Start the supervised consumer, confirm provider smoke test, then enable queueing.
- Monitor oldest queued work, failed rows, reserved credits and heartbeat freshness.
- Roll back by disabling queueing first, then drain or preserve outstanding durable leases.

## Boundaries

No paid resources, provider calls with customer data, GitHub push, production database
migrations or production activation have been performed by this phase document.
Do not enable processing merely because a build passes. Do not deploy the worker as
a long-running Vercel request handler. Hosting, Gemini model, cost and customer-data
approval remain pending despite the selected Google provider.

## Prepared worker runtime

- `scripts/start-cloud-processing-worker.mjs` starts a supervised polling loop. A
  hosting process supervisor must restart it; the script alone is not deployed hosting.
- Heartbeat is refreshed every 15 seconds, including while a job is running. A worker
  unseen for 60 seconds no longer permits new enqueue requests. An operator pause
  remains authoritative even when healthy workers exist.
- Provider failure causes a 60-second cooldown and an unavailable heartbeat. There
  are no hidden immediate Gemini retries. Database failure prevents claims; shutdown
  clears readiness and leaves interrupted reservations for fenced lease recovery.
- Authenticated health exposes only enabled/workerReady/available booleans, not keys,
  customer data, worker IDs or original messages.
- Gemini sends only message and qualification criteria, not separate name/email/company
  fields. The original message itself can contain personal information; this is data
  minimization, not anonymization or consent. No tools, link fetching or autonomous
  sending are enabled. Outputs remain tentative human-review classifications.
- The adapter follows Google's documented [structured Generate Content contract](https://ai.google.dev/gemini-api/docs/generate-content/structured-output).
  This endpoint is labelled legacy in current documentation; a staging model/version
  compatibility check is required before activation. No live compatibility is claimed.
- Input limits: 12,000 message characters and 4,000 criteria characters; output limit:
  1024 model tokens and a 32 KiB response. Truncated/blocked/invalid results fail safely.
- Gemini does not have a verified exactly-once billing guarantee in this implementation.
  Reclaimed jobs can repeat a paid generation after a crash. Owner acceptance, budgets
  and monitoring must cover this; database credits still commit at most once per job.

### Server-only settings

| Key | Requirement |
|---|---|
| `PROCESSING_ENVIRONMENT` | `staging` or `production`, never inferred |
| `DATA_BACKEND` | `rds` for the current app-data target |
| `RDS_DATABASE_URL` | Server-only RDS connection URL; required for RDS worker mode |
| `SUPABASE_URL` | Legacy cloud-database worker mode only |
| `SUPABASE_SERVICE_ROLE_KEY` | Legacy cloud-database worker mode only; never browser/Vercel frontend |
| `ALLOW_PROCESSING_NETWORK` | `true` only after approval |
| `PROCESSING_PROVIDER` | `gemini` |
| `GEMINI_API_KEY` | Eligible project key, server-only |
| `GEMINI_MODEL` | Explicit reviewed model supporting the configured JSON contract |
| `GEMINI_DATA_APPROVAL` | `synthetic-only` for isolated staging, or `approved-customer` |
| `GEMINI_PAID_PROJECT_APPROVED` | `true` required for production customer processing |

These flags record an operator's approvals; they do not verify provider billing or
privacy compliance automatically. Production requires external account checks, cost
ceiling and alert configuration before setting the flags. No secret values belong here.

### Packaging without uploading the full repository

Run `node scripts/package-processing-worker.mjs`. It stages only reviewed worker
files, manifests and Dockerfile into a temporary build context. No `.env`, frontend,
customer exports or legacy Firebase files are included. Build that staged context,
not the entire desktop folder. The Dockerfile runs the worker as a non-root user.
No image build, push, hosting purchase or cloud deployment is implied by packaging.

### Owner actions before Phase C

1. Use the existing RDS `nodalx_app` application database and hosted Supabase Auth.
   Put the worker's RDS URL in a private host secret store; do not send it in chat.
2. Choose a supervised Node worker host and approve its actual budget. No hosting
   provider has been chosen or provisioned, and no recurring job is scheduled yet.
3. Confirm Gemini account eligibility despite the suspended Google project. Keep unpaid
   testing synthetic; paid billing is a separate approval gate, not an automatic step.
4. Configure secrets in provider dashboards, then authorize an isolated staging
   rehearsal against the reviewed RDS schema. Keep the operator processing gate
   disabled in production.
5. Approve one synthetic provider smoke test. Only after it passes, revisit customer-data
   privacy, existing-user continuity, intake/source sync, rollback and production release.
