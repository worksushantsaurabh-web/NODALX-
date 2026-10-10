# NodalX: IDE continuation handoff

> 7 October: [the release roadmap](release-roadmap-2026-10-07.md) supersedes this
> handoff's mandatory-Make execution order. Target: Website -> secured backend ->
> Supabase -> Dashboard. Use AGENTS.md for later verification records; cloud
> information below is a historical checkpoint, not a fresh environment audit.

Updated: 6 October 2026 (Asia/Kolkata).

## 1. Start here

You are continuing an existing migration, not starting a new app. Act as a
staff-level backend/automation engineer. Inspect the repository before changing
anything. This document is context, not proof that every integration is live.

Immediate objective: securely verify the staging backend, provision the owned
intake source, prepare a separate disabled Make router, and rehearse:

**Website → durable intake staging → Make → canonical Supabase → Dashboard.**

Do not redesign the UI, add AI features, promote production, or remove legacy
dependencies in this continuation. Native Supabase Auth and Supabase database
are the approved target; the Firebase account is suspended.

Read these files first, in this order:

1. `AGENTS.md` — repository rules and latest implementation checkpoints.
2. `docs/LLM-MIND.md` — compact mental model and guardrails.
3. This handoff.
4. `docs/runbooks/supabase-migration-log.md` — historical evidence and limitations.
5. `docs/runbooks/vercel-supabase-staging.md` — actual staging configuration.
6. `docs/migration/make-intake-router.md` and `docs/migration/intake-recovery.md`.
7. `docs/runbooks/supabase-migration-instructions.md`, route matrix and client-write audit.

Some older documents still recommend AWS or describe Firebase Hosting as current.
Those are historical alternatives, not authorization to provision AWS or restore
Firebase. Reconcile them against the latest Supabase/Vercel checkpoints.

## 2. Product intent and previous work

Public brand: **NodalX**, not NodalX AI. Historical folder/repository names may
still contain AI; do not rename infrastructure identities casually.

NodalX is a small-business inquiry intake and follow-up desk. It should preserve
incoming requests, make their status visible, support optional classification,
and help a human choose a next action. The promise is operational clarity and
less manual processing, not guaranteed revenue or autonomous sending.

Earlier owner requests included dashboard alignment, reducing non-working
integrations, import/processing usefulness, Google Sheets intake, professional
confirmation emails, duplicate protection, intermittent 502 repairs, subscriptions,
and eventually moving all Firebase dependencies away. Those are context; the
current priority is backend continuity and secure data flow, not UI polish.

The legacy Apps Script path previously had deployed branded emails and verified
duplicate receipts. Receipt/timeout recovery was implemented for intermittent
Google failures. Do not silently discard this working behavior during cutover.
The new Make/Supabase intake path currently has no equivalent confirmation email.

## 3. Repository and release boundaries

Local repository:

```text
/Users/sushantsaurabh/Desktop/NODALXAI
```

GitHub: https://github.com/worksushantsaurabh-web/NODALX-

- Current working branch at handoff: `nodalx-staging`.
- Latest committed migration/transport revision: `1b8d694`.
- Earlier migration publication: `eda17b7`.
- Production/main baseline in recent inspection: `7a49c77`.
- Owner approved creating/pushing `nodalx-staging` after checks, not merging main.
- Three documentation files have existing uncommitted changes: `AGENTS.md`,
  `docs/runbooks/supabase-migration-log.md`, and
  `docs/runbooks/vercel-supabase-staging.md`.
- This handoff and mind file are new local documentation. Inspect `git status`;
  preserve all unrelated work. No commit or push was made for these new documents.

Production domain: https://nodalx.in
Vercel project: `nodalx-frontend`, team `worksushantsaurabh-webs-projects`.
Project ID: `prj_SbAfNZNK4gBswh6ppCtY4lOhrUo1`.

Production and original Make scenario were not changed by this staging work.
Do not infer current production health from a successful staging build.

## 4. Current verified cloud setup

### Supabase

- Staging project: `nodalx-staging`.
- Project ref: `ozovfbwhcvbgpgrxxjcj`.
- Origin: https://ozovfbwhcvbgpgrxxjcj.supabase.co
- Region: Mumbai (`ap-south-1`); Free organization, Nano compute observed.
- Versioned migrations 1–15 were applied remotely in the earlier setup.
- Cloud reconciliation/lint completed at that checkpoint.
- All 36 application tables had RLS at the cloud audit checkpoint.
- Migration 15 restricted the platform-generated automatic-RLS helper from
  PUBLIC/anon/authenticated while preserving its event trigger.
- No historical customer backfill or email-based account linking was performed.

### Vercel preview

