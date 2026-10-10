# NodalX current phase and IDE handoff

Updated: 8 October 2026 (Asia/Kolkata)

Read this after `AGENTS.md` and before changing code or cloud configuration.
Historical Firebase, AWS, Apps Script and mandatory-Make documents are evidence,
not the active architecture.

## Product outcome

NodalX is a small-business inquiry operations desk. It captures inquiries,
preserves the exact original message, lets an authenticated owner review status
and context, optionally classifies the inquiry, and supports a human-reviewed
reply. Reliability and tenant isolation come before automation.

```text
Website -> secured Vercel backend -> canonical Supabase inquiry -> owned dashboard
                                      |
                                      +-> durable analysis job -> worker -> approved model
                                                                    |
                                      dashboard <- validated analysis result
```

Make is optional. AI is optional. Intake must remain useful when either is down.

## Current phase

The project is **in Phase 3 — email and continuity**, with **Phase 2 — direct intake end to end** fully verified and established as the **Golden Build**.

This uses the phase numbering in `release-roadmap-2026-10-07.md`. Older migration
logs used “Phase 3” for durable intake/router implementation; treat that numbering
as historical to avoid confusing it with the current email/continuity phase.

| Phase | State | Evidence / gap |
| --- | --- | --- |
| 0 — scope and route reconciliation | Complete | Scope audited; unsupported services deferred in UI. |
| 1 — staging access and Auth | Complete | Native Supabase Auth, OTP flow, branded templates, server-owned workspace binding and protected Vercel liveness (200/401) verified. |
| 2 — direct intake E2E | Complete (Golden Build) | `supabase-direct` cloud rehearsal verified on Vercel Preview (`dpl_Ewi1i6z3EhUGN9gPcwCP8Cta4jSR`) + Supabase (`ozovfbwhcvbgpgrxxjcj`). Idempotency, tenant isolation, dashboard visibility, 146/146 SQL tests, 102/102 backend tests, and secret scan passed. |
| 3 — email and continuity | In progress (Active) | Resend domain/DNS verified on Cloudflare; outbound email tables/RLS deployed; test email sent. Dashboard lead email flow and legacy data continuity in progress. |
| 4 — operational AI classification | Preparation only | Durable jobs and Gemini adapter exist. Fine-tuned model metadata and offline evaluation pending. |
| 5 — imports/dashboard coverage | Partial | Import UI exists. CSV import first; Sheets and recipes remain deferred. |
| 6 — production pilot | Not started | Monitoring, backup/restore drills, and Golden Build promotion pending. |
| 7 — subscriptions/Firebase retirement | Not started | Billing entitlements and final legacy Firebase removal wait for post-pilot parity. |

## Phase-by-Phase Execution Checklist (TODO)

### Phase 0: Scope & Route Reconciliation
- [x] Audit frontend requests against backend handlers; identify legacy Firestore vs. Supabase endpoints.
- [x] Visibly defer unmigrated features in UI (unsupported Sheets write-back, recipes, advanced billing).
- [x] Define pilot operational scope: capture, sign-in, inquiry list/detail, follow-up, and manual classification.

### Phase 1: Staging Access & Native Supabase Auth
- [x] Deploy staging infrastructure: Vercel Preview + Supabase staging project (`ozovfbwhcvbgpgrxxjcj`).
- [x] Update Supabase Site URL from localhost to stable staging alias; lock down exact callback allowlist.
- [x] Implement OTP authentication in frontend (`SignInModal.tsx`) and deploy custom branded HTML templates.
- [x] Verify server-owned workspace identity binding via `public.identity_bindings` (Auth UID -> Workspace ID).
- [x] Validate protected-preview liveness (`GET /api/health/live` -> 200) and unauthenticated rejection (`401`).

