# NODALxAI project memory

## Product

NODALxAI is an inquiry intake and follow-up desk for small businesses. It
captures inbound inquiries, preserves the original message, optionally applies
qualification/classification, and gives a human a clear next action.

The launch promise is operational clarity, not guaranteed conversion, delivery,
or autonomous sending.

## Current stack

- Frontend: React + TypeScript + Vite + Tailwind, `frontend/`
- Authentication: native Supabase Auth in the migrated local path; Firebase is
  legacy recovery only, not the approved target identity provider
- Database: Supabase is the approved pipeline source of truth; local migrations
  verified. Legacy Firestore data/source continuity still needs controlled migration
- Production frontend: Firebase Hosting, project `nodalxai-b9eb5`
- Target production API: Vercel + Supabase; `functions/` is legacy recovery/test
  code and must not be deployed while suspended
- Intake connector: guarded Google Apps Script, used only server-side
- Optional processing: configured external workflow (`MAKE_WEBHOOK_URL`)
- Local-only legacy backend: Express/WebSocket server, `backend/`
- Deployment config: `firebase.json`; Vercel files are alternate configuration,
  not proof that Vercel serves the production domain

## Non-negotiable rules

- Never commit secrets, customer exports, authentication hashes, or credentials.
- Do not add a payment method or enable Google Cloud billing without explicit
  owner approval while the Veo dispute is open.
- Do not deploy Functions while billing is suspended; the API currently returns
  503 and this is an acknowledged release blocker.
- Firestore server-owned fields include entitlement/tier, subscription state,
  API keys, quotas and usage. Client writes to those fields are forbidden.
- Native Supabase Auth is the approved target. One verified auth identity is one
  workspace. Preserve legacy Firebase UID ownership through trusted bindings;
  never match accounts by email or trust client-supplied workspace IDs. Do not
  introduce team roles or cross-user sharing without an approved design change.
- Every endpoint needs boundary validation, authentication where applicable,
  ownership authorization, rate limiting where it can spend or mutate, and tests.
- Preserve original inquiry text; do not log message contents, tokens, emails or
  provider credentials unnecessarily.
- Do not call a preview, mock or static example a live integration.
- Keep inquiry body text opaque. Surface blur/glass is allowed; text blur is not.
- Use semantic theme tokens: `bg-bg`, `bg-surface`, `bg-surface-hover`,
  `border-border`, `text-text-primary`, `text-text-secondary`,
  `text-text-tertiary`, `bg-accent`, `text-accent`.
- Do not discard unrelated uncommitted work. Inspect before changing or deleting.
- After every implementation, update this file (`AGENTS.md`): record what
  changed, new rules/constraints, verification run, and pending owner actions
  in the pipeline migration log below. Keep entries concise.

## Secrets and environment (Phase 1, 2026-10-06)

- Server-only variables are documented in root `.env.example`; real values go
  in gitignored `.env` files or the host secret manager. Never prefix server
  secrets with `VITE_` (Vite inlines them into the browser bundle).
- Apps Script secrets/PII live in Script Properties, not source:
  `GEMINI_API_KEY`, `OWNER_EMAIL`, `ALLOWED_ORIGIN`, `INTAKE_SECRET`.
- Gemini keys are sent via the `x-goog-api-key` header, never `?key=` URLs.
  Missing key fails closed to manual review; intake must not depend on AI.
- Never log provider response bodies, raw exception text returned to clients,
  or customer emails.
- Never share Make blueprint exports: HTTP module headers embed credentials.
- `scripts/scan-secrets.mjs` flags Google keys in Gemini/server contexts.
  Firebase web keys (`VITE_FIREBASE_API_KEY`) are public by design and exempt.

## Pipeline migration log (Website -> Make -> Supabase -> Dashboard)

