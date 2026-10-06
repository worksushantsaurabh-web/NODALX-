# NodalX: Firebase retirement and Supabase migration instructions

Prepared: 5 October 2026.

## How to use this document

Give this entire document to your coding agent in the IDE containing the project.
It is an implementation brief, not evidence that migration has happened.
Target architecture: **Vercel + Supabase**, keeping the existing Google Sheets
and Apps Script inquiry flow. Confirm this choice with the owner before cloud
setup; local, provider-neutral preparation can proceed first.

Act as a senior developer. Implement in small, reviewable phases. Inspect the
actual checkout before editing, create a plan, and report evidence at each gate.
Do not just uninstall Firebase and replace broken features with mock data.
If provider access is missing, complete independently testable local work and
report the specific owner action needed. Never invent a passing live test.

## 1. Project context and desired outcome

NodalX is an inquiry intake, follow-up and business-data processing desk for
small businesses. It should help users capture original inquiries, review
source quality, import business records, track processing and choose a next
action. It must not promise guaranteed conversions or autonomous sales sending.

The owner reports that the Firebase/Google Cloud project is suspended. Previous
verification established Vercel hosting for `nodalx.in`, a working Apps Script
intake and branded confirmation emails. Reverify these facts before releasing.

Observed in this checkout:

- `api/contact.mjs` and `server/contact.mjs` implement independent Vercel intake.
- `appscript/nodalx-intake.gs` is the canonical Sheet intake/email script.
- Firebase still supplies frontend authentication and direct Firestore writes.
- `functions/index.js` and `functions/lib/` implement most workspace services,
  Firestore transactions, triggers, scheduled processing and billing logic.
- `backend/` is a separate Express/WebSocket development backend, not proof of
  a deployed production API.
- Root `vercel.json` forwards non-contact `/api/*` requests to the legacy
  Firebase site. A new login provider alone will not fix those endpoints.
- `.vercelignore` allowlists only the existing contact server files; new API
  files will not deploy until this allowlist is deliberately updated.
- An AWS intake pilot and an AWS migration document exist. Neither constitutes
  a replacement authentication, workspace database or processing service.
- Historical stack/test notes in `AGENTS.md` and other docs are partly stale.
  Preserve their safety rules; update factual statements using new evidence.

## 2. Non-negotiable boundaries

1. Follow all applicable `AGENTS.md` instructions. Preserve unrelated changes.
2. Do not enable Google Cloud billing, deploy suspended Functions, add payment
   methods, provision paid services or change DNS without separate approval.
3. Do not export production users/customer data, send test emails or mutate live
   Sheets without specific owner approval. Use synthetic local/staging fixtures.
4. Never commit secrets, credentials, identity exports, password hashes or
   customer records. Use ignored private files or provider secret stores.
5. Keep subscription tiers, entitlements, quotas, API keys and identity mapping
   server-owned. Preserve existing plan limits; do not invent new prices.
6. Preserve stable workspace ownership. Never authorize access by matching
   email, trusting a client `workspaceId`, or trusting writable user metadata.
7. Do not remove Firebase packages/configuration until every retained runtime
   dependency has a tested replacement or an explicitly approved retirement.
8. Do not commit, push, deploy or delete cloud resources merely because this
   brief describes a future release. Obtain the relevant owner authorization.

## 3. Target service boundaries

| Responsibility | Target |
| --- | --- |
| Website and domain | Existing Vercel project and `nodalx.in` |
| Login, verification, password recovery | Supabase Auth |
| Workspace records and transactions | Supabase PostgreSQL |
| Uploads and generated artifacts | Private Supabase Storage |
| Same-origin browser API | Reviewed Vercel handlers or a verified server proxy |
| Long-running processing | Durable queue plus separately approved worker runtime |
| Existing public inquiry confirmation | Existing guarded Apps Script connector |
| Subscription enforcement and webhook handling | Server-side authenticated services |

Keep one documented deployment boundary. Do not blindly copy Express into a
serverless handler or assume Node libraries run unchanged in Edge Functions.
Choose compatible runtimes after inspecting existing dependencies.

