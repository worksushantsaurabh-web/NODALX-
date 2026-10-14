# NodalX LLM mind: compact operating context

> 9 October: app database is **AWS RDS** (`nodalx_app`); Supabase
> `ozovfbwhcvbgpgrxxjcj` is **Auth identity only**. Production `nodalx.in`
> serves the RDS build with live website intake enabled. Direct intake is active;
> Make is optional (historical mandatory-Make sequence below). **Update this
> file and `AGENTS.md` after every passed/successful implementation.**

Updated: 14 October 2026. `AGENTS.md` holds authoritative rules and the dated
implementation log. Phase table: `docs/runbooks/ide-handoff-current-2026-10-07.md`.
Ordered work: `docs/runbooks/release-roadmap-2026-10-07.md`.

## PURPOSE

NodalX helps small businesses capture inquiries, preserve original messages,
review optional qualification and track human follow-up. Reliability before
automation. No guaranteed revenue, fabricated insight or autonomous sending claims.

## CURRENT TASK

Current AWS security migration: Phases 0–5 are complete. Phase 6 has a protected
Vercel Preview (`dpl_D2YRaNZp1dP8RxYKJrfP9DJgr98T`) routing `/api/*` to the
staging AWS API via an ordered route in `vercel.json`; plain rewrites alone let
existing Vercel API functions win. Health returned 200 with RDS/Caddy headers,
unauthenticated profile and workspace requests returned 401 via Caddy, and
contact remained disabled (503). The Preview bundle uses
`VITE_API_BASE_URL=same-origin`. On 14 October, the owner signed in and an
authenticated overview response ID `ce3dad2b-5f13-40ab-8ec0-dc037d056cf1`
matched the AWS EC2 API journal (`GET /api/workspace/*`, 200). Authenticated
overview, inquiries, usage, email identity, inbox and settings returned 200
through Caddy/RDS. The privacy-safe API access log runs in staging release
`86d01c6e758e06949b538214ba1debb94eefb0545f55bdcca91277651f0f4cb8`;
previous release `04f26e63754961462d69580b45e153cd28c853ddfe9130699becfd4eecbff6f2`
is retained. The local intake suite passed 137 tests with five optional skips.
Stage 6C owner-approved synthetic intake passed via protected Preview:
201 created, 200 identical replay with one ID, 409 changed-body conflict;
RDS exact original and owner UI one row; owner RLS one and unrelated user
zero. Exact test row was removed, staged source disabled/count reset to zero,
and owner UI returned to zero. AWS intake gates were restored off in secret
version `bc32f6c375c6f35b7705297efdb53aa7`; staging contact is again 503.
Controlled support and reviewed outbound tests passed with Resend acceptance;
their exact synthetic rows were removed. Current secret is
`e92ad26290d034a9107f572f9806c0cf`, intake/support/outbound gates off.
Local real-Svix adapter testing verifies unchanged raw bytes and missing,
forged and expired signature rejection. Preview candidate redeploy and full
route checks remain. Caddy overwrites X-Forwarded-For with its peer address;
through Vercel this groups users by proxy IP in the support rate limiter.
Review that behavior before claiming the client-IP parity gate passes.
RDS remains publicly accessible and
`nodalx.in` still uses Vercel API functions. No CloudFront distribution exists;
AWS Support case `179179095800228` awaits account verification. See
`docs/runbooks/aws-api-migration-phases-2026-10-11.md`.

Next execution order is now explicit in that runbook: 6A inventory live routes
and config, 6B make AWS feature and DB-login parity, 6C full protected Preview
E2E with authenticated trace, 6D rollback/backup/alarm preflight, 6E Production
cutover, 7A remove public RDS ingress, 7B set RDS private, then 8 operate.
Current AWS staging gates would cause Production feature outages if promoted
as-is. No Production cutover or database closure has occurred.

Stage 6A was executed read-only on 12 October. The phase runbook holds the exact
Production/Preview deployment IDs, operator and EC2 release, RDS public SG
rules, and route/feature matrix. Production contact and support email are live;
outbound email is enabled. AWS staging secret has only RDS/Auth keys, so these
three paths block Production cutover. Inbound receiving, Make intake and
processing remain disabled. Next is Stage 6B feature parity, then protected
Preview authenticated/write verification. This Stage 6A record predates the
13 October credential-exposure incident described below.