| Phase | Status | Summary |
|---|---|---|
| 1. Security lockdown | Code done; owner reports keys revoked | Gemini key leaked via uploaded Make blueprint, not git (tracked + history scans clean). `appscript/InquiryPipeline.gs` moved to Script Properties, header auth, PII-free logs, generic errors, restricted CORS. Root `.env.example` lists server vars. Scanner pattern added. Literal key removed from `docs/Environment.md`. Key revocation not independently verified. Not run in live Apps Script. |
| 2. Supabase schema + RLS | Locally implemented and verified | Owner approved Supabase as sole target, native Supabase Auth and source-ID/hash dedupe. Migration 12 extends existing tenant inquiries, adds private credential-to-workspace source bindings and a service-only atomic ingestion RPC. Repeat source ID with same content returns existing row; changed content conflicts; same email/content with a new source ID remains legitimate. Original message/source identity immutable. 104 SQL assertions, DB lint and 24-way real local concurrent replay passed. No production schema changed. |
| 3. Make router + recovery | Backend verified locally; Make account setup pending | Durable website staging, opaque authenticated Make lease handoff, canonical transactional completion, replay/recovery/rate limits and Apps Script ContentService fix implemented. Default intake unchanged. Make login verified; original Inactive/Shared. Clone requires replacement webhook and was cancelled; no account edits/activation performed. |
| 4. E2E verification | Local E2E passed; deployed rehearsal pending | Synthetic website handler -> simulated Make worker -> actual Supabase -> native-auth dashboard API verified, including repeat customers and exact text. Real Make/Vercel/cloud round-trip remains unverified. |

Pending owner actions: verify secret stores and restricted replacement credentials,
confirm cloud Supabase project/region, prepare verified legacy identity/data
migration evidence, approve disabled source bindings and staged API/Make setup.
Apps Script deployment and uploaded blueprint removal remain separate owner actions.

Phase 2 constraints: content hashes are not unique. Source IDs must be stable
across retries and globally generated by the website, never based on email.
Only the backend hashes a high-entropy connector credential and calls ingestion;
Make never receives a Supabase service-role key. Source records default disabled,
derive ownership from private bindings and limit accepted intake to 60/minute.
No account linking by email, automatic legacy backfill, public intake cutover or
Firebase package deletion before verified replacement and recovery checks.
Owner key rotation is reported complete in chat but not independently verified.
Verification update: Functions ESLint passed. Three Apps Script tests had stale
fixtures after Phase 1 moved owner email into Script Properties; fixtures now
provide a synthetic `OWNER_EMAIL` rather than depend on a real address. No live
email/template code changed. Docker Desktop's executable is missing; local CLI
database verification is blocked until the owner repairs/starts Docker Desktop.
Subsequent Phase 2 step: owner restarted Docker; migration 12 applied locally.
Added database regression tests for source auth, tenant RLS, replay/conflict,
repeat customers, original preservation and rate limits, plus an opt-in real
local REST concurrency test. No frontend edits, public route cutover or cloud
resource creation. Final verification: SQL lint found no errors; Functions ESLint,
Functions unit tests, 73 default backend tests, backend WebSocket authorization,
frontend typecheck (no UI edits), secret scan and whitespace checks passed. Three
opt-in local tests are skipped by the default suite; all three were run explicitly
and passed (auth/tenant, processing/Make settlement, source concurrency).
Local Apps Script intake check remains unconfigured (missing
deployment URL/secret), so this is not a live website/Make cutover.

## Commands