## Phase 1 — Audit and create safe seams

- Inspect manifests, lockfiles, rules, indexes, routes, triggers, schedulers,
  environment examples, deployment files and current uncommitted changes.
- Build a route matrix: method/path, caller, authentication, ownership rule,
  request/response contract, datastore, external side effect and replacement.
- Include inquiries/customers, profiles, flows, connectors, notification
  settings/tests, API keys, onboarding, uploads/analysis, job history/results,
  recipes, automation, usage, billing checkout/webhooks and health checks.
- Inventory all direct browser Firestore writes, including signup profiles,
  `FeedbackWidget.tsx` and `MicroSurvey.tsx`; these bypass the shared API client.
- Add provider-neutral session/token interfaces. Isolate the old SDK behind a
  temporary adapter rather than leaking Firebase user objects to UI consumers.
- Refactor `AuthContext.tsx`, `src/services/api.ts`, `GoogleSheetsModal.tsx`,
  `NotificationSettings.tsx`, `DataConnectors.tsx` and
  `components/workspace/ImportWorkspace.tsx` to use the session boundary.
- Inventory `SignInModal.tsx`, `OnboardingModal.tsx` and
  `vertex-ai-proxy-interceptor.js`, including its legacy window token getter.
  Remove that getter only after migrating or retiring every caller.
- Remove optional Firebase analytics initialization, preserving helper-call
  compatibility and consent preferences. Default to no external tracking; do
  not silently install a replacement tracker or claim disabled analytics works.

**Exit gate:** builds/tests pass; intake is unchanged; no fake client identity
can satisfy the auth guard. The SDK may remain temporarily and must be reported.

## Phase 2 — Supabase staging and database foundation

Owner prerequisites: confirm provider, staging project, region, current plan
limits, expected costs and production budget. Do not promise a forever-free app.

- Add versioned migrations and reproducible synthetic seed/test setup.
- Design tables from actual access patterns, not a mechanical document dump.
  Candidate entities include workspaces, identity bindings, profiles, inquiries,
  source connections, flows, notification settings, jobs, job rows/events,
  import recipes/runs, review exceptions, artifacts, usage reservations,
  subscriptions, API-key hashes, webhook receipts and durable outbox records.
- Preserve legacy record IDs, original messages, timestamps and source lineage.
  Legacy Firebase IDs are not necessarily UUIDs. A stable text workspace ID plus
  a separate Supabase UUID identity binding is a valid migration design.
- Add tenant-scoped indexes, bounded pagination, relationship constraints and
  uniqueness for deduplication/usage reservations/provider events.
- Enable row-level security on exposed tenant tables. Policies must use verified
  identity and server-owned bindings. Protect both existing rows and inserted or
  updated ownership values; prevent moving records to another workspace.
- Block client changes to protected fields with privileges/server APIs, not
  ownership policies alone. Views and privileged database functions also need
  review, restricted grants and safe execution context.
- Service-role/secret keys bypass ordinary RLS protections: every privileged
  handler must still verify ownership. Never expose those keys through `VITE_*`.
- Keep buckets private with ownership-aware access policies. Issue short-lived
  signed links only after authorization; validate upload size/type/content.
- Atomically reserve usage, deduplicate intake/job creation and enqueue work.
  Duplicate requests must not charge twice; rollback/failed-job accounting must
  preserve the existing documented usage semantics.

**Exit gate:** two-tenant and anonymous access-denial tests pass through both
browser-accessible database paths and privileged API handlers.

## Phase 3 — Authentication and existing-user continuity

- Implement the Supabase adapter and migrate signup, login, logout, email
  verification, recovery and approved OAuth flows. Review redirect allowlists
  for local, staging and production; do not accept arbitrary redirect targets.
- Verify access tokens server-side using the selected project's supported token
  verification method. Reject bad signature, issuer, expiry and inappropriate
  audience/role. Merely decoding a JWT or reading a browser session is not proof.