Stage 6B is in progress. A disposable `nodalx_test` login rehearsal passed and
was cleaned up. Dedicated login `nodalx_api_d056879d5d5484` is staged in the
AWS API rollback secret version `b6a405d8-5727-4fbe-8cb9-b65da292bc39`; it has no
direct workspace read, only explicit `SET ROLE` paths. The API restarted and
settled healthy through loopback and public Caddy HTTPS. On 14 October, a new
restricted login, disabled independent website binding and domain-scoped
sending-only Resend key were stored in AWSCURRENT staging secret version
`567631cc-08f9-4fa5-a362-8e0323b0e2ce`. On-host checks confirmed the
feature gates are off and the sending key cannot list API keys (403).
Staging health is 200; disabled contact/support remain 503. Production routing
remains blocked pending value-safe support settings and Stage 6C verification.
Routing tests were realigned to the cutover routing on 14 October:
`tests/supabase-routing.test.mjs` and `tests/aws-contact.test.mjs` now assert the
ordered `/api/(.*)` route and `/api/:path*` rewrite both target the AWS staging
origin (they previously asserted the retired Vercel-function routing).
An on-host value-safe parity check (`aws/check-staging-config-parity.mjs`, SSM,
key names and match outcomes only) on 14 October found `SUPPORT_EMAIL_TO` and
`SUPPORT_EMAIL_FROM` MISSING from staging secret version
`567631cc-08f9-4fa5-a362-8e0323b0e2ce`; both values are public configuration in
`.env.example` and must be staged before `SUPPORT_EMAIL_ENABLED` turns on. All
intake/email gates confirmed OFF on host. Verification: intake 136/136
(5 opt-ins skipped), SQL 176/176 on `nodalx_test`, frontend build clean, secret
scan 394/0, `git diff --check` clean.
An on-host query with the staged secret confirmed the new login connected to
RDS private address `172.31.82.70` with TLS enabled.
Owner-authorized Stage 6B Step 1 on 14 October added the two missing support
addresses to AWS staging secret version `dfaafdf39fd369b9fe4af79199ffca48`
(`567631cc-08f9-4fa5-a362-8e0323b0e2ce` is AWSPREVIOUS) using an encrypted,
in-memory SSM relay. Value-safe on-host checks matched both support addresses,
outbound sender and domain; all six intake/email/processing gates stayed off.
SSM restart settled active; staging HTTPS health was 200/RDS and gated contact,
support and inbound webhook routes were 503. Production stayed on Vercel.
The intake suite passed 136 tests with five opt-ins skipped; tracked secret
scan and diff check were clean. Step 2 requires `RDS_INTAKE_ENABLED=true` in
addition to the supplied intake flags. Protected Preview acceptance, stable
Production origin decision, and Production cutover remain pending.
An existing local full-access Resend key was accidentally printed in a tool
result on 13 October. Treat it as compromised; identify its Production/Auth
dependencies and rotate it. Its use timestamp points to the separate
`resend-email-copper-bell` key, but Vercel's hidden key value cannot be directly
compared. Never copy that key to AWS or revoke it before Production replacement.
The Supabase Auth key is separately named; do not revoke it. No key is in tracked code.

Phased execution is tracked in
`docs/runbooks/aws-api-migration-phases-2026-10-11.md`. Phases 0–5 are complete:
AWS discovery & budgets verified; Node HTTP adapter and allowlisted package prepared;
non-root MFA operator `nodalx-operator` established; EC2 host `i-0a39a885ceb38a8b9`
provisioned via CloudFormation stack `nodalx-api-staging` with private RDS ingress;
staging API & Caddy installed with Let's Encrypt TLS on `api-staging.nodalx.in`;
Phase 5 E2E verified with live direct intake (201 created, 200 idempotent replay,
409 conflict), Svix webhook signature rejection (401), and full data cleanup to
0 inquiries. Staging host is restored to safe defaults. Phase 6 Preview is
deployed and owner-tested; authenticated trace and Production are pending.

Historical roadmap context follows; its deployment identifiers and immediate
engineering state may be superseded by later entries in `AGENTS.md`.

Execute the release roadmap in order (route parity → staging access → direct
intake → email/history → classification → imports → operations → paid plans)
on the RDS-backed deployment. Immediate engineering state:

- `nodalx.in` runs commit `0eee233` as Production deployment
  `dpl_FFL6UHqrpWpyt9QhubpvYcHWRqno`; the public inquiry form writes
  directly to RDS through one server-owned website source. The reconciled
  email-desk release `ac6dda5` is a Ready Preview (`dpl_HLPdoJ9…`) with
  outbound-email env staged in Production scope; promotion is one owner
  dashboard click (CLI production deploy is permission-blocked).
- The local checkout is now synced to `ac6dda5` (was dirty at `1b8d694`;
  backup branch `backup/pre-sync-20261010`). Do not deploy the checkout
  wholesale without review.
- Phase 3 history continuity is being prepared. The RDS inquiry-list notice
  now describes direct storage and unmigrated Google Sheet history correctly;
  `docs/runbooks/phase-3-history-continuity-2026-10-10.md` records the export,
  trusted identity mapping and verification gates. This local change is not yet
  deployed; no legacy data was imported.
- Phase 4 preparation: the isolated processing worker package now contains
  `server/rds-client.mjs` and the AWS RDS CA bundle required by its entrypoint.
  Focused worker tests pass (22/22). The model endpoint/version, eligible host,
  held-out evaluation and operator activation remain unverified; processing
  stays disabled.
- Owner says the trained model runs through Ollama on the Mac. The active
  `/api/tags` inventory has only two remote-backed entries and no local-weight
  model. The temporary server was stopped without a prompt. The owner then
  supplied a GGUF file served by the existing llama.cpp runtime; neither
  remote Ollama entry was treated as the trained model.
- Owner supplied the v3 GGUF path. Checksum matched its manifest; existing
  llama.cpp CPU runtime and wrapper processed one example and eight synthetic
  fresh cases. Fresh result was 6/8, with two safe rejections; the server was
  stopped. The earlier saved 7/8 was not reproduced. Phase 4 remains offline
  candidate only; see `docs/runbooks/phase-4-local-model-2026-10-10.md`.
- Subsequent wrapper/prompt changes, with unchanged GGUF, address trusted
  suppression, customer-history evidence and website-only unknown fit. Focused
  tests pass (4/4); two eight-case synthetic retries scored 7/8 then 8/8.
  The local server was stopped. This does not establish production accuracy.
- Phase 4 deeper evaluation: 41 synthetic cases gave 32 raw and 39 wrapped
  asserted-field matches; nine critical cases repeated three times. Ten new
  synthetic challenges gave 7 raw and 10 wrapped asserted-field matches, but
  exposed a privacy deletion draft. Updated wrapper replay now retains verified
  knowledge provenance and withholds suspect drafts: 40/41 asserted fields on
  prior raw outputs and 10/10 challenge quality checks with six of ten drafts
  withheld. These are development regressions, not blind accuracy. A small
  staged app mapper now strips separate contact PII and accepts server-trusted
  context only (`server/nodalx-v3-input.mjs`, 2 tests passed). It is not wired to
  the worker. Processing remains disabled; full result storage, independent
  reviewer labels, model hosting and synthetic RDS rehearsal remain pending.