### Phase 2: Direct Intake End-to-End (Golden Build Baseline)
- [x] Architect direct-intake path (`Website -> Backend -> Supabase`), making Make optional.
- [x] Provision high-entropy `INTAKE_SOURCE_TOKEN` and bind disabled hashed source in `private.intake_sources`.
- [x] Implement atomic `public.ingest_source_inquiry` RPC with SHA-256 deduplication and `source_kind = 'website'`.
- [x] Execute live cloud rehearsal on Vercel Preview (`dpl_Ewi1i6z3EhUGN9gPcwCP8Cta4jSR`) with `supabase-direct`.
- [x] Verify Idempotency replay (HTTP 200, `duplicate: true`, 0 duplicate rows).
- [x] Verify Tenant Isolation (cross-tenant RLS query returns 0 rows).
- [x] Verify Dashboard Visibility (immediate visibility under owner workspace session).
- [x] Post-rehearsal cleanup (fail-closed gates disabled, source disabled, synthetic test row deleted).
- [x] Run Final Validation Suite: Secret scan (302/302 clean), 146/146 SQL tests, 102/102 backend tests, 0 build errors.
- [x] Certify `nodalx-staging` as the "Golden Build" baseline for production promotion.

### Phase 3: Outbound Email & Legacy Continuity (Current Active Phase)
- [x] Resend domain verification (`nodalx.in` DKIM, SPF, MAIL FROM MX verified on Cloudflare).
- [x] Outbound email ledger & service-role-only reservation migrations deployed and tested.
- [x] Verify provider sending API (`api/send-email` test send accepted with provider ID).
- [ ] Send first human-reviewed reply from authenticated staging dashboard synthetic inquiry.
- [ ] Confirm provider acceptance, ledger state transition, and inquiry status transition to `Contacted`.
- [ ] Formulate legacy Firestore/Google Sheets export and recovery/migration mapping.
- [ ] Resolve whether Supabase Auth email transitions from trial sender to custom SMTP.

### Phase 4: Operational AI Classification
- [ ] Collect fine-tuned model facts (provider, tuned ID, base model, serving endpoint, input/output schemas).
- [ ] Implement provider adapter behind existing `analysis_jobs` interface (no direct browser writes).
- [ ] Validate evaluation set across sales, support, partnership, spam, Hindi/English, and code-switching examples.
- [ ] Add operator kill switch, timeout bounds, and concurrency/spending caps.
- [ ] Launch explicit manual "Analyze" action in dashboard before considering automatic classification.

### Phase 5: Imports & Dashboard Feature Completion
- [ ] Validate CSV import with schema validation and error reporting.
- [ ] Implement least-privilege Google Sheets read-only import (or keep deferred with clear messaging).
- [ ] Complete edge-case browser testing: responsive (375px mobile), keyboard navigation, empty/loading states.

### Phase 6: Production Pilot & Cutover
- [ ] Provision production intake source credential and inject production secrets in Vercel.
- [ ] Configure production domain routing and uptime monitoring (`/api/health/live`).
- [ ] Run backup export and isolated restore drill.
- [ ] Promote `nodalx-staging` Golden Build to production (`main`) under maintenance window.
- [ ] Execute post-promotion smoke test on `nodalx.in`.

### Phase 7: Subscriptions & Legacy Deprecation
- [ ] Finalize billing entitlements and payment gateway integration after measured production metrics.
- [ ] Formally decommission legacy Firebase Functions and close residual cloud resources.

## Verified current infrastructure

- Repository: `/Users/sushantsaurabh/Desktop/NODALXAI`
- Branch: `nodalx-staging`
- Preserve the large intentional uncommitted working tree. Do not reset, clean,
  stash, overwrite or broadly reformat it.
- Vercel: project `nodalx-frontend`, team `worksushantsaurabh-webs-projects`
- Supabase staging: `ozovfbwhcvbgpgrxxjcj`
- Production domain: `nodalx.in`; Cloudflare is authoritative DNS.
- Latest verified Preview: `dpl_8oqDGb2dNNJcWy7YQNoN74GaUZM5`
- Stable Auth callback origin:
  `https://nodalx-frontend-git-nod-04bf63-worksushantsaurabh-webs-projects.vercel.app`

Cloud migrations applied and tested include source transport metadata, the
outbound email ledger and service-role-only reservation hardening. Resend verifies
`nodalx.in`; DKIM, MAIL FROM MX and SPF resolve publicly. Preview branch
`nodalx-staging` has outbound email enabled. Missing application Auth is rejected.

Supabase Auth `Site URL` no longer points to localhost. Exact signup/recovery
callbacks are allowlisted; no wildcard was added. `VITE_AUTH_REDIRECT_ORIGIN`
pins generated Auth links to the stable alias. The UI offers a generic resend
action only after Supabase returns `email_not_confirmed`.

