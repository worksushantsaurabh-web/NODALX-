# NodalX LLM mind: compact operating context

> 9 October: app database is **AWS RDS** (`nodalx_app`); Supabase
> `ozovfbwhcvbgpgrxxjcj` is **Auth identity only**. Production `nodalx.in`
> serves the RDS build with live website intake enabled. Direct intake is active;
> Make is optional (historical mandatory-Make sequence below). **Update this
> file and `AGENTS.md` after every passed/successful implementation.**

Updated: 9 October 2026. `AGENTS.md` holds authoritative rules and the dated
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
   only after promotion + the labelled test.
3. Owner housekeeping: delete the two rehearsal emails in `support@nodalx.in`,
   rotate the RDS password (one CLI error echoed it into a transcript),
   regenerate the Deployment Protection bypass token printed in CLI debug,
   keep Vercel SSO/protection as-is.
4. Put the real hosted Supabase service-role key in gitignored `.env.local`
   (never chat), run `npm run test:intake:hosted`, then convert the remaining
   three opt-in test files using the same dual-mode pattern.
5. Follow the release roadmap order; every production/network/spend step
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