- Owner has no real examples yet and chose to defer model-host selection until
  evaluation. A new checksummed 16-case synthetic set ran once without recipe
  edits afterward: 9/16 raw and 11/16 wrapped asserted-field matches. Critical
  misses include electrical-panel smoke not escalated, privacy deletion not
  escalated, wrong old day in a reschedule draft, prospect fit errors, and a
  contradiction between repaired classification and unchanged draft. App
  shape validator accepted 16/16 despite these. The model server was stopped;
  processing remains disabled. See the frozen synthetic report in the separate
  model workspace. New development cases and a newly frozen benchmark are
  required after fixes; hosting decision follows evaluation.
- A separate post-benchmark safety pass in the model wrapper fixed hazard and
  deletion escalation, target-day rescheduling, and stale prose after routing
  repair. Eight wrapper tests pass; v1 raw-output replay is 14/16 on asserted
  fields with five review flags. This is a tuned regression score; a new frozen
  set is needed before claiming improvement. Model weights and app gate are
  unchanged.

## TARGET / LEGACY

- TARGET: React/TypeScript frontend + Vercel APIs + hosted Supabase Auth
  (identity) + AWS RDS `nodalx_app` (application data). `npm run dev` is the
  RDS path — no Docker.
- LEGACY: suspended Firebase/GCP, Apps Script/Sheets intake, Make/Airtable
  flow (optional), Supabase-as-database (now Auth-only), old Functions.
- Docker is test-harness only: SQL assertions run on RDS (`npm run test:rds`);
  Docker is needed solely for 5 opt-in integration tests (`TEST_LOCAL_*`).
- Legacy Apps Script email/retry behavior must not silently disappear at cutover.
- Google/Gemini processing is optional and disabled; intake never depends on AI.

## ENVIRONMENT

```text
Repo: /Users/sushantsaurabh/Desktop/NODALXAI
Branch: nodalx-staging (remote release commit 0eee233; local checkout dirty)
GitHub: https://github.com/worksushantsaurabh-web/NODALX-
Vercel: nodalx-frontend / worksushantsaurabh-webs-projects
Production: https://nodalx.in → dpl_CPLoArpwoRQyniemYQKpQSZ2UVem (email + review desk)
Rollback:   dpl_FFL6UHqrpWpyt9QhubpvYcHWRqno
Preview (SSO-protected): nodalx-frontend-p084iy8me-worksushantsaurabh-webs-projects.vercel.app
Supabase Auth: nodalx-staging / ozovfbwhcvbgpgrxxjcj / Mumbai — Auth only;
  Site URL https://nodalx.in; production + staging callbacks allowlisted
RDS: nodalx-db.c69g2gg22fls.us-east-1.rds.amazonaws.com:5432
  nodalx_app = app data | nodalx_test = SQL assertions (disposable, --reset)
Email: Resend, nodalx.in verified; desk gate staged in Production scope
```

## KNOWLEDGE STATES

**Independently observed (recorded in AGENTS.md):**
- Public contact surfaces now use `support@nodalx.in`: footer contact link,
  Terms, Privacy Policy and Changelog no longer publish a personal gmail
  address. `support@nodalx.in` is the inbound/support address; the dashboard
  lead reply is a separate path that sends to the lead's own stored address.
- Dashboard reply sender (`e882db9`, committed, not deployed): uses the
  operator's authenticated account address as `from` when it is on a domain
  the provider can send as, otherwise keeps the NodalX sender with the
  operator address in `reply_to`. The address comes from the verified session
  identity, never the request body; lookalike domains and header-injection
  shaped values are rejected.
- Production smoke: liveness 200 with RDS header; the live browser inquiry
  form confirmed success and RDS stored its exact message in the owner
  workspace. Live API checks: 201 initial, 200 identical replay, 409 changed
  content; owner RLS sees 1 row and another tenant sees 0. Synthetic rows
  were removed, leaving one enabled website source and zero inquiries.
- Phase 3 Step 3.1 rehearsal end-to-end: reserve → Resend accepted
  (`01a11f98…`) → ledger `state='sent'` + `provider_message_id` → inquiry
  `Pending → Contacted` → `inquiry_events` with `emailSent: true`; same-key
  replay `created:false`; changed content `P0409`. Synthetic rows deleted.
- `npm run test:rds`: 146/146 SQL assertions on RDS `nodalx_test`, from a
  clean `--reset` and idempotent re-run; guards refuse any other host/db;
  `npm run migrate:rds` still reports every step Already applied.
- RDS `service_role` now has BYPASSRLS, versioned as
  `rds/service_role_bypass_rls.sql` (fixes silent RLS-filtered `finalize()`).
- 103 intake tests (5 Docker opt-ins skipped), secret scan 351/0,
  `git diff --check` clean; frontend build green.
- Endpoint health re-check (10 Oct): `check:rds` PG18.3/TLS; migrate 19/19
  Already applied; 27 public tables all RLS; service_role BYPASSRLS set; data
  = 1 owner workspace/user/binding, zero inquiries/emails; `test:rds` 146/146;
  boundary-valid POST `201 stored` re-confirmed live intake; the probe row
  `3db9d4e3…` was deleted at once and counts restored to zero.
- Release `ac6dda5` (10 Oct): local checkout synced to remote (backup branch
  kept), email-desk routes reconciled into the RDS release line, production
  Resend/outbound-email env staged, Ready Preview `dpl_HLPdoJ9…` smoke-checked
  (200 alive; inquiry email routes 401). CLI production deploy Blocked on
  commit-author team permission; nodalx.in unchanged.
- Phase 4 re-verification (10 Oct): wrapper 15/15, app packet/input 6/6, desk
  12/12, backend 110 pass/0 fail (5 Docker opt-ins skipped), frontend build
  clean, secret scan 351/0, diff clean; frozen v4 hash unchanged.