Phase 3 step 1: migration 13 adds private transport staging (not a second inquiry
source of truth), service-only staging/claim/completion RPCs, 120-second leases,
8-attempt crash ceiling and 1000-pending/workspace backlog cap. Stable IDs and
original payload are saved before Make; Make only routes opaque IDs, not PII or
service credentials. Completion resolves stored source/payload server-side and
stores canonical inquiries transactionally. Retain failure rows for operator
recovery; no silent fallback/double write. Verification pending.
Phase 3 step 2: added opt-in public contact router and machine-authenticated
`/api/intake` claim/completion handlers. Legacy intake remains the default;
unknown mode fails closed. New mode requires a stable request key, exact original
text, distinct server source/Make credentials and explicit environment/network
approval. No Make or Google request is sent by website acceptance. Queue 202 is
durable acceptance, not canonical inquiry storage or email delivery. Updated local
API/Vercel routing and blank secret templates. Tests and release approval pending.
Phase 3 step 3: added service-only failed-delivery retry (same original/source ID,
no stored-row retry) and removed unsupported Apps Script TextOutput.setHeaders.
Apps Script cannot set arbitrary HTTP status/CORS headers through ContentService;
keep it server-to-server, use body acknowledgements and API-layer origin controls.
No public recovery endpoint, fallback cutover or live Apps Script deployment.
Phase 3 step 4: added router boundary regressions for durable acknowledgement,
exact originals, identity injection, configuration gates, redacted failures,
opaque lease callbacks and the Apps Script ContentService fix. Local migration
13 applied; no cloud migration. Make agent documentation remains independent
of parent code. Validation in progress; do not call the scenario live yet.
Phase 3 step 5: added a database-global 120/minute authenticated Make router
limit (claim/completion), separate from per-source website limits. The backend
inquiry-list notice now distinguishes new Make intake from unmigrated Sheet
history; no UI code changed. This does not replace public edge/WAF abuse controls.
Phase 3 step 6: added SQL regressions for durable acceptance, replay, lease fencing,
failure ceiling/operator recovery and rate limiting. Added opt-in local website
handler -> simulated Make worker -> actual Supabase -> authenticated dashboard
API verification with exact text and repeat customers. This is NOT a live Make
account/browser test; synthetic fixtures are cleaned without resetting the DB.
Phase 3 verification update: 128 SQL assertions and local native-auth dashboard
handoff passed. Apps Script deployment instructions now correctly require a
server-side connector, not direct frontend access. Waiting for the owner's private
Make editor URL before any account-specific changes; no live scenario is active.
Phase 3 operations step: documented acknowledgement meanings, operator-only
recovery, privacy-safe monitoring, pause/rollback, edge abuse protection and
explicit notification/history/identity parity gates in intake-recovery.md.
New mode sends no confirmation emails; do not cut over silently from legacy
email behavior. Live owner approval/account configuration still required.
Phase 3 boundary-hardening step: explicit acknowledgement field whitelists prevent
unexpected database payload fields leaking through website/Make responses; invalid
lease packet shapes fail closed. Owner supplied a private Make editor URL; the
delegated agent is inspecting access with disabled-duplicate-only authorization.
No activation, paid-resource change or real customer tests are authorized here.
Phase 3 operations check step: check-intake now respects selected provider and
never probes Apps Script in Make/Supabase mode. Reports config readiness without
secret values; explicitly refuses to label config-only checks as live health.
Synthetic staged E2E and account-specific verification remain required.
Make review closure: delegated agent did not finish/artifact and was stopped;
parent took over, opened the supplied editor and confirmed sign-in is required
in Codex's browser. Wrote make-intake-router.md and its static contract regression.
User must sign in privately; no credentials entered or scenario edited. Parent
completed code review and 128 SQL checks, backend lint, four local integrations,
legacy unit tests/typecheck; final combined suite recorded below. Live deployment,
cloud source binding, notification parity and approved Make cadence remain gates.
Verification repair: ESLint flagged an empty configuration-validation catch;
made its failed state explicit. The health command correctly reports legacy
credentials missing in this shell; no upstream request was performed.

```sh
cd frontend && npm run build
cd frontend && node --test pages/inquiryDesk.test.ts
cd functions && npm run lint && npm test
cd backend && npm run test:ws-auth
node scripts/scan-secrets.mjs
```