Deployment `AqKK8D6HFM1qbCssWLaioKfdrAA7` was Ready from `nodalx-staging`
commit `1b8d694`. Landing page and sign-in modal loaded.

Use the stable branch alias for authentication rehearsal:

```text
https://nodalx-frontend-git-nod-04bf63-worksushantsaurabh-webs-projects.vercel.app
```

The verified disposable deployment URL was:

```text
https://nodalx-frontend-6rv3l8rc8-worksushantsaurabh-webs-projects.vercel.app
```

Preview protection stays enabled. Disposable deployments can change; inspect
Vercel before relying on an old URL. Do not promote or change the production domain.

## 5. Authentication: latest owner confirmation

Native Supabase Auth is registered behind the provider-neutral session seam:

- `frontend/lib/session/core.ts`
- `frontend/lib/session/supabaseAdapter.ts`
- `frontend/lib/session/index.ts`
- `frontend/components/SignInModal.tsx`

Email/password signup/sign-in and callback/recovery are implemented. Google and
phone sign-in are not configured; Google is disabled in this staging preview.
Confirmed native identities access the backend, which bootstraps an owned
workspace. Never derive ownership from an email or client workspace ID.

Owner approved and the Supabase dashboard verified exactly two redirect URLs:

```text
https://nodalx-frontend-git-nod-04bf63-worksushantsaurabh-webs-projects.vercel.app/auth/callback
https://nodalx-frontend-git-nod-04bf63-worksushantsaurabh-webs-projects.vercel.app/auth/callback?flow=recovery
```

No wildcard was added. Site URL remained `http://localhost:3000`. Custom SMTP
was disabled at inspection. Do not claim general email delivery/recovery readiness.
Use the stable alias: signup derives its callback from the current browser origin.

**Latest owner report:** “staging account verified.” This means the owner reports
completing the app-account verification instructions. It is not the same as a
Supabase dashboard login, and it is not independent proof of backend workspace
binding or cross-tenant authorization. Verify those next. Do not create a second
account or request a password, confirmation link, access token, or OTP in chat.

## 6. Environment settings and secret boundaries

Vercel metadata confirmed the following only in Preview / `nodalx-staging`:

| Variable | Setting |
| --- | --- |
| `SUPABASE_URL` | Staging Supabase origin above |
| `VITE_SUPABASE_URL` | Same staging origin |
| `SUPABASE_PUBLISHABLE_KEY` | Owner-saved public client key |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Same public client key |
| `SUPABASE_SERVICE_ROLE_KEY` | Owner-saved server-only Secret |
| `VITE_API_BASE_URL` | `same-origin` |
| `VITE_SUPABASE_GOOGLE_ENABLED` | `false` |
| `INTAKE_PROVIDER` | `make-supabase` |
| `INTAKE_ENVIRONMENT` | `staging` |
| `ALLOW_INTAKE_NETWORK` | `false` |
| `MAKE_INTAKE_ENABLED` | `false` |
| `MAKE_PROCESSING_ENABLED` | `false` |
| `ALLOW_PROCESSING_NETWORK` | `false` |

Secret values were not retrieved or independently validated. Metadata does not
prove the public/server keys match the project. Validate through safe operations.

Still required privately: `INTAKE_SOURCE_TOKEN`, `MAKE_INTAKE_TOKEN`, and the
owned source binding. Tokens must be distinct, high-entropy, and match backend
validation. Do not reuse Apps Script or processing credentials.

Vercel rejects blank values in its environment creation UI, so the tested
`same-origin` sentinel resolves requests to the current preview origin. The
shared resolver and all direct API-base consumers were updated; do not replace
this with a hardcoded disposable host or literal `same-origin/api/...` URL.

## 7. Actual data-flow architecture

The conceptual pipeline is Website → Make → Supabase → Dashboard. The reliable
implementation first saves a **private durable transport queue** in Supabase so
a Make outage cannot discard an accepted request. This queue is not a second
canonical inquiry store.

```text
Browser: POST /api/contact + stable Idempotency-Key
    ↓
Server: validate original payload and server-only source credential
    ↓
Supabase: stage_source_inquiry → private durable delivery → HTTP 202
    ↓
Make: POST /api/intake?action=claim with distinct machine Bearer credential
    ↓
Opaque claim: deliveryId + leaseToken + sourceInquiryId (no customer body)
    ↓
Make: POST /api/intake?action=complete with deliveryId + leaseToken
    ↓
Server/Supabase: complete lease and persist canonical public.inquiries atomically
    ↓
Dashboard: native authenticated API reads only the verified user's workspace
```

Key code:

- `api/contact.mjs`, `server/intake-router.mjs` — website intake/provider gate.
- `api/intake.mjs` — machine claim/complete endpoint.
- `api/migration.mjs`, `server/supabase-workspace.mjs` — workspace API.
- `server/supabase-account.mjs` — verified Auth and profile/workspace boundary.
- `supabase/migrations/` — canonical schema, RLS, durable queue and recovery.
- `vercel.json` — same-origin API rewrites and function deployment settings.

Acknowledgements are deliberately different:

- Website 202: durable acceptance, NOT canonical storage/email delivery.
- Claim 200 idle: no work available.
- Claim 200 claimed: a lease exists, NOT a stored dashboard inquiry.
- Complete 200 stored: canonical persistence acknowledged.
- Dashboard visibility must be verified against that same canonical ID/workspace.

## 8. Identity, duplicates and recovery

- One verified native Auth identity owns one workspace; no team/cross-user sharing.
- Preserve legacy Firebase UID ownership only through trusted migration bindings.
- Never join identities/workspaces by email or client-editable metadata.
- Unique `(workspace_id, source_inquiry_id)` plus server/database content hash.
- Identical retries return the same record; changed payload with the same source
  ID conflicts without overwriting. A genuinely new request from the same email
  is legitimate. Neither email nor content hash is globally unique.
- Preserve exact original inquiry text and source identity; analysis never replaces it.
- Private source binding resolves ownership. Browsers/Make cannot choose a workspace.
- Machine lease: 120 seconds; eight expired claims lead to observable failure.
- Per-source acceptance limit: 60/minute. Router successful calls: 120/minute.
- Recovery is service-only `retry_intake_delivery(uuid)`, not a public Make route.
- Never disguise failure by generating a new website request ID.

## 9. Make account status

Private original scenario:
https://us2.make.com/2623251/scenarios/5812512/edit

Its observed name was **NodalX Inquiry Classification Pipeline**, Inactive and
Shared. The account inventory also showed **Integration Webhooks, Google Gemini AI**.
No dedicated opaque claim/complete intake router was present at the latest review.
The previous clone attempt required a replacement webhook and was cancelled.
No original scenario was modified, activated or executed by this migration.

Prepare a separate disabled scheduled router, not a clone retaining legacy
Gemini/Airtable/regex/Sheets modules. Follow `docs/migration/make-intake-router.md`:

1. HTTP v4 POST claim, body `{}`, parsed JSON, redirects disabled, timeout 15s.
2. Filter `status == claimed`; idle ends normally.
3. HTTP v4 POST complete, mapping only `deliveryId` and `leaseToken`.
4. Dedicated secure machine credential; no service-role key and no PII in Make.
5. Explicit error branches/retry behavior, confidential data/log settings.

Do not assume sub-minute scheduling is available on the owner's plan. Review
operations/cadence without buying an upgrade. Scenario activation and real or
labelled cloud test writes require separate owner approval.

Protected Vercel preview access is a separate layer from the machine Bearer token.
Make cannot follow an SSO redirect and claim success. Do not share project-wide
Vercel bypass credentials casually or put them into exported blueprints.

## 10. Verification evidence and current access blocker

Latest local rerun:

- 83 default backend tests pass; four opt-in local integrations skipped there.
- All four opt-ins run separately and pass against actual local Supabase, with
  a simulated Make consumer (NOT the live Make account).
- 131 SQL assertions across eight files pass.
- API/server boundary lint, Functions lint, backend syntax and secret scan pass.
- Earlier transport revision passed frontend build/typecheck and 18 library tests.
- Documentation-only changes afterward passed `git diff --check` and secret scan.

Cloud API is not yet verified: unauthenticated requests returned Vercel SSO 302.
The agent's installed Vercel CLI 59.1.3 failed account/deployment-targeted commands
with a runtime error; full-URL curl returned SSO without usable authenticated
access. A cache updater issue was suppressed with `NO_UPDATE_NOTIFIER`, not a
repair to the auth problem. Browser API navigation was also blocked by the client.

**Latest owner report:** local `NO_UPDATE_NOTIFIER=1 vercel whoami` succeeds.
This supersedes any claim that the owner's CLI is necessarily broken/logged out.
Retry safe staging probes in the new IDE's execution environment. Owner approved
staging-only authenticated health, auth-denial and disabled-intake checks. Do not
disable deployment protection, expose secrets, or treat SSO HTML as API success.

## 11. Continue step by step

### A. Re-establish facts, not assumptions

Inspect working tree, branch, deployment source/target, current variable scopes,
Supabase project ref and migration status. Keep credentials private. Confirm
current schema with non-destructive tooling; do not reset cloud databases.

### B. Complete protected-preview API checks