- **Deploy packaging gap found and fixed.** Commit `116aa7b` built green but
  every API route 500'd on the Preview: `.vercelignore` is a strict allowlist
  and `server/nodalx-v3-result.mjs` was never added, so it was excluded while
  frontend typecheck/bundle (which never touch server modules) passed. Added
  both new v3 modules and replaced the routing test's literal file list with one
  derived from real imports; negative case verified. Fixed in `8437840`, whose
  Preview returns 200 liveness w/ RDS header, `INTAKE_DISABLED` (no write),
  `AUTH_REQUIRED`, zero runtime errors.
- **Production deploy is live.** Blocked cause was never team settings: the
  Vercel account email is `work.sushantsaurabh@gmail.com` (sole team OWNER)
  while commits were authored by `nodalxai@gmail.com`, and Vercel validates the
  *commit author's* email. Re-authored HEAD via `--amend --reset-author`
  (identical tree, no code change) and deployed. Production
  `dpl_CPLoArpwoRQyniemYQKpQSZ2UVem` is Ready and assigned to `nodalx.in`.
  Live: liveness 200 + RDS header, review/email routes 401 unauthenticated,
  invalid POST 400 without writing, zero runtime errors — so the `.vercelignore`
  packaging fix holds in Production. Repo-local git identity is now the team
  address so future commits deploy without a workaround. Rollback:
  `dpl_FFL6UHqrpWpyt9QhubpvYcHWRqno`.
- **Phase 4 is committed and applied.** Changeset pushed as `96188cc`
  (working tree clean; pre-migration function defs saved to
  `/private/tmp/nodalx-pre-phase4-functions.sql`). Migration
  `20261010214000` applied to RDS `nodalx_app` (19 prior steps verified by
  hash, idempotent). `finish_processing_job` accepts `analysis_packet`;
  `update_own_inquiry` accepts `review_decision` + camelCase alias. Production
  data untouched (0 inquiries), RLS 27/27, `service_role` BYPASSRLS intact;
  liveness 200 w/ RDS header, invalid POST 400, unauthed list 401. Fixed
  `buildCorrectionRecord` to emit distinct reasons for edited vs dismissed.
- Review-decision SQL coverage added: `inquiry_desk.test.sql` 12 -> 22
  assertions (156/156 overall, `--reset` and idempotent). Covers accepted
  decision persistence, camelCase normalization, edited-draft persistence,
  unknown-value/overlong-notes/foreign-workspace denial, and original-message
  immutability under review.
- Earlier staging audits (6–7 Oct): cloud migrations applied, RLS/advisor
  hardening, protected-preview liveness/auth-denial, Auth redirect allowlist.

**Owner-reported, not independently revalidated:**
- Staging app account verified; key rotations reported complete.
- Resend Marketplace terms, GoDaddy DNS edits accepted earlier.

**Unverified / pending:**
- Production email delivery: env staged and routes deployed on Preview, but
  promotion + one labelled dashboard send are still required; notification/
  history/identity parity remains a separate cutover gate.
- Hosted dual-mode intake harness built and fail-closed on the placeholder
  service-role key; not yet executed, and three opt-in files not yet converted.
- Tuned-model evidence (provider, immutable model ID, endpoint, held-out eval,
  production integration) — keep processing gates off until approved.

## ACCESS BLOCKER

Resolved on 11 October 2026: the CLI deploy failure was a commit-author identity
mismatch, not a lost credential. The repo-local git identity now matches the
Vercel team address, so CLI production deploys work. Keep Vercel deployment
protection/SSO enabled; no project-wide bypass, and regenerate the bypass token
that CLI debug output printed.

## HARD INVARIANTS

1. No secrets, customer exports, auth hashes or tokens in chat, git, logs or screenshots.
2. Server keys never `VITE_`; publishable key is public, service-role key is private.
3. Make receives opaque IDs/lease credential, not PII or Supabase service-role key.
4. One verified identity = one workspace; no teams, email matching or client ownership.
5. RLS + verified backend ownership; service role is server-only for machine
   paths (ingestion, email finalize); its BYPASSRLS on RDS is intentional
   parity with hosted Supabase (`rds/service_role_bypass_rls.sql`).
6. Exact original message/source identity preserved; analysis never overwrites it.
7. `(workspace_id, source_inquiry_id)` dedupe, not unique email/content hash.
8. Same ID/same payload = replay; same ID/changed payload = conflict; new ID = new inquiry.
9. Source/machine/processing credentials distinct; source hashes stay private.
10. No Google billing, payment method, paid resources or suspended Firebase deployment.
11. No main merge, production promotion, Make activation or cloud test writes implicitly.
12. After every passed/successful implementation update `AGENTS.md` **and this
    file** in the same turn; report skipped checks.
13. SQL tests only ever target `nodalx_test`; the harness must never be able
    to reach `nodalx_app`. `nodalx_test` holds synthetic fixtures only.

## ACKNOWLEDGEMENTS / FAILURE MODEL

- `/api/contact` 202 = durable queue acceptance, not email or dashboard storage.
- `/api/intake?action=claim` 200 idle = no work; claimed = lease only.
- `/api/intake?action=complete` 200 stored = canonical receipt.
- Disabled machine intake = 503; wrong Auth after enablement = 401.
- Email send 200 `sent` = provider accepted AND ledger committed AND
  `Contacted`; replayed same key never sends twice; same key/new content = P0409.
- Lease 120s; eight expired claims fail visibly; recovery is service-only.
- Source acceptance 60/min; successful router calls 120/min.
- Lost acknowledgements retry identical operation; never invent a new source ID.
- SSO redirect/HTML is protection, not a healthy API response.

## NEXT ACTION ORDER

1. Owner: send one labelled dashboard email test now that the email desk is
   deployed (`dpl_CPLoArpwo…`), confirming Resend acceptance plus ledger/status
   transition; then regenerate the Deployment Protection bypass token printed in
   CLI debug output.
