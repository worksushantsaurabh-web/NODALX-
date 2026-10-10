# NodalX release roadmap and classification options

Updated: 7 October 2026. Planning document based on current source and recorded
verification. Cloud configuration was not freshly checked during this review.

Implementation update: Phase 0 pilot gating and route audit are implemented
locally. Phase 1 read-only cloud checks and Phase 2 direct local database E2E are
verified; owner-session and live activation checks remain. See
`phase-0-2-verification.md` for fresh evidence, exact rehearsal and pending actions.

## Target and current gap

```text
Website -> secured backend -> canonical Supabase inquiry -> authenticated dashboard
                                  |
                                  +-> analysis job -> worker -> AI provider
                                                        |
                                  dashboard <- validated result
```

Make is optional. Store the original inquiry before optional processing. An AI
outage must leave it available for manual review. The analysis job queue and
optional Make intake queue have different purposes.

The repository has direct Supabase intake, native authentication, inquiry desk
APIs, durable analysis jobs and a Gemini adapter. Several services remain outside
the migrated API: `server/supabase-workspace.mjs` returns `MIGRATION_PENDING` for
unhandled routes and reports Sheets sync and billing unavailable. Its plans return
`checkoutEnabled: false` and `price: null`. Existing UI is not proof of migrated
backend support. Firebase remains a frontend dependency.

Latest local cleanup: build/typecheck with unused-symbol checks, Functions lint,
JS syntax, 88 backend tests and secret scan passed; four local integrations were
skipped in that run. Earlier cloud/local checks remain historical evidence.
The API-only staging host is a local scaffold; deployment and actual access still
need verification. Legacy email/history continuity also remains open.

This roadmap supersedes old AWS/Firebase release steps and mandatory-Make
handoffs. Preserve their historical evidence. Do not reactivate suspended billing.

## Phased delivery

### Phase 0 — reconcile the release scope

- Review the dirty working tree and group migration, cleanup and deployment work.
- Audit every frontend request against an actual migrated backend handler. Update
  `docs/migration/route-matrix.md`, which still describes old Firestore destinations.
- Mark unsupported imports, recipes, flows, notifications and key-management
  controls as deferred or implement their contracts before exposing them.
- Define pilot scope: capture, sign-in, inquiry list/detail, follow-up and optional
  manual classification. Remove obsolete architecture claims from remaining docs.

Exit: a reviewable scope and route matrix with clear supported/deferred services.

### Phase 1 — staging access and authentication

Depends on Phase 0.

- Verify Vercel project/team/revision, Preview scopes and Supabase migration history.
- Finish the existing API-only staging host design, or explicitly choose another
  supported access design. Verify protection policy and exact-origin CORS.
- Prove machine requests reach application JSON instead of Vercel SSO HTML.
- Verify the staging account's server-owned workspace; never match by email or
  trust a client workspace ID. Test cross-tenant access denial.
- Test signup, login, logout, recovery and exact callback destinations.

Exit: liveness returns 200, missing/invalid application credentials are rejected,
the owner can read its workspace, and another tenant cannot. Host access and
application authentication are verified separately.

### Phase 2 — direct intake end to end

Depends on Phase 1.

- Replace the provisioning script flagged in AGENTS.md: no secrets in process
  arguments or SQL/log output, and no placeholder workspace ID.
- Bind a privately stored source hash to the verified workspace. Configure
  `supabase-direct` and required staging intake gates for an authorized rehearsal.
- Submit labelled synthetic data and verify the same canonical ID in the dashboard.
- Test identical replay, changed-payload conflict, repeat customers, original-text
  preservation, rate limits, authorization denial and failure recovery.
- Verify customer-specific source ownership. The marketing contact form's source
  binding must not become a shared destination for every customer's inquiries.

Exit: each logical submission stores once, remains owner-scoped, and is available
with Make/AI offline. Record deployed revision and redacted outcomes.

### Phase 3 — email and legacy continuity

Depends on Phase 2; classification preparation may overlap.

- Decide the pilot's confirmation and owner-notification behavior. Preserve the
  established branded template and useful reply destination.
- Deliver after committed storage through a durable outbox with dedupe, bounded
  retries and observable failures. Email failure must not undo saved intake.
- Configure and test Auth email/recovery separately from inquiry notifications.
- Rehearse authorized history export/import and trusted legacy identity bindings.
  Verify access under the suspended account before promising recovery.
- Document blocked history recovery explicitly; never silently replace it with
  an apparently empty workspace. Keep a recoverable migration record.

Exit: tested account and notification delivery, documented history/identity
continuity, and truthful failure states.

### Phase 4 — operational AI classification

Depends on Phase 2. Reuse existing jobs, worker and adapter where verified.

- Select an eligible provider/account and supported model; pin the evaluated model
  identifier and prompt/schema version. Test the actual API with synthetic data.
- Choose worker hosting. The current daemon expects an ongoing process; an HTTP
  function cannot be assumed to run it indefinitely. A bounded scheduled consumer
  is an alternative implementation, with its own runtime limits.