Phase 3 final verification: default backend suite passed 83 tests with four local
opt-ins skipped; all four opt-ins passed separately against actual local Supabase
and a simulated Make consumer. 128 SQL assertions, database lint, backend ESLint,
Functions lint/38 tests and frontend typecheck passed. No real Make execution.
Make login follow-up: owner signed in privately; original scenario is Inactive
and Shared. Clone requires a replacement webhook; cancelled without creating
access or modifying original. Prepare a separate disabled scheduled router only
after verified staging deployment/cloud source binding and secure credentials.
Keep activation, real tests, notification parity and billing separately approved.

Cloud setup step — 6 October 2026: owner signed up to Supabase. Created NodalX
organization on Free ($0/month), with no payment method/upgrade. Prepared
nodalx-staging creation form in Mumbai with Data API enabled, automatic new-table
exposure disabled, automatic RLS enabled. Project NOT created yet: owner must
privately enter/save the database password and submit creation. No credentials
handled, migrations applied, GitHub access granted or live intake changed.

Cloud verification step — 6 October 2026: owner created nodalx-staging, project
ozovfbwhcvbgpgrxxjcj, in NodalX. Dashboard confirms Healthy, South Asia (Mumbai),
Nano compute, no migrations and no GitHub repository connected. Public API origin
is https://ozovfbwhcvbgpgrxxjcj.supabase.co. Project creation is complete; schema
deployment is NOT. Secure owner CLI authentication and reviewed migration dry-run
are next; do not capture passwords/tokens or switch the live website yet.

Cloud schema step — 6 October 2026: verified owner CLI access, linked only
ozovfbwhcvbgpgrxxjcj (nodalx-staging, Mumbai), reviewed dry-run and applied all
14 versioned migrations successfully. No seeds, custom roles or Vault secrets
were pushed; no customer records/backfill, live intake switch, billing, Vercel
deployment or Make activation. Cloud lint/history verification is next; native
Auth redirect/SMTP, server secrets and disabled source bindings remain pending.

Cloud boundary review: all 36 public/private tables have RLS; anonymous/browser
roles cannot stage/claim intake, service_role can claim. Advisor found the cloud
generated public.rls_auto_enable event-trigger helper executable by browsers.
Added conditional migration 15 to revoke those grants without disabling the
automatic RLS trigger, plus rollback-only boundary regressions. The local CLI
container does not mount migration files for test includes; removed that fixture
include and verify optional-helper grants directly in cloud after deployment. Authenticated
tenant SECURITY DEFINER RPCs are intentional and must retain verified identity
checks; do not blindly revoke all RPCs to silence advisor warnings.

Cloud hardening verified: migration 15 applied to staging after 131 local SQL
assertions passed. Cloud query confirms anon/authenticated cannot execute the
automatic RLS helper and its event trigger remains enabled. All 36 application
tables retain RLS. Initial cloud lint and migration reconciliation passed;
authenticated SECURITY DEFINER advisor notices remain expected for intended
identity-checked RPCs, not blanket proof of flawless security. No live E2E yet.

Vercel staging step — 6 October 2026: verified linked nodalx-frontend project and
CLI account. Existing preview variables are legacy Firebase/App Script settings.
Preparing native Supabase public URL/key and disabled automation gates restricted
to Preview/main, not Production. SUPABASE_PUBLISHABLE_KEY added to server template
because authorizeWorkspace requires it separately from the service-role key.
Do not pull/print secrets; do not grant Make a database service-role credential.
Preview public API base must be empty to use same-origin handlers rather than
the inherited legacy endpoint. Secret configuration/deployment verification pending.

Vercel checkpoint: CLI environment writes failed via stdin and explicit-value
modes; none reported success. Dashboard is at sign-in; owner must log in privately.
No preview deployment, secret entry, gate activation or Production change made.
Prepared docs/runbooks/vercel-supabase-staging.md with branch-restricted variable
mapping, exact Auth callback/protection/email gates and staged verification.