2. Keep Make and Gemini execution off; the owner-trained model is the intended
   processing path. Website RDS intake stays live; outbound email activates
   only after promotion + the labelled test. For classification, obtain a
   reviewer-labelled locked set before further tuning; then design full
   evidence/provenance/review storage and a supervised model service before
   any worker connection or gate enablement.
3. Owner housekeeping: delete the two rehearsal emails in `support@nodalx.in`,
   rotate the RDS password (one CLI error echoed it into a transcript),
   regenerate the Deployment Protection bypass token printed in CLI debug,
   keep Vercel SSO/protection as-is.
4. Put the real hosted Supabase service-role key in gitignored `.env.local`
   (never chat), run `npm run test:intake:hosted`, then convert the remaining
   three opt-in test files using the same dual-mode pattern.
5. Owner: sign in to the dashboard on a real inquiry and confirm the review
   desk renders when a packet exists. Processing stays disabled, so the packet
   section stays hidden until a supervised model run is separately approved.
   Keep `ALLOW_PROCESSING_NETWORK=false`.
6. Capture real operator corrections from live inquiries before any LoRA
   dataset decision.
7. Follow the release roadmap order; every production/network/spend step
   needs explicit owner authorization.

## DECISION HEURISTIC

If it touches production, spends money, expands connector access, reveals secrets,
activates network processing, sends mail or writes cloud test data: stop and obtain
the specific missing authorization. If local checks fail: fix the relevant root
cause, do not refactor unrelated UI. If evidence is local or owner-reported: label it.

## FINISH LINE

Production `nodalx.in` serves the RDS-backed app with Supabase Auth identity,
and an approved labelled live synthetic inquiry travelled Website → direct
intake → RDS canonical storage → owner-visible row,
with replay safe, conflicts fenced, original text preserved and the email desk
committing provider acceptance to ledger/status atomically. Release roadmap
phases complete behind explicit approvals; billing/history/notification parity
decisions stay separate and owned.

## Phase 4 draft grounding, frozen v4 evaluation, and human review path

- Investigated draft grounding on development cases: added deterministic checks
  in `classify.mjs` for drafts repeating supplied dimensions, materials, quantities,
  and colors, safely withholding them (`draft_repeats_known_dimensions`,
  `draft_repeats_known_material`, `draft_repeats_known_quantity`,
  `draft_repeats_known_color`), and expanded exploratory low-urgency phrasing.
  Replaying saved v3 raw outputs scored 12/12 asserted fields (up from 11/12) with
  4 review flags and 0 quality errors.
- Genuinely new 15-case benchmark `locked-synthetic-v4.json` was frozen at
  SHA-256 `295b0658d2dd1484575d78b5cd4fb7bf245b8da7b3a7ed33a170b299c3af71b5`.
  First run on local llama.cpp CPU server: raw 11/15, wrapped 12/15, 2 review
  flags, 14/15 quality checks passed, 1 wrapper error (failed closed on evidence
  grounding when model quoted JSON structure). Ungrounded draft on `v4_quote_signage`
  was intercepted and withheld. Identified persistent hazard keyword brittleness
  (`smoking` missed `\bsmoke\b`). Local server was stopped; production processing
  remains disabled.
- Built packet persistence and dashboard human review behind the disabled gate:
  `validateReviewDecision` exported from `server/nodalx-v3-result.mjs`;
  `server/processing-worker.mjs` validates and persists `analysis_packet` in job settlement;
  migration `20261010214000_inquiry_analysis_persistence_and_review.sql` extends
  `finish_processing_job` and `update_own_inquiry` for `review_decision`;
  `server/supabase-workspace.mjs` validates review decisions on PATCH and serializes
  `analysis_packet` and `review_decision`; `ModelAnalysisReview` component provides
  inquiry desk review UI in `Dashboard.tsx` to inspect recommendations, review flags,
  citations, recipe provenance, record human decisions (`accepted`, `edited`, `dismissed`),
  or apply drafts.
- Verification: 109/109 default backend tests passed, 12/12 frontend desk tests passed,
  frontend build clean, secret scan clean (0 found across 351 tracked files), model tests clean (13/13).

## Phase 4 safety hazard inflection, evidence normalization, v4 replay, and continuous improvement

- Fixed safety hazard keyword coverage in `classify.mjs`: updated `hasImmediatePhysicalHazard`
  to match inflected verbs and hazard synonyms (`smok\w*`, `fire\w*`, `spark\w*`,
  `electric(?:al)?\s+(?:shock|fire|hazard)`, `gas\s+leak`, `burning\w*`, `melt\w*`,
  `live\s+wire`, `short\s+circuit`) and temporal urgency indicators (`urgent\w*`,
  `immediately`, `asap`, `emergency`), resolving the missed escalation on `v4_hazard_melting_cord`.
- Hardened evidence normalization against leaked prompt/JSON syntax: `sanitizeEvidenceSnippet`
  strips leading/trailing envelope formatting (`^(?:[\s\{\}\[\]]*\\?["']?\w+\\?["']?\s*:\s*\\?["']?)+`, quotes)
  before grounding checks, resolving the ungrounded evidence exception on `v4_prospect_thin` while
  retaining strict fail-closed rejection for completely ungrounded hallucinations.
- Added unit tests in `classify.test.mjs` (15/15 passed). Added `locked-synthetic-v4.json` to
  `replay-audit.mjs` and replayed `locked-synthetic-v4-results.json` into
  `locked-synthetic-v4-regression-replay.json`: scored **14/15** asserted-field matches (up from 12/15),
  **15/15** quality checks passed, **6** review flags, and **0** wrapper errors.
