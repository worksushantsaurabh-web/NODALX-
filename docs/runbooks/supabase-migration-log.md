# Supabase Migration Log

## Phase 0: Baseline
- **Status:** Complete.
- **Notes:** All tests passed (intake, frontend, functions). Typecheck, build, lint, and secret scan passed.

## Phase 1: Audit and safe seams
- **Status:** Complete.
- **Notes:**
  - Route matrix documented in `docs/migration/route-matrix.md`.
  - Client writes documented in `docs/migration/client-writes.md`.
  - Created provider-neutral `SessionProvider` in `frontend/lib/session/` with a temporary Firebase adapter.
  - Migrated `AuthContext`, `api.ts`, `NotificationSettings.tsx`, `GoogleSheetsModal.tsx`, `DataConnectors.tsx`, and `ImportWorkspace.tsx` to the session seam.
  - Removed `firebase/analytics` dependency; kept event helpers behind an optional sink.
  - Added unit tests for the session seam and analytics consent (verifying false-identity rejection).
  - All tests and builds pass.
- **Remaining Firebase Uses:**
  - `SignInModal`, `OnboardingModal` (auth UI).
  - Firestore direct writes (Feedback, MicroSurvey, SignInModal).
  - `vertex-ai-proxy-interceptor.js` (legacy window token getter).
  - Functions, Admin SDK, and Firebase backend.

## Local continuation — Phase 2 and Phase 3 (5 October 2026)

- Preserved the four existing versioned migrations and the initialized local stack.
  Local SQL security tests passed: **33 assertions**. No cloud resources provisioned.
- Added a fifth versioned migration for durable profile mutation limits (20/minute),
  with safe HTTP 429 mapping and a real local integration assertion.
- Supabase session adapter is registered; deferred identity verification runs outside
  the SDK auth callback, with revision checks preventing stale identity publication.
- Completed email/password sign-in and signup, confirmation callback, recovery
  callback with password update, and shared Google OAuth initiation.
- SignInModal no longer writes Firestore profiles. The authenticated profile API
  bootstraps a server-owned binding after confirmed login, and updates only allowed fields.
- FeedbackWidget and MicroSurvey now POST to `/api/feedback` and show failure rather
  than claiming persistence when unavailable. Feedback currently requires login.
- Existing Firebase workspaces are not linked by email or user-editable metadata.
  This is a **local new-user rehearsal**, not an existing-user cutover.
- Firebase packages, adapter, recovery configuration and legacy API remain retained.

### Evidence

- `./node_modules/.bin/supabase test db`: 33 assertions passed.
- `TEST_LOCAL_SUPABASE=true node --test tests/supabase-account.local.test.mjs`:
  real local Auth/database and backend-handler rehearsal; synthetic accounts only.
  Covers confirmed signup, profile updates, forbidden fields, feedback, foreign
  workspace denial, missing/forged tokens, refresh, recovery and logout.
- Frontend tests: 39 passed, including stale Supabase session rejection.
- Frontend production build/typecheck passed.
- Intake suite: 40 passed; optional local integration test skipped in that command
  and executed separately with its local-only opt-in.
- Functions lint and unit tests passed (38 tests).
- Working-tree secret scan and `git diff --check` passed.

### Local setup and remaining gates

- Local frontend: set ignored `VITE_SUPABASE_URL` and
  `VITE_SUPABASE_PUBLISHABLE_KEY` from the local CLI status, then restart Vite.
- Local account API: supply `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` to
  `node scripts/dev-supabase-api.mjs` (binds to 127.0.0.1:5000). Use the Vite
  development proxy. Never use a service-role key in frontend configuration.
- Confirmation/recovery mail stays in local Mailpit at 127.0.0.1:54324.
  Synthetic integration tests generate verification links locally and send no emails.
- Google OAuth requires approved credentials and exact callback allowlists;
  `VITE_SUPABASE_GOOGLE_ENABLED=true` is only appropriate after configuration.
  SMS is disabled and has no approved provider. Neither flow is live-verified.