- Handle refreshed/expired/revoked sessions correctly. Verify sensitive actions
  against current account/session status where local JWT checks are insufficient.
- Clear queries, selections, cached results and pending requests on logout or
  identity change. Prevent a late response from the previous user repopulating UI.
- Preserve one existing Firebase UID-owned workspace via a server-controlled
  mapping to the new identity. Protect that mapping from client writes.
- Decide and rehearse identity migration before cutover: approved export/import,
  verified recovery/account linking, or an explicit new-user-only pilot that
  leaves old workspaces inaccessible until ownership is securely established.
- Do not assume Firebase exports or old password verification remain available
  while suspended. If unavailable, report this blocker and retain historical
  data/config; do not silently recreate accounts and attach data by email.
- Do not assume password preservation or Google OAuth/phone sign-in works
  automatically. Verify supported migration paths and configured providers.
  Google Sheets is separate from Firebase, but Google account/OAuth/API access
  must still be tested. If phone sign-in needs unapproved SMS costs, mark it
  unavailable with a truthful alternative rather than simulating success.

**Exit gate:** new users and approved migrated users pass signup/recovery/login,
token refresh, logout, cross-tab/session-change and ownership tests.

## Phase 4 — Replace API endpoints and broken routing

- Port the route matrix in small groups using repository interfaces. Retain
  pure validation/business logic; replace Firebase-specific transport/storage.
- Preserve existing frontend field names, status codes, pagination and errors,
  or deliberately version contracts and update both sides together.
- Apply boundary validation, authentication, ownership and durable abuse limits.
  Never rely solely on in-memory counters in a serverless deployment.
- Return redacted JSON failures with correlation IDs and no-store headers.
  Invalid token: 401; denied resource: consistent 403/404; unavailable provider:
  honest 503. A failed request is not an empty inbox or a successful mutation.
- Add health/liveness/readiness checks without exposing keys or customer data.
- Replace direct profile/feedback writes with approved server/database paths.
  Preserve failure states; never show a saved confirmation without persistence.
- Update root and frontend Vercel configuration according to the actual project
  root. Stop forwarding migrated routes to the suspended Firebase site.
- Do not remove all `/api/*` rewrites before replacement routes exist. Ensure
  missing APIs return JSON errors, not the SPA's HTML success page.
- Extend `.vercelignore` only for required reviewed runtime files. Preserve
  exclusions for secrets, backups, dotenv files and service-account downloads.
- Review CSP/connect/frame rules against actual Supabase/OAuth endpoints; do
  not fix connection problems with unrestricted wildcard permissions.
- Separate Vercel Preview and Production configuration and callback URLs.
  Redeployment is required for build-time environment changes.

**Exit gate:** every retained frontend API call resolves to a tested replacement
or an explicitly unavailable feature, with no legacy forwarding for migrated APIs.

## Phase 5 — Inquiry intake, Sheets, webhooks and processing

### Preserve the working intake

- Keep `/api/contact`, its server-only Apps Script secret, receipt recovery,
  bounded retries, payload-conflict detection and existing email design intact.
- Keep stable `Idempotency-Key` values for unchanged retries. An ambiguous
  timeout may still have written a row; do not advise retrying with a fresh key.
- An accepted Sheet row is not automatically a dashboard database record.
  Choose the source of truth and document acceptance/visibility guarantees.
- If the existing Sheet remains authoritative during transition, acknowledge
  only confirmed Sheet acceptance and expose synchronization status separately.
  Reconcile into Supabase through an authenticated, idempotent importer; do not
  advertise automatic sync until scheduling and recovery are operational.
- If Supabase becomes authoritative later, use a database transaction plus a
  durable outbox for optional Sheets/email delivery. Treat this as a separately
  approved intake change, not an uncoordinated dual write.
- The owner's intake Sheet is not every customer's database. Never expose the
  privileged Apps Script list action to all signed-in users or browser secrets.

### Sheets and import reliability