- Continuous improvement feedback data pipeline: added `buildCorrectionRecord` and validated optional
  `edited_classification` in `server/nodalx-v3-result.mjs`, formatting inquiry desk review decisions
  (`accepted`, `edited`, `dismissed`) into standardized training candidate rows matching
  `continuous-improvement.md` and `next-training-data-rubric.md`.
- Full verification: 110/110 default backend tests passed (5 opt-ins skipped), 12/12 frontend desk tests
  passed, frontend build clean, `git diff --check` clean, 0 secrets flagged across 351 tracked files.
  Production model processing remains strictly disabled (`ALLOW_PROCESSING_NETWORK=false`).


## Workspace managed email replies — staged 11 October 2026

- A new migration allocates each workspace a unique reply.nodalx.in alias,
  enforces format and reserved names in PostgreSQL, audits owner-requested
  changes, limits changes to once per 24 hours, and keeps old aliases reserved
  and receivable. Tenant-scoped inbound messages are stored idempotently.
  Inquiry linking requires a sent RFC Message-ID and stored recipient match;
  sender address alone never claims a thread.
- The sender uses the workspace alias as From and Reply-To only when the
  separate receiving and managed-sending gates are enabled; both default off.
  The signed Resend webhook, workspace inbox, inquiry conversation view and
  custom-domain customer note are implemented in the staging checkout.
- Verification: 176/176 SQL assertions on isolated RDS nodalx_test; 119 backend
  tests passed (5 opt-ins skipped); frontend build and secret scan passed.
  With owner approval, the alias migration was applied to live RDS nodalx_app:
  one workspace has an alias. Resend verified reply.nodalx.in sending and
  receiving through five new subdomain DNS records. Protected Preview
  dpl_B6HtAda83ZK3tvmw7jzpXLWLC6Bc processed one labelled real inbound
  email through a signed webhook into the correct workspace inbox; replay
  left exactly one row. The temporary Preview webhook and bypass were
  removed, and its branch-scoped webhook secret and receiving switch removed.
  No dashboard outbound/actual lead reply or old-alias live mail was tested.
  Attachments and notifications remain outside the current implementation.
  Managed sending stays off, and Production Vercel is unchanged.
  See docs/runbooks/workspace-email-replies-2026-10-11.md.

## 11 October 2026 — support relay fix + Oracle Cloud assessment

**Support relay closed (code done, NOT deployed).** `api/send-email.mjs` was
confirmed live at `https://nodalx.in/api/send-email` with no auth, no rate
limit, no origin check and a client-chosen `to`/`html`, using the Production
`RESEND_API_KEY`. It bypassed `OUTBOUND_EMAIL_ENABLED`. It is now a
server-recipient support inbox: `to` is rejected, recipient is pinned to
`SUPPORT_EMAIL_TO` (default support@nodalx.in), `from` is server-owned,
`html`/`cc`/`bcc` refused, `replyTo` is the only client address field, and a
missing/mismatched `Origin` is refused (same-origin by default; optional exact
list via `SUPPORT_EMAIL_ALLOWED_ORIGINS`). Fails closed behind
`SUPPORT_EMAIL_ENABLED`; 5 per 10 min per client; CR/LF header injection capped;
generic errors never echo provider text. Exported via
`createSupportEmailHandler({resendFactory, store})` so tests make no network
call. `FeedbackWidget.tsx` sends `replyTo`. New server vars are documented in
`.env.example` only. **The live relay stays open until this is promoted, and
enabling requires `SUPPORT_EMAIL_ENABLED=true` in the target Vercel scope.**
Verified: 15 focused tests, 131 default backend tests (5 Docker opt-ins
skipped), frontend build/typecheck clean, secret scan 368 files / 0,
`git diff --check` clean.

**Oracle Cloud (Mumbai Always Free) — assessment only, nothing provisioned.**
Verified architecture: React+Vite static frontend on Vercel; Node ESM
serverless API (`api/` + `server/`); PostgreSQL 18.3 on RDS via a hand-written
PostgREST-compatible `pg` client with no ORM; hosted Supabase Auth as identity
only; Postgres-backed queue with leases and heartbeat and **no Redis anywhere**;
the processing worker is Docker-packaged but has never been built or deployed.
All production dependencies are pure JS, so ARM64 is a non-issue.

Three facts that drive the plan:
1. Always Free A1 is now **2 OCPU / 12 GB** (Oracle halved it in June 2026) and
   the instance is already at that ceiling — no headroom, and a terminated
   instance may not be recreatable above the limit.
2. The **200 GB boot volume at Balanced (10 VPU/GB) bills VPU separately**
   (~$34/mo at $0.017/VPU/GB) even though the 200 GB capacity allowance is
   free. Boot volumes cannot use the 0-VPU Lower Cost tier, so the only lever is
   shrinking it. Verify in OCI Cost Analysis before planning around the number.
3. OCI is Mumbai, RDS is us-east-1 — any database move is inter-region, and
   moving the API off Vercel turns all RDS traffic into AWS internet egress at
   $0.09/GB.

Recommended order: fix the boot-volume cost first (it is the largest single
saving, ~$26/mo, larger than the RDS saving), move **only** the processing
worker to OCI (the one workload Vercel cannot run, and currently running
nowhere), leave the API on Vercel (already free at 1 workspace / 0 inquiries),
do not introduce Redis (the Postgres queue already works), and treat any
database migration as a separate, explicitly approved phase requiring
`rds-client.mjs:39` (`url.pathname = '/nodalx_app'` hardcoded) and
`scripts/migrate-rds.mjs:8` (literal AWS RDS hostname + AWS CA bundle) to be
parameterized first. The A1 box will run ~1.5 GB of 12 GB — the binding
constraint is operational risk, not capacity. Also open: RDS security-group
ingress is `0.0.0.0/0`; narrow it with Vercel's egress IPs once `psql` is
available on the OCI host. No OCI resource, DNS, firewall, deployment or
credential was touched.