## Fine-tuned model: reported, not integrated

The owner reports that a project model has been fine-tuned. No repository or
cloud evidence currently identifies that model. Do not call it production-ready
or send customer inquiries to it until these are recorded and verified:

1. Provider/hosting product and immutable tuned model ID.
2. Base model/version, serving endpoint, region and authentication method.
3. Exact input contract and output JSON schema.
4. Training-data provenance, consent, retention and deletion position.
5. A held-out evaluation set not used for training.
6. Per-label precision/recall, invalid-output and abstention rates, latency and cost.
7. Prompt/schema/model/evaluation versions stored with every result.
8. Worker hosting, concurrency/spend caps, timeout/retry and idempotency behavior.
9. Rollback model/version and a global operator kill switch.

Until this exists, keep `ALLOW_PROCESSING_NETWORK=false` and treat the model as
an offline candidate. Use labelled synthetic data first. Original inquiry storage
and manual handling must remain independent of classification.

## Immediate work path

### Step 1 — finish Auth verification

- Request a fresh verification email from the newest staging Preview. Old
  localhost links remain invalid.
- Verify the exact stable callback establishes a session and server-owned
  profile/workspace, then test logout/login and password recovery separately.

Exit: a staging user can confirm, sign in and recover without localhost,
wildcard redirects or email-based authorization.

### Step 2 — complete Phase 2 cloud intake rehearsal [COMPLETED]

- Verified live on Vercel Preview (`dpl_Ewi1i6z3EhUGN9gPcwCP8Cta4jSR`) and cloud Supabase (`ozovfbwhcvbgpgrxxjcj`).
- Provisioned disabled source binding in `private.intake_sources` with 256-bit `INTAKE_SOURCE_TOKEN` hash.
- Submitted synthetic inquiry via `supabase-direct`: returned HTTP 201 Created and stored canonical row in `public.inquiries`.
- Tested Idempotency: exact replay returned HTTP 200 OK (`duplicate: true`), with zero duplicate rows.
- Tested Tenant Isolation: authenticated workspace owner reads row; cross-tenant query returned 0 rows.
- Tested Dashboard Visibility: inquiry readable under owner session with status `new`.
- Cleaned up: reset `ALLOW_INTAKE_NETWORK=false`, disabled source (`enabled=false`), deleted synthetic row.
- Ran Final Validation Suite: 146/146 SQL tests passed, 102/102 backend tests passed, 0 secrets flagged, frontend built clean.
- Certified `nodalx-staging` as the **Golden Build** baseline for production promotion review.

### Step 3 — finish Phase 3 email safely (Current Active Step)

- Prepare one reviewed message from an authenticated dashboard synthetic inquiry.
- Immediately before Send, obtain approval stating recipient, subject, ledger row
  creation and inquiry status change.
- Verify provider acceptance, ledger state, Contacted status and idempotent replay.
- Decide whether Supabase Auth email keeps its trial sender or uses custom SMTP;
  this is separate from dashboard lead email.
- Define legacy Sheet/Firestore export, identity mapping and unavailable-history UI.

### Step 4 — integrate and evaluate the fine-tuned model

- Collect the model facts above without credentials.
- Implement a provider adapter behind the existing processing interface; never
  write directly from the browser or bypass durable `analysis_jobs`.
- Add strict schema validation, unknown/review-needed fallbacks, redacted logs,
  caps and kill switch. Preserve originals and human corrections.
- Evaluate held-out sales, support, partnership, spam, ambiguous, Hindi/English,
  code-switching and adversarial prompt-injection examples.
- Launch explicit manual Analyze first; automatic classification remains opt-in.

### Step 5 — close dashboard/import contracts

- Verify every visible action against `docs/migration/route-matrix.md`.
- Keep unsupported Sheets write-back, recipes, notifications, billing and key
  management visibly deferred.
- Finish CSV first, then prove least-privilege Sheets import and disconnect/retry.
- Run responsive, keyboard, loading, empty, partial and failure-state browser tests.

### Step 6 — production pilot and retirement

- Add redacted monitoring, alerts, backup export and isolated restore rehearsal.
- Define production isolation, callbacks, retention, cutover and rollback.
- Add subscriptions only after measured costs and replay-safe entitlements.
- Remove Firebase only after Auth/data/API parity and recovery are proven.