Preview scope correction — 6 October 2026: dashboard login verified. No variable
saved: main is Vercel's Production branch, and nodalx-staging must first exist in
the connected Git repository. Owner explicitly approved creating/pushing that
branch with current migration changes after checks. Do not merge/promote main.
Validation passed: frontend typecheck/build, 83 backend tests (four local opt-ins
skipped), Functions lint/38 tests (40 gated tests skipped), 301-file working-tree
secret scan and diff checks. Prior 131 SQL assertions/cloud lint remain recorded.
Publish only allowed source files; keep local credentials/cache/builds excluded.

Branch preparation: created local nodalx-staging. Staged scanner passed, but
cached whitespace check caught two previously untracked-file issues; corrected
trailing whitespace/extra EOF blank line only (no SQL semantic change). GitHub
lookup encountered DNS failure; retry the authorized push after checks and report
actual remote verification rather than assuming branch publication.

Staging publication checkpoint: owner-approved nodalx-staging pushed; remote
verified commit eda17b7429537163627925db1c6e172ba6c395d3. main remains untouched.
Dashboard verified SUPABASE_URL and VITE_SUPABASE_URL in Preview/nodalx-staging
only. Corrected URL1 naming to required SUPABASE_URL. Skipped default Production
redeploy prompts. CLI env/deployment inspection still errors; do not claim a
verified preview deployment. Owner must privately save publishable keys and
service-role credential in this branch scope. API base override, disabled gates,
source/machine tokens, Auth redirects and deployment verification remain pending.
No new secret entered or expanded privileges, no Make activation or live test.

Owner key-entry checkpoint — 6 October 2026: metadata confirms service-role key
saved as Secret in Preview/nodalx-staging; its value was not revealed/validated.
Owner saved publishable key while form still targeted Production; moved that
new Config variable to Preview/nodalx-staging and verified success without any
redeploy. Prepared VITE_SUPABASE_PUBLISHABLE_KEY Config form with staging-only
scope BEFORE handoff; owner must paste only the sb_publishable_ client key.
No server key may enter a VITE_ variable. Remaining gates/API override/deployed
verification remain pending; no Production redeploy or Make activation.

Preview boundary step — 6 October 2026: all three Supabase key names now show
Preview/nodalx-staging metadata; secret value not revealed or verified. Vercel's
creation form rejects an empty API-base override. Added tested same-origin
sentinel resolver in API transport only (no UI features), preserving default
and explicit endpoint behavior. Bulk safety settings remain unsaved until this
option is entered and staging-only scope verified; no Production redeploy.

Same-origin transport follow-up: updated the remaining direct-fetch consumers
(notifications, Sheets verification, upload transport) to use the same resolver,
so the new sentinel cannot form literal same-origin/api paths there. No layout,
UI semantics, endpoint ownership or feature gates changed.

Preview safety settings verified — 6 October 2026: saved eight Config variables
for Preview/nodalx-staging only: API base same-origin, Google OAuth false, intake
provider make-supabase/environment staging and intake/Make/processing network
gates false. Creation disallows empty values; all direct API-base consumers now
use the tested resolver. 18 frontend library tests, typecheck/build, working-tree
secret scan and whitespace checks passed. Publishing transport fix on the approved
staging branch; no production promotion, automatic sending or new provider calls.
Remaining: verified updated Preview deployment, exact Auth callbacks/SMTP review,
owned source binding/private source and machine tokens, approved synthetic E2E.

## Release gates

Before describing a change as complete, run the relevant build, lint, tests,
secret scan and `git diff --check`. List skipped live checks. Hosting can be
released independently; Functions, rules and indexes require separate review.

## Source of truth

- Product scope: `docs/system-design.md`
- Runtime architecture: `docs/Architecture.md`
- Permissions: `docs/permissions.md`
- API contract: `docs/api-conventions.md`
- Remaining work and blockers: `docs/REMAINING-WORK.md`
- Historical decisions: `docs/Decisions.md` and `docs/decisions/`