- Run local integration tests only against disposable local data: each run leaves
  synthetic users/workspaces. Database resets delete local records.
- Not checked: rendered browser/cross-tab UI flows, real Google OAuth, SMS,
  migrated Firebase accounts, production/staging deployment and live intake/email.
  Legacy WebSocket auth testing is outside this change and was not rerun.
- Phase 2's queue/usage transaction implementations and privileged API parity beyond
  these account routes remain future endpoint work; schema alone does not implement them.
- Phase 4 must update Vercel routing and deployment allowlists for these handlers.
  Most dashboard endpoints still depend on Firebase and cannot consume Supabase tokens.
  Phase 3's full exit gate remains pending browser rehearsal and existing-user continuity.

## Repair continuation — functional local inquiry desk (5 October 2026)

This section supersedes the older local setup and dashboard-routing blockers above.
This is still a local rehearsal, not a production cutover or full Firebase retirement.

### Repairs implemented

- Added migration `20261005000600_inquiry_desk.sql`: tenant-owned settings and
  activity, atomic status/note/follow-up updates, original-message preservation,
  durable 60/minute mutation limits and owner-scoped overview aggregates.
- Added authenticated Supabase dashboard handlers for inquiry pagination, status,
  activity, notes, follow-up, qualification criteria, overview, usage, plan catalogue
  and entitlement. Identity comes from verified Auth bindings, not request workspace IDs.