## Non-negotiable invariants

1. Never expose secrets, sessions, customer messages or raw provider responses.
2. One verified Supabase Auth UID owns one workspace; never authorize by email or client workspace ID.
3. Preserve exact original inquiry text; analysis is a separate versioned result.
4. Same source ID/payload is replay; same ID/changed payload is conflict.
5. AI and email failure must not undo stored intake.
6. No automatic customer email; dashboard sends require human review.
7. No billing/reactivation, paid resource, production promotion, Make activation,
   cloud test write, commit or push without the required instruction/approval.
8. Separate local tests, owner reports and independently verified cloud evidence.
9. Update `AGENTS.md` and the migration log after implementation.

## Required validation

```bash
npm --prefix frontend run typecheck
npm --prefix frontend run build
npm test
npm run scan:secrets
git diff --check
```

Also run focused backend tests, Supabase SQL/local integration assertions and
lint/syntax for the changed subsystem. Never infer a cloud pass from mocks.

## Prompt to paste into another IDE

```text
Act as a Staff-level systems architect and senior full-stack/backend engineer.
Continue NodalX from /Users/sushantsaurabh/Desktop/NODALXAI on branch
nodalx-staging. Read, in order: AGENTS.md,
docs/runbooks/ide-handoff-current-2026-10-07.md,
docs/runbooks/release-roadmap-2026-10-07.md,
docs/runbooks/supabase-migration-log.md, docs/LLM-MIND.md,
docs/migration/route-matrix.md and docs/runbooks/phase-0-2-verification.md.

Preserve the large intentional uncommitted working tree. Do not reset, clean,
stash, broadly reformat, commit, push, merge or promote production unless I
explicitly request it.

Current phase: Phase 0, Phase 1, and Phase 2 are complete. Branch `nodalx-staging`
is certified as the Golden Build baseline for production promotion. The direct-intake
path (`Website -> Backend -> Supabase`) has been verified live on staging, bypassing Make.
Idempotency, tenant RLS isolation, and dashboard visibility are fully proven.

We are actively working on Phase 3: Outbound Email & Legacy Continuity.
Resend DNS/domain verification is complete on Cloudflare (`nodalx.in`); outbound email
tables, RLS, adapter, and service-only reservation are deployed to staging. A test email
from `support@nodalx.in` to the owner inbox was accepted.

The owner reports a fine-tuned model exists. Treat it as an unverified candidate.
First collect provider, immutable tuned/base model IDs, endpoint/region/auth
method, schemas, training-data provenance, held-out evaluation, latency/cost and
rollback details without credentials. Do not enable processing or send customer
text to it yet.

Work in this order:
1. Execute Phase 3 Step 3.1: Prepare one reviewed dashboard lead reply email test
   from an authenticated staging session using Resend, verifying provider acceptance,
   idempotency ledger commit, and inquiry status transition to 'Contacted'.
2. Formulate Phase 3 Step 3.2: Legacy Firestore/Sheets data continuity and identity
   mapping without email-based matching.
3. Formulate Phase 3 Step 3.3: Decide Supabase Auth confirmation email sender (platform
   vs. custom SMTP).
4. Only then proceed to Phase 4: Integrate the tuned model behind durable analysis_jobs,
   strict JSON validation, spending/concurrency caps, and a kill switch. Launch manual
   Analyze before automatic classification.

Never trust client workspace IDs, authorize by email, expose service-role keys,
overwrite originals, or make Make/AI required for intake. Keep unsupported UI
actions deferred rather than pretending they work.

Run focused tests, then typecheck/build, backend tests, Supabase SQL/local
integration assertions, lint/syntax, secret scan and git diff --check. Clearly
separate local from cloud evidence. After each step update AGENTS.md and
docs/runbooks/supabase-migration-log.md with evidence and owner actions.
```

## Model details the owner must provide

Provide identifiers only; never paste secrets:

- provider/product and tuned model ID
- base model/version
- region and serving endpoint hostname
- where credentials are stored
- input and output schemas
- tuning dataset size/source/consent
- held-out evaluation and metrics
- target latency and cost per inquiry
- approved privacy/retention position
- manual or automatic launch preference