**Support relay fix — DEPLOYED (update supersedes the "NOT deployed" note
above).** Production is now `dpl_8gLbferLXPnxgTpqB6Lkn72Kr11J` with
`SUPPORT_EMAIL_ENABLED=true`, `SUPPORT_EMAIL_TO` and `SUPPORT_EMAIL_FROM` set
as Production Secrets. Live: relay/cross-origin -> 403, client-chosen `to` or
`html` -> 400, labelled same-origin send accepted by Resend, rate limit active.
Rollback to `dpl_CPLoArpwoRQyniemYQKpQSZ2UVem`. Lesson worth keeping: adding
environment variables via the CLI triggers an auto-redeploy that snapshots
**only the variables that existed at that moment** — the first add produced a
Ready deployment that still returned the disabled response, and an explicit
redeploy was needed. Always probe the live endpoint after an env-triggered
redeploy; do not treat "Ready" as proof the new configuration is active.
Known limitation: the support rate limit is an in-process Map, so under
serverless it is per warm instance and best-effort, not a global limit.

**RDS hardened + exposure corrected (11 October).** `ALTER ROLE postgres
CONNECTION LIMIT 50` applied to live RDS `nodalx_app` with owner approval
(previously unlimited). Number derived from measured instance capacity:
`max_connections` 81 / 78 usable, pool `max: 4`, observed usage 1, DB-side
intake caps already 60/min per source and 120/min router-wide. Enforcement
proven empirically — 49 extra connections accepted, the 50th rejected with
PostgreSQL `53300`. Post-change verification: liveness 200 with
`x-nodalx-data-source: rds`, inquiries 401, contact 400, frontend 200,
`/api/send-email` still refuses a no-Origin relay attempt; 176/176 RDS SQL
assertions, 131 default backend tests (5 Docker opt-ins skipped), and
`migrate:rds` fully idempotent. Reverse with
`ALTER ROLE postgres CONNECTION LIMIT -1`. No data, schema, code or deployment
changed.

**Corrected security model — do not repeat the old advice.** Do NOT try to
allowlist "Vercel egress IPs" against RDS. Vercel functions have no fixed
outbound IP on this plan; static egress is a $100/month add-on and no range is
published. Following that guidance would have severed all production API
database access. Verified live posture instead: TLS 1.3 / AES_256_GCM, pg_hba
line 13 is `hostssl ... md5` so plaintext auth is impossible, `postgres` is NOT
a superuser and has no BYPASSRLS (restricted `rds_superuser` member only), and
`rdsadmin` is rejected from host access. So `0.0.0.0/0` on 5432 is a
credential-stuffing and connection-flooding risk, not direct data exposure;
the connection limit covers the flooding half. Fully closing 5432 requires the
API to leave Vercel for the OCI box with its static IP — the strongest security
case for the OCI migration. Local AWS CLI SSO token is expired; security-group
inspection needs re-authentication.

**AWS API Phase 2 identity (11 October 2026).** The root bootstrap created
`arn:aws:iam::560246495281:user/nodalx-operator` with only the AWS managed
`SignInLocalDevelopmentAccess` and narrow `NodalxOperatorSelfMfa` inline policy
(`aws/iam-operator-self-mfa.json`). IAM inspection confirmed no access key or
MFA device; no console login profile or infrastructure permissions were
created. Owner must set the console password in AWS, enroll MFA, and verify
short-lived `aws login --profile nodalx-operator` returns the IAM user ARN.
Phase 2 remains open until that evidence exists. Do not provision Phase 3 from
root or grant unconditioned broad privileges to the operator.

Phase 2 verification update: browser-based `aws login --profile nodalx-operator`
now selects `arn:aws:iam::560246495281:user/nodalx-operator`, confirmed by
`aws sts get-caller-identity`. IAM `list-mfa-devices` for that user returned
`[]`; MFA enrollment remains the only identity gate. Do not mark Phase 2
complete or grant provisioning rights until the device is verified.

Phase 2 closed later on 11 October: IAM `list-mfa-devices` returned one
enabled FIDO/U2F device (18:23:30 UTC) and STS still identified the IAM
user. The operator has no infrastructure provisioning policy yet; Phase 3
must add scoped, MFA-conditioned rights before a reviewed stack change set.
The root `nodalx-console` CLI session has expired.

Phase 3 start: operator lacks EC2 and CloudFormation permissions; direct
`DescribeSubnets` and `ValidateTemplate` were denied. Prepared the limited
initial Phase 3 policy for MFA-conditioned regional inspection (later
superseded by `aws/iam-phase3-operator.json`).
Root bootstrap CLI reauthentication is pending before attaching it. No IAM
grant, secret, CloudFormation change set, EC2, RDS SG, DNS or Vercel change
has happened in Phase 3.

Phase 3 bootstrap on 12 October: root CLI ARN was reverified, then attached
the limited `NodalxPhase3Review` policy. Operator session has expired, so its
MFA-conditioned access remains untested until fresh `aws login`. Root
read-only preflight found the target subnet on a public IGW route, expected
VPC/AZ and ample IPs; RDS SG remains broad, and the named API secret/stack
do not exist. No AWS host, secret, change set, DNS, RDS or Vercel mutation.

Phase 3 change-set progress later on 12 October: operator MFA session proved
EC2 describe and CloudFormation validation. Root bootstrap created a narrow
EC2 instance role/profile (SSM plus `nodalx/api/staging-*` secret read). The
stack template now references that fixed profile and no longer creates IAM.
The operator's Phase 3 grants moved to customer-managed policy
`NodalxPhase3OperatorReview` (`aws/iam-phase3-operator.json`) after the IAM
user inline-policy 2 KB limit rejected an update; duplicate inline Phase 3
policies were removed. The managed policy is MFA-conditioned and limited to
regional inspection and named change-set preparation; IAM simulation denies
`ExecuteChangeSet`. Operator prepared change set
`nodalx-api-staging-initial-20261012`, status CREATE_COMPLETE/AVAILABLE,
five EC2/network additions. It is NOT executed. No host, EIP, SG, RDS ingress
or staging secret created by this stack yet; owner review is next.