Use the owner's working authenticated CLI or another explicitly approved access
mechanism. The CLI can create/reuse an automation bypass credential: inspect its
scope and avoid broader persistent access than approved. No debug logs of secrets.

- GET `/api/health/live`: expect application JSON `status:alive`, not SSO HTML.
- GET `/api/user/profile` without app Auth: expect application 401.
- POST `/api/intake?action=claim` with `{}` while disabled: expect configured
  fail-closed 503; this must not claim work or call Make.
- Verify native authenticated profile/workspace reads with the owner's staging
  session privately, including data source and tenant identity binding.
- Readiness requires actual database-backed checks; liveness alone is insufficient.

Record expected/actual statuses and redacted codes, not bodies containing PII.
Do not submit a website inquiry merely to verify disabled configuration.

### C. Provision the owned source safely

Verify the reported staging account and server-created workspace. Obtain explicit
approval before introducing connector access. Privately provision distinct source
and machine tokens in proper secret managers; store only source hash in the private
binding. Keep binding disabled until approved rehearsal. Never use email lookup
or a fabricated workspace ID. Review migrations/contracts rather than invent SQL.

### D. Prepare Make, leave it disabled

Create/configure the separate router using the validated staging origin and
secure machine credentials. Resolve Vercel protection access separately and
review secret scope. Do not change the legacy shared scenario or activate a poller.

### E. Owner-approved synthetic cloud E2E

After explicit approval for staging gates, Make execution and labelled test data:

1. Submit one labelled synthetic inquiry with a stable request ID.
2. Verify durable acceptance, Make lease and canonical storage, then dashboard ID.
3. Replay identical request: same ID, duplicate acknowledgment, one canonical row.
4. Changed payload/same request ID: conflict and unchanged original.
5. New request ID/same email: legitimate repeat inquiry.
6. Verify cross-tenant denial and relevant timeout/recovery behavior safely.
7. Confirm which emails/notifications are intentionally sent or absent.
8. Pause gates/scenario after rehearsal unless continued operation is approved.

Do not use real customer content, emit secrets/lease tokens, or delete test data
without identifying it and obtaining appropriate approval. Never reset shared DBs.

### F. Production is a separate decision

Before proposing cutover, address email parity, history migration, identity
continuity, abuse controls, provider privacy/cost, observability and rollback.
Do not remove Firebase packages/config until replacement parity is demonstrated.
No Google/Firebase billing changes, AWS provisioning or new AI service activation.

## 12. Useful validation commands

Run from the repository root. Opt-ins are deliberately local-only; do not adapt
them to a cloud URL or customer database.

```sh
git status --short
git branch --show-current
npm run test:intake
npm run test:supabase
TEST_LOCAL_SUPABASE=true TEST_LOCAL_PROCESSING=true TEST_LOCAL_SOURCE_INTAKE=true TEST_LOCAL_INTAKE_E2E=true node --test tests/*local.test.mjs
npm --prefix functions run lint
./functions/node_modules/.bin/eslint api/*.mjs server/*.mjs --no-eslintrc --env node,es2022 --parser-options '{"ecmaVersion":2022,"sourceType":"module"}' --rule 'no-unused-vars:error' --rule 'no-undef:error'
for file in api/*.mjs server/*.mjs; do node --check "$file" || exit 1; done
npm --prefix frontend run build
node --test frontend/lib/*.test.ts
node scripts/scan-secrets.mjs
git diff --check
```

Docker must be running for local Supabase tests. Prefer repository-pinned tooling.
Functions lint/tests are legacy regression checks, not permission to deploy them.
After each implementation step, update `AGENTS.md` and the migration log with
actual checks, skipped live checks, owner actions and remaining release gates.

## 13. Copy-paste prompt for the next IDE

> Read AGENTS.md, docs/LLM-MIND.md and docs/runbooks/nodalx-ide-handoff.md first.
> Continue NodalX's staging-only Supabase/Vercel migration as a staff backend and
> automation engineer. Owner reports the staging app account is verified and
> local vercel whoami succeeds. Exact Auth callbacks are saved. Start by reviewing
> uncommitted documentation and retrying owner-approved protected-preview health,
> native-auth denial and disabled-intake checks. Do not disable protection or
> expose tokens. Verify the staging identity/workspace before proposing source
> binding and dedicated disabled Make router setup. Do not touch UI, activate
> Make/AI, submit customer data, provision paid resources, merge main or promote
> production. Obtain explicit approval for new connector access, gate activation
> and synthetic cloud writes. Preserve original messages, source-ID idempotency
> and tenant isolation. Run relevant lint/tests and update AGENTS.md and migration
> log after each implementation. Clearly distinguish local simulation, owner
> reports and independently verified cloud results.