- Verify service-account/OAuth credentials and exact Sheet access. Store secrets
  server-side, bind connectors to authorized workspaces and prevent one user's
  sheet claim from leaking another user's data.
- Retain original rows, source references, mapping choices, validation warnings,
  failed-row downloads and import-only versus processing semantics.
- Test empty sheets, changed headers, revoked permissions, duplicate imports,
  oversized files, malformed rows, interrupted jobs and quota exhaustion.
- For larger uploads, use authorized direct private-storage upload followed by
  server verification/job creation; do not exceed Vercel request/runtime limits.

### Durable automation and webhooks

- Replace Firestore triggers/schedules with a durable queue/outbox and an
  explicitly deployed worker/scheduler. Do not run long jobs after a response
  and assume the hosting process will survive.
- Implement leases/visibility handling, bounded retries, backoff, poison-job
  review, pause/resume and stop controls. A queue alone does not run workers.
- Assume duplicate delivery: external effects, usage debits and result writes
  must be idempotent. Record processing state and retryable failure honestly.
- Validate webhook authentication using the provider's actual contract. For
  signed providers, preserve raw bytes for signature checks and enforce replay
  rules. For shared-secret workflows, enforce that contract instead of inventing
  an unsupported signature header. Resolve tenant ownership server-side.
- Billing events require verified provider bindings and durable deduplication.
  Apply receipt/state changes atomically; handle delayed/out-of-order events.
- Guard external fetches against SSRF, unsafe redirects, excessive size and
  timeout. Never log request bodies, connector credentials or notification PII.
- Do not enable recurring paid work until budgets, quotas, recovery and owner
  approval exist. Preserve current product limits throughout migration.

**Exit gate:** fault tests prove retries do not duplicate rows, notifications,
processing charges or subscription changes. Signed-in flows remain tenant-safe.

## Phase 6 — Professional, truthful dashboard and UI checks

- Preserve current dashboard scope; do not rewrite marketing/shared styles as
  an incidental migration. Use existing semantic tokens and restrained styling.
- Show source connectivity, inquiry counts/status, job progress, failed/review
  rows, quota usage and last synchronization only from real persisted evidence.
- Keep unavailable, empty, loading, stale and error states distinct. Hide or
  clearly disable unsupported integrations; never label placeholders connected.
- Verify tab routing, list/detail alignment, sidebar state, filters, source
  warnings, long text, pagination and retry controls. Do not fabricate insights.
- Check dashboard and homepage at 375, 768, 1024 and 1440 pixels, plus zoom and
  keyboard navigation. Inspect actual rendered screens for overlap/clipping.
- Ensure mobile selection/detail flows, readable messages, visible focus and
  action buttons do not collide. Keep technical failures actionable without PII.

**Exit gate:** screenshots/browser checks cover success and failure states;
build/typecheck alone does not certify responsive layout.

## Phase 7 — Rehearse migration, cut over, then retire Firebase

1. With explicit approval, create encrypted private backups and test restoration
   separately. Suspension may block exports: stop historical-data cutover if
   ownership/data cannot be recovered or securely verified.
2. Build a resumable migration with dry-run mode, recursive subcollection
   handling, ID/timestamp preservation, counts/checksums and orphan reporting.
   A single-collection flattening tool is not proof that all app data migrated.
3. Rehearse against synthetic fixtures first, then approved private exports.
   Compare per-workspace counts, permissions, usage, subscriptions and results.
4. Agree on write freeze/delta reconciliation, downtime notice and rollback.
   Firebase suspension means switching the frontend back may not restore the
   backend. Define an intake-only fallback and a Supabase backup/restore path.
5. Obtain production-cutover approval. Verify auth, routes, callbacks, data,
   worker deployment, source sync and monitoring on the Vercel URL and domain.
6. After parity and a reviewed rollback window, uninstall `firebase`,
   `firebase-admin`, `firebase-functions` and Firebase test packages from active
   packages only when their remaining responsibilities are migrated/retired.
7. Update lockfiles through the package manager. Remove obsolete overrides
   only when their dependency disappears; update security regression tests.