Phase 3 completed after owner approval on 12 October: CloudFormation stack
`nodalx-api-staging` reached CREATE_COMPLETE. EC2 `i-0a39a885ceb38a8b9`
is running at EIP `18.213.226.253`, private `172.31.82.166`; API SG
`sg-02b3168235eb8f3a6` has 80/443 only inbound, no SSH. The 20 GiB gp3
root volume is encrypted; IMDSv2 required; SSM shows Online. RDS SG has
the new private source-SG 5432 rule, while world and /32 ingress remain.
The temporary execution policy was detached and deleted. No app service,
staging secret, DNS, Vercel route or customer data changed. Phase 4 is next:
secure secret creation and SSM-based Node/Caddy install, then local health.

Phase 4 installed on 12 October: the MFA operator created the staging Secrets
Manager JSON with only RDS backend, RDS URL and hosted Supabase Auth URL/key;
installed Node 24, the allowlisted API package and Caddy 2.11.7 on the EC2
host through private S3 and SSM. Both systemd services are active. Loopback
and external-IP HTTPS health returned alive, the external response identified
RDS, and unauthenticated profile returned 401. The host connected by TLS to
`nodalx_app` over a private VPC address and hosted Supabase Auth health
returned 200. After action-time owner approval, Cloudflare published a DNS-only
A record `api-staging.nodalx.in` to `18.213.226.253`. Caddy switched to
publicly trusted Let's Encrypt TLS. Normal HTTPS health passed certificate
validation and returned RDS source; HTTP redirects to HTTPS with 308. Public
negative probes returned 401 for unauthenticated profile/workspace, 503 for
disabled contact and support sending, and 503 for unconfigured inbound mail.
Existing Vercel routing and RDS public access remain unchanged.

Phase 5 verified on 12 October: comprehensive staging E2E tests against
`https://api-staging.nodalx.in` completed. Initial POST `/api/contact` returned
201 Created (`duplicate: false`, stored in RDS `nodalx_app`); identical replay
returned 200 OK (`duplicate: true`); changed content returned 409 Conflict.
Svix inbound webhook validation on `/api/resend-inbound` correctly returned 401
(`INVALID_WEBHOOK`) for missing/forged signatures with receiving gate enabled.
Synthetic inquiry and temporary source binding were deleted (inquiries restored
to 0); Secrets Manager staging config was restored to safe disabled defaults,
and `nodalx-api` restarted via SSM. Full backend suite passed 136/136 tests (5
Docker opt-ins skipped); secret scan clean (368 files). Phase 6 is next: Vercel
same-origin API rewrite cutover.

Staging performance follow-up on 12 October: direct Mac-to-us-east-1 health
timing was about 240 ms TCP connect, 489 ms through TLS and 733 ms total;
second request on one connection took about 248 ms. OpenSSL TLS 1.2 reconnect
showed five `Reused` sessions, so Caddy session resumption already works.
Prepared and CloudFormation-validated `aws/api-staging-cloudfront.yaml` with
PriceClass 200 (India included), HTTPS origin, five-second edge caching only
for exact `/api/health/live`, and caching disabled with viewer auth/cookies/
query forwarding for other routes. Owner approved a staging benchmark; the
root CLI session must be refreshed to attach the temporary, MFA-conditioned
`aws/iam-staging-edge-temporary.json` policy to the operator. No CloudFront
stack or DNS/Vercel routing change has occurred yet. Cached liveness can hide
an outage for up to five seconds; live user traffic should not use this edge
before authenticated parity and client-IP handling are verified.

The root session was refreshed and verified. Operator executed the reviewed
two-resource CloudFront staging change set, but AWS rejected creation of the
distribution with HTTP 403: account verification is required before adding
new CloudFront resources. CloudFormation reached ROLLBACK_COMPLETE. Root
verified no staging distribution and no custom health cache policy remained,
then detached and deleted the temporary operator policy. The rollback stack
record remains as an audit artifact. No CloudFront edge exists or can be
benchmarked until AWS Support verifies the account. Live DNS, Caddy, Vercel
and RDS access were unchanged by this attempt.

After explicit owner authorization, AWS Support case `179179095800228` was
submitted via the signed-in web console on 12 October 2026 under Account and
billing / Account / Other Account Issues. Subject: “CloudFront account
verification required to create distribution.” It contains the 403 error and
CloudFront request ID, with no credentials or app data. Case status was
Unassigned immediately after submission. Wait for AWS to verify the account
before retrying CloudFront creation; direct staging Caddy remains live.

Stage 6C email checkpoint, 14 October 2026: with separate owner approvals,
the protected Preview sent one labelled support test and one reviewed Inquiry
Desk reply, both to `support@nodalx.in`. Support guards rejected invalid
Origin and client-selected recipient/HTML; the valid send returned Resend
acceptance ID `01a139e9-bde3-72f7-9ff8-e17c3f8340e9`. The outbound inquiry
`3e9daeb1-f46c-4735-a86e-ca62904afbf4` reached Contacted; RDS confirmed
one sent ledger row with provider ID/timestamp and one status event. Exact
test inquiry, ledger and event were deleted; source
`815f0b76-3050-4337-884f-504345ea12be` is disabled/count zero. Current
staging Secrets Manager version `e92ad26290d034a9107f572f9806c0cf` has
intake, support and outbound gates off; health 200 Caddy/RDS, contact 503.
Provider acceptance is confirmed; inbox delivery is not. Preview redeploy,
webhook/route matrix and Stage 6D operations checks remain before Production.