- Corrected Vercel's root configuration and deployment allowlist to bundle the new
  handlers instead of sending Supabase tokens to suspended Firebase APIs. Public
  `/api/contact` remains the existing Apps Script intake. Removed the conflicting
  `frontend/vercel.json`; deployment must use the repository root, not `frontend`.
  Root production dependencies and frontend build dependencies install separately.
  Routing follows the [Vercel rewrite configuration](https://vercel.com/docs/routing/rewrites).
  Configuration is checked locally; no Vercel deployment was performed.
- Unsupported authenticated endpoints return `503 MIGRATION_PENDING` and perform
  no processing, billing or connector actions. Readiness explicitly reports `partial`.
- Added `npm run dev:supabase`: derives only local public configuration from the CLI,
  supplies it to both services, binds the API to loopback and avoids saving secrets.
  Docker Desktop's CLI path and local CLI telemetry restrictions are handled.
- Hardened expired/refreshed token handling against logout and identity-change races,
  fail-closed invalid Auth configuration and late API responses after account switches.
- Early access now offers email login rather than only unavailable Google OAuth.
  Unconfigured Google buttons are disabled; trial/starter/growth labels are accurate.
- The desk visibly explains that the owner's public intake Sheet is not yet synced
  to a workspace. Unconfigured analysis cannot be launched or falsely queue credits.

### Current verification

- Database tests: **45 assertions** passed across tenant-security and inquiry-desk tests.
- Real local Auth/API integration passed: verified login, profile/feedback, token refresh,
  recovery/logout, two-tenant denial, protected-field rejection, profile rate limiting,
  inquiry pagination/foreign cursors, status/activity, notes/follow-up, settings,
  overview, usage and disabled checkout. All records are synthetic local fixtures.
- Frontend unit tests: **43 passed**; production build and typecheck passed.
- Intake and routing tests: **43 passed**, with the optional local integration skipped
  in that command and run separately. Legacy Functions unit tests: **38 passed**;
  Functions lint passed. Working-tree secret scan and whitespace checks passed.
- Browser rehearsal: email login, session persistence after reload, empty overview,
  inquiry list and original detail, status update, note saving and activity were checked
  against local synthetic data. No real customer inquiry or external email was sent.
  Saved status and notes survived reload. The desk showed the Sheet-sync notice and
  disabled unconfigured analysis. Desktop (1440px) and mobile (390px) checks found
  no horizontal document overflow; this is not an exhaustive visual audit of every view.
  This does not verify real Google OAuth, cross-tab logout or existing Firebase accounts.

### Restart locally

1. Start Docker Desktop. From the repository root, start the local stack with
   `SUPABASE_TELEMETRY_DISABLED=1 npx supabase start` (Docker's CLI must be on PATH).
2. Apply pending migrations with `SUPABASE_TELEMETRY_DISABLED=1 npx supabase migration up --local`.
3. Run `npm run dev:supabase`, then open `http://127.0.0.1:5173`.
4. Run `npm run test:supabase` and `npm run test:supabase:account` for the disposable
   local environment. Repeated integration runs leave synthetic accounts/workspaces.
   Do not reset a database containing wanted records.

### Remaining release gates, in dependency order

1. Implement transactional queue/usage reservations, processing workers and result
   persistence before enabling inquiry analysis, file imports, recipes or automation.
2. Implement ownership-verified Sheets connections and resumable synchronization.
   The public website intake Sheet is not automatically a tenant's inquiry database.
3. Migrate API keys, integrations, notification preferences and connector operations
   with tenant authorization, encrypted secrets and idempotent webhook handling.
4. Replace billing checkout/invoices/cancellation and signed Razorpay webhooks;
   test entitlement updates and replay protection before accepting any payment.
5. Design and rehearse verified legacy identity/data migration without email linking;
   test existing-user continuity and rollback before replacing production authentication.
6. Configure an approved Supabase cloud project and OAuth callback allowlists only
   after explicit approval. Local database keys are not production credentials.
7. Stage the repository-root deployment, verify every route, browser/cross-tab flows,
   intake/email and rollback. Keep Firebase packages and recovery code until parity
   and cutover checks actually pass. No cloud provisioning or paid service was performed.

## Processing foundation continuation (5–6 October 2026)

- Added migrations 007 and 008 for atomic inquiry analysis queueing, stable SHA-256
  snapshots, duplicate/conflict protection, existing plan quota reservations and
  processing-slot enforcement across billing periods. SQL was tested before API changes.
- Added service-only lease claims and fenced settlement. Crashed work can be reclaimed;
  successful jobs commit one credit, failures release it, and replay cannot charge twice.
- Added analysis submission and tenant-owned job list/detail API routes. Usage now reads
  the server-owned processing gate and actual active jobs, not a fabricated readiness flag.
- Added bounded worker and approved-host HTTP adapter, plus a one-shot local runner.
  No consumer was deployed and no real processing endpoint was invoked. Processing
  remains **disabled**. The new gate is explicit operator configuration, not a heartbeat.
- Tests: **67 SQL assertions**, **9 worker unit tests**, real concurrent local queue/API
  and settlement rehearsal, and existing local Auth/API integration passed. The default
  intake/routing/worker suite has **52 passing tests**, with two local-only rehearsals
  skipped there and run independently. Frontend build/typecheck, syntax checks,
  working-tree secret scan and whitespace checks passed.
  Frontend unit tests remained **43 passing**. The bundle was built to
  `/private/tmp/nodalx-processing-build-20261006` because this task cannot overwrite
  the existing `frontend/dist`; the standard output attempt failed on filesystem
  permissions, not a code/type error. No frontend source was changed in this phase.
- Synthetic rehearsal verified six duplicate submissions create one job, changed input
  conflicts, quota races, owned results, foreign-job denial and failed-credit release.
  It restored the processing gate to disabled and sent no external emails or requests.
- Activation requirements and honest limitations are in `docs/migration/processing-worker.md`.
  Next implementation gate: private uploads, parsing/previews and batch job creation.
  Sheets sync, recipes/automation, billing, existing identities and cloud cutover remain
  open. This phase does not retire Firebase or certify production processing.

## Live rollout preparation — Phase A (6 October 2026)

- Created `docs/migration/live-processing-rollout.md` with four stages: deployment
  readiness, approved provider/accounts, staging verification and live activation.
- Owner chose a direct Google API and reports no cloud Supabase project or worker host.
  Prepared Gemini Developer API integration, not Vertex AI or suspended Firebase services.
- Added migration 009: service-only worker heartbeats and readiness. Operator enablement
  now also needs a ready worker seen within 60 seconds. Anonymous/browser users cannot
  forge readiness; authenticated health reports redacted real processing-state booleans.
- Added supervised polling consumer, independent heartbeat refresh during jobs, cooldown
  on processing errors and graceful shutdown preserving interrupted durable reservations.
- Added Gemini structured-output adapter with fixed Google host, header-only API key,
  bounded input/output, no tools or automatic API retries, redacted failures and minimized
  contact data. A fit score is omitted without qualification criteria. Model compatibility
  is not live-verified; current Google's Generate Content documentation labels it legacy.
- Production Gemini startup requires explicit customer-data and paid-project approval
  flags. Flags do not verify billing eligibility, privacy compliance or spend budgets.
  Google's unpaid terms prohibit sending personal/confidential data, so unpaid rehearsal
  must use synthetic fixtures. No billing was enabled and no Google request was sent.
- Added non-root Dockerfile and worker-only build-context packager. No image was built,
  pushed or deployed, and no full repository/environment/customer export was uploaded.
- Verification: **75 SQL assertions**, **65 intake/routing/worker tests** passed; two
  local-only tests skipped in that default suite passed independently. **43 frontend tests**,
  production build/typecheck (temporary output), syntax, secret scan and whitespace passed.
  Fixtures/mock HTTP responses are synthetic; they are not live Gemini results.
- Next: owner creates an approved cloud Supabase project, chooses supervised worker hosting,
  resolves Gemini billing/privacy eligibility without bypassing the Google dispute, and
  approves a synthetic staging deployment/test. Production migration/activation and existing
  user/source continuity remain separate release gates. Nothing was pushed or deployed.

## Make scenario repair foundation — 6 October 2026

- Reviewed the supplied blueprint without copying its exposed Gemini credential.
  Owner must rotate/revoke it and remove it from public exports/logs. No credential
  was used, tested or rotated by this implementation.
- Added disabled-by-default `/api/automation?action=claim|complete` machine API.
  Constant-time bearer verification, separate HMAC signing secret, strict bounded
  request validation, no-store responses and redacted errors. Supabase service
  credentials stay in the API, not Make. Browser/session credentials cannot claim.
- Added migration 10: private locked Make poll gate, service-only claim RPC,
  two-second global claim throttle and existing worker freshness integration.
  The existing database operator pause remains authoritative.
- Backend supplies the safely serialized/minimized structured Gemini request.
  Completion accepts the full provider envelope, eliminating Make regex parsing
  and hand-built classification JSON. Blocked/truncated/tool/invalid/blank results
  are rejected; fit scores use 0-100 and are omitted without criteria.
- Signed receipt binds server-selected ownership, job, lease, criteria and expiry.
  Existing atomic reservation and fencing rules prevent duplicate storage/charges;
  callback replay returns 409, failure releases credits, expired work recovers.
  This is not a guarantee of exactly-once provider billing.
- Added migration 11: database score bounds and replacement of prior analysis
  fields on successful reanalysis. Old unsupported scores no longer leak into
  a new result; original message and unrelated payload fields remain intact.
- Updated Vercel routing and runtime allowlist. No frontend UI files changed.
- Applied both migrations ONLY to the local database. Verification: 83 SQL
  assertions, 73 default backend tests (two opt-in local tests skipped), explicit
  local queue/Make completion integration with real PostgreSQL and synthetic
  provider envelope, frontend typecheck/build, working-tree secret scan (284
  files) and whitespace checks passed. The local processing gate was restored
  to disabled after integration testing. No Google/provider request was sent.
- Detailed account configuration, module replacement, scheduling/deadline,
  failure/replay policies and release gates are in
  `docs/migration/make-automation-setup.md`. This is NOT an import-ready scenario.
  Live Make editing, cloud Supabase provisioning/migrations, Vercel deployment,
  Gemini eligibility/model verification, key rotation and website/Sheets source
  synchronization remain outstanding. Existing Apps Script and Airtable history
  were not changed; nothing was committed, pushed, billed or activated.

## Source-of-truth Phase 2 — 6 October 2026

- Owner approved native Supabase Auth, Supabase as the target source of truth,
  and workspace/source-ID plus hash replay handling. Reused existing verified
  identity bindings and tenant RLS; no email matching or Firebase JWT adapter.
- Migration 12 adds source IDs/hashes, a unique workspace/source-ID constraint,
  private disabled-by-default connector bindings, and a service-only atomic
  ingestion RPC. Ownership comes from the credential binding, not input fields.
- Identical retries return the same ID; altered retries conflict without update.
  Repeat email/content with a new source ID remains valid. Original text and
  source ownership are immutable. Added bounded validation and 60/minute source
  rate limiting. Dropped old fingerprint uniqueness, retained legacy metadata.
- Corrected stale Apps Script test fixtures after Phase 1 moved owner email to
  Script Properties; synthetic owner address now supplied. No live email code
  changed. Updated AGENTS after implementation steps and final verification.
- Local Docker initially unavailable; owner restarted it. Applied ONLY local
  migration. 104 SQL assertions, DB lint, 24-way real concurrent REST replay,
  all three opt-in local integration tests, 73 default backend tests, Functions
  ESLint/unit tests, backend WebSocket authorization, frontend typecheck, secret
  scan (288 files) and whitespace checks passed. No UI files changed.
- Contract and remaining boundaries: `docs/migration/source-of-truth.md`.
  Public website contact still targets Apps Script and is unconfigured in this
  shell. Phase 3 router/recovery and Phase 4 deployed E2E are not complete.
  No cloud migrations, production credentials, provider/customer calls, billing,
  Firebase deployment, dependency deletion, commit or push performed.

## Durable intake Phase 3 — 6 October 2026

- Local migrations 13/14 add a private durable transport queue, credential-bound
  staging, opaque lease claims, transactional canonical completion, replay
  fencing, bounded retries, service-only operator recovery and router limits.
  The canonical inquiry remains in Supabase; original text is preserved.
- Added opt-in website and authenticated Make API handlers, provider-aware
  readiness checks and deployment packaging. Apps Script remains the default;
  fixed unsupported ContentService headers locally without redeploying it.
  No UI or new AI features were implemented.
- Verification: 128 SQL assertions and database lint, 83 default backend tests
  (four local opt-ins skipped), all four local integrations run separately,
  backend ESLint, Functions lint/38 tests and frontend typecheck passed.
  Local E2E uses a simulated Make consumer, not the live Make account.
- Owner completed Make login. Original scenario is Inactive and Shared; Clone
  requires a replacement webhook. Cancelled without creating a webhook or
  changing, duplicating, activating or executing any scenario. The delegated
  review was stopped without a deliverable; parent completed the local work.
- Remaining: cloud Supabase and approved staging API deployment/source binding,
  privately configured machine credentials, a separate disabled scheduled Make
  router, cadence/operations review, notification parity and deployed E2E.
  New mode does not send the existing Apps Script confirmation emails; do not
  silently cut over. No billing, cloud migration, commit or push performed.
  See `docs/migration/make-intake-router.md` and `intake-recovery.md`.

## Cloud staging preparation — 6 October 2026

- Owner completed Supabase signup. Created NodalX organization on the Free
  plan ($0/month); no upgrade or payment method added.
- Prepared `nodalx-staging` project form in South Asia (Mumbai): Data API on,
  automatic table exposure off, automatic RLS on. GitHub integration untouched.
- Project creation is pending private owner entry/save of a strong database
  password and submission. No secret captured or stored by the agent.
- No cloud schema migrations, credentials, Make activation or live cutover yet.

## Cloud project verified — 6 October 2026

- Owner created `nodalx-staging` (`ozovfbwhcvbgpgrxxjcj`). Dashboard verifies
  Healthy status, Mumbai region and Nano compute in the NodalX organization.
- Public API origin: `https://ozovfbwhcvbgpgrxxjcj.supabase.co` (not a secret).
- Dashboard reports no migrations and no GitHub integration. Database schema,
  Vercel connection and Make handoff remain undeployed; live intake unchanged.
- Next: owner authenticates Supabase CLI privately, then verify project target,
  review migration dry-run and apply the versioned schema to staging only.

## Staging schema deployed — 6 October 2026

- Verified CLI access and exact project `ozovfbwhcvbgpgrxxjcj`; linked workspace
  CLI to staging only. Link cache remains gitignored.
- Reviewed remote dry-run and successfully applied all 14 versioned migrations,
  including tenant RLS, private storage and durable intake/recovery RPCs.
- Skipped Vault updates; no seeds/custom roles pushed. No customer data imported,
  credentials printed, billing changed, Vercel deployment or Make activation.
- Cloud lint and up-to-date migration verification follow this step. Auth
  redirects/SMTP, server configuration and owned source bindings remain pending.

## Cloud security review and repair — 6 October 2026

- Cloud schema lint passed and migration history reconciled. Read-only catalog
  checks confirmed all 36 application tables have RLS and browser/anonymous
  roles cannot call intake staging/claim RPCs; server-only claim is permitted.
- Security advisor identified the platform-created `rls_auto_enable()` helper
  as browser executable. Added conditional migration 15 to revoke PUBLIC/anon/
  authenticated execution while preserving the automatic RLS event trigger.
- Local SQL suite passed 131 assertions across eight files. Initial fixture
  include failed because CLI test containers do not mount migration files;
  replaced it with catalog boundary tests. Applied migration 15 to staging.
- Direct cloud verification: helper browser grants are false and one automatic
  RLS event trigger remains enabled. Authenticated SECURITY DEFINER RPC advisor
  warnings remain for deliberately exposed identity-checked operations; these
  must be reviewed, not blindly revoked. No live E2E security claim is implied.
- Schema is now deployed, but website/Make flow is not cloud-connected yet.
  Auth redirects/SMTP, private Vercel secrets, owned disabled source bindings,
  staged Make setup and notification parity remain release gates.

## Vercel staging connection preparation — 6 October 2026

- Verified CLI account and linked `nodalx-frontend` project. Preview environment
  metadata currently shows legacy Firebase/App Script variables.
- Selected Supabase publishable-key metadata without printing key values or
  revealing new secret keys. Attempted Preview/main URL configuration failed
  in CLI stdin and explicit-value modes; no variable write reported success.
- Vercel dashboard is open at sign-in; owner authentication is pending. No
  preview deployment, private key entry, Make activation or Production edits.
- Added missing server `SUPABASE_PUBLISHABLE_KEY` template and the staging
  runbook with Preview/main isolation, same-origin API override, disabled gates,
  exact auth redirects, email/protection requirements and verification sequence.

## Preview branch approval and checks — 6 October 2026

- Vercel dashboard sign-in verified. It rejected Preview/main because main is
  the Production branch, and rejected Preview/nodalx-staging because that branch
  was absent from the connected Git repository. Neither attempted variable saved.
- Owner approved creating and pushing nodalx-staging with the current migration
  changes after checks; main merge/production promotion remain unauthorized.
- Frontend typecheck/build, backend 83 tests (four local opt-ins skipped),
  Functions lint/38 tests (40 gated tests skipped), working-tree secret scan of
  301 files and whitespace checks passed. No new frontend features implemented.
- Next: publish the approved branch, save its Preview-only public configuration,
  hand off private server credential entry, then verify preview deployment.
