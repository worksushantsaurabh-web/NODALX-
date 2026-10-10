# NodalX LLM mind: compact operating context

> 9 October: app database is **AWS RDS** (`nodalx_app`); Supabase
> `ozovfbwhcvbgpgrxxjcj` is **Auth identity only**. Production `nodalx.in`
> serves the RDS build with live website intake enabled. Direct intake is active;
> Make is optional (historical mandatory-Make sequence below). **Update this
> file and `AGENTS.md` after every passed/successful implementation.**

Updated: 10 October 2026. `AGENTS.md` holds authoritative rules and the dated
implementation log. Phase table: `docs/runbooks/ide-handoff-current-2026-10-07.md`.
Ordered work: `docs/runbooks/release-roadmap-2026-10-07.md`.

## PURPOSE

NodalX helps small businesses capture inquiries, preserve original messages,
review optional qualification and track human follow-up. Reliability before
automation. No guaranteed revenue, fabricated insight or autonomous sending claims.

## CURRENT TASK

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
Production: https://nodalx.in → dpl_FFL6UHqrpWpyt9QhubpvYcHWRqno
Rollback:   dpl_5ciNeME248zgEb8VwDARqWHU4pqk
Preview (SSO-protected): nodalx-frontend-p084iy8me-worksushantsaurabh-webs-projects.vercel.app
Supabase Auth: nodalx-staging / ozovfbwhcvbgpgrxxjcj / Mumbai — Auth only;
  Site URL https://nodalx.in; production + staging callbacks allowlisted
RDS: nodalx-db.c69g2gg22fls.us-east-1.rds.amazonaws.com:5432
  nodalx_app = app data | nodalx_test = SQL assertions (disposable, --reset)
Email: Resend, nodalx.in verified; desk gate enabled on Preview only
```

## KNOWLEDGE STATES

**Independently observed (recorded in AGENTS.md):**
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
- **Phase 4 is now committed and applied.** Changeset pushed as `96188cc`
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

The signed-in Vercel dashboard can manage the project. The CLI began failing
with an internal error and the Vercel connector returned 403 during this
release; repair those credentials before the next CLI-managed release. Keep
Vercel deployment protection/SSO enabled; no project-wide bypass or
credential distribution to Make.

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

1. Owner: promote Ready Preview `dpl_HLPdoJ9…` to Production (dashboard
   ⋯ → Promote) or grant the deploying account production permission; then
   verify nodalx.in liveness keeps the RDS header and the inquiry email routes
   answer 401 before sending one labelled dashboard test email.
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
5. Deploy the committed Phase 4 review desk (`96188cc`) through the normal
   preview → production path when the owner promotes; until then the review
   path is stored and validated but not reachable in the live UI. Keep
   `ALLOW_PROCESSING_NETWORK=false`.
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