8. Remove active Firebase initialization, environment requirements, obsolete
   routing, triggers and deployment commands. Review `backend/`, `functions/`,
   emulator tooling and AWS pilot scope rather than deleting whole directories.
9. Preserve historical migration evidence and approved recovery artifacts.
   Remove/archive repository Firebase configuration only after its recovery
   value is addressed. Cloud deletion requires a separate explicit request.
10. Search remaining Firebase references and classify historical mentions versus
    runtime dependencies. Prove the new active build/API works without Firebase
    credentials; move any retained legacy code outside active deployment paths.

**Exit gate:** zero active Firebase SDK/runtime/hosting dependencies for the
retained application, tested recovery, no ownership loss and no false success.

## Required verification and reporting

Record the initial baseline and re-run relevant checks after each phase. Existing
commands at the time of this brief, from the repository root:

```sh
npm run test:intake
node --test frontend/pages/*.test.ts frontend/lib/*.test.ts frontend/components/workspace/*.test.ts
npm --prefix frontend run typecheck
npm --prefix frontend run build
npm --prefix functions run lint
npm --prefix functions run test:unit
npm --prefix backend run test:ws-auth
node scripts/scan-secrets.mjs --working-tree
git diff --check
```

The legacy WebSocket test may require its documented local runtime/environment.
Inspect `functions/scripts/run-integration.js` and `docs/testing.md` before legacy
integration tests: they require isolated demo emulators, not production access.
Add and document new Supabase schema/RLS, repository, auth, API and worker tests;
passing Firebase emulator tests does not certify replacement services.

Minimum new test matrix:

- Anonymous/expired/forged/wrong-project token rejection and cross-tenant denial.
- Protected-field escalation, malicious ownership changes and pagination abuse.
- Logout/identity switching and late responses from the previous session.
- Concurrent duplicates, changed-payload conflicts and atomic quota enforcement.
- Connector permission revocation, callback failures and safe unavailable states.
- Upload ownership/limits, partial failure, worker crash and replayed delivery.
- Invalid/replayed/out-of-order billing and processing webhooks.
- Migration resumability, restore, original content and stable identity mapping.
- Real responsive/accessibility checks, not fabricated screenshots/test counts.

After each phase return: changed files, test results, remaining Firebase uses,
blocked owner actions and the next exit gate. Maintain a checked migration log.
Clearly distinguish locally implemented, staging-tested and production-verified.
Ask permission before one labelled live inquiry because it adds a Sheet row and
may send customer/owner emails. Do not resend historical test submissions.

## Official technical references

Use current official docs for implementation specifics; do not execute commands
from documentation blindly or export production secrets as part of research.

- [Firebase Auth migration](https://supabase.com/docs/guides/platform/migrating-to-supabase/firebase-auth): inspect supported identity migration tooling; actual access and account-continuity checks remain required.
- [Firestore data migration](https://supabase.com/docs/guides/platform/migrating-to-supabase/firestore-data): collection conversion guidance, not an automatic complete NodalX migration.
- [Row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security): review policies, privileges and bypass behavior.
- [JWT verification](https://supabase.com/docs/guides/auth/jwts): select verification for the project's actual signing configuration.
- [Storage access control](https://supabase.com/docs/guides/storage/security/access-control): review private-object policies and privileged credentials.
- [Supabase Queues](https://supabase.com/docs/guides/queues): evaluate durable delivery alongside a deployed consumer and retries.
- [Vercel Function limits](https://vercel.com/docs/functions/limitations): verify actual plan/runtime limits before moving uploads or workers.

## First instruction to the implementing agent

Start with Phase 1 only: inspect the current checkout, record the dependency and
route matrix, introduce the provider-neutral session seam, retire optional
Firebase analytics safely, add regression tests and run frontend checks. Keep
the working contact flow and UI semantics unchanged. Report what still depends
on Firebase. Then continue local preparation in phase order; stop at approval,
production-data or cloud-access boundaries and name the exact missing input.