- Verify leases, timeouts, crash recovery, output validation, quota reservation,
  successful settlement and duplicate-provider-call risk.
- Launch the existing explicit Analyze action first. Add opt-in automatic
  classification after proving transactional enqueue/outbox and replay behavior.
- Store analysis separately from originals. Record model/version/time and human
  review; preserve human corrections during retries and re-analysis.
- Add per-workspace/global concurrency and spending caps plus operator pause.
- Evaluate labelled sales, support, partnership, spam, ambiguous, Hindi/English,
  code-switching and adversarial messages before setting quality claims.

Initial fields: intent, urgency, category, factual summary and suggested human
action. Use unknown/review-needed when evidence is absent. Fit scores require
workspace qualification criteria and are not conversion predictions. Do not
invent numerical confidence. Set measurable quality thresholds using held-out
examples, and record cost per successful analysis and latency.

Exit: provider failures retain original inquiries and permit manual handling;
approved quality, spending, privacy and recovery checks pass.

### Phase 5 — finish imports and dashboard service coverage

Depends on Phase 0; processing modes depend on Phase 4.

- CSV first: validation, mapping, preview, import-only mode, duplicate policy,
  row-level errors, export and failure recovery.
- Sheets next: least-privilege connection, ownership, mapping, incremental
  checkpoints, disconnect, retries and explicit permission for write-back.
- Migrate required recipes, flows and notification endpoints or visibly defer
  their controls. Avoid enabled actions that only return migration errors.
- Verify real dashboard totals, filters, empty/error states, mobile layouts and
  keyboard operation. Distinguish unavailable data from zero records.

Exit: each enabled pilot feature has a verified backend contract and useful error
handling. Defer OCR and extra CRMs until customer demand justifies their upkeep.

### Phase 6 — production operations and controlled pilot

Depends on Phases 1–3 and selected features from Phases 4–5.

- Define production data isolation, domain routing and exact Auth callbacks.
- Add redacted monitoring/alerts for intake failure, queue age, worker health,
  provider spend, database failures and email delivery problems.
- Verify backup/export availability on the actual plan and test isolated restore.
- Add abuse controls and retention/deletion/export procedures with accurate privacy text.
- Run relevant local integrations, browser checks and bounded staging load checks.
- Document cutover and rollback, including treatment of records written after cutover.
- Publish through the approved release process and verify before inviting pilots.

Exit: a limited pilot with verified capture, account recovery, monitoring and
tested recovery. Paid launch additionally requires Phase 7.

### Phase 7 — subscriptions and final Firebase retirement

- Choose prices/provider using measured hosting, analysis and email costs.
- Implement verified replay-safe billing webhooks, server-owned entitlements,
  cancellation/renewal/failure handling and database/API quota enforcement.
- Remove Firebase packages, configuration and unused legacy backend paths after
  replacement parity, history continuity and rollback requirements are resolved.
- Align marketing claims and visible integrations with the actual paid release.

Exit: payment state reliably controls entitlement and no live path depends on
the suspended Firebase project.

## Classification options and recommendation

| Option | Fit | Tradeoff |
| --- | --- | --- |
| Direct Gemini API | Preferred implementation fit: `server/gemini-processor.mjs` already exists | Live API compatibility, worker hosting, account eligibility and billing/privacy approval still required |
| Local model through Ollama | Offline/private evaluation without a hosted-model API bill | New adapter, compute and quality evaluation required; continuous production hosting still costs resources |
| Make plus AI provider | Useful when an operator needs visual automation | Extra scenario maintenance, operations/cadence limits and privacy/logging review; legacy Airtable flow is not a verified replacement |

Prepare direct Gemini classification using synthetic data first. For real customer
messages, resolve the approved paid-service/account path or explicitly select
another eligible hosted provider and implement its adapter. Do not work around
the suspended account or enable Google billing implicitly. Manual inquiry handling
can launch while classification remains disabled.

Google's unpaid-service terms instruct users not to submit personal, confidential
or sensitive information. Inquiry bodies can contain these even after separate
name/email fields are removed. Paid terms exclude prompts/responses from product
improvement but describe limited safety retention; this is not zero retention.

Choose a supported model only after evaluating representative inquiries. Estimate
cost from measured input/output tokens, selected rates, retries, worker hosting
and email costs. Do not promise a fixed per-lead price or accuracy before measuring.
Do not automatically send customer data to a fallback provider without the
required privacy/configuration decision.

Official references reviewed:

- [Gemini terms/data handling](https://ai.google.dev/gemini-api/terms)
- [Gemini structured outputs](https://ai.google.dev/gemini-api/docs/structured-output)
- [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing)
- [Ollama structured outputs](https://docs.ollama.com/capabilities/structured-outputs)

## Start here

Complete Phase 0's route audit and Phase 1's deployment verification, then prove
Phase 2 direct intake before enabling classification. This plan changes no cloud
access, provider gate, billing setting or deployment.
