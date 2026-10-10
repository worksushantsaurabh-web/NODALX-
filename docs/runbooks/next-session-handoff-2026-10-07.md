# NodalX continuation: staging verification and launch blockers

Updated 7 October 2026. Read this with AGENTS.md and the release roadmap.

## Goal and approved direction

Website → secured backend → canonical Supabase → authenticated dashboard.
Make is optional. Preserve original inquiry text and verified workspace ownership.
The owner asked to continue the next step and preserve all remaining work here.
Work on the existing `nodalx-staging` Preview; production cutover has not passed
its release checks. Do not reactivate Firebase billing or deploy its Functions.

## Verified baseline

- Repository: `/Users/sushantsaurabh/Desktop/NODALXAI`, branch `nodalx-staging`.
  There are many intentional uncommitted changes; preserve them.
- Vercel project: `nodalx-frontend`, `prj_SbAfNZNK4gBswh6ppCtY4lOhrUo1`,
  team `worksushantsaurabh-webs-projects`.
- Supabase staging: `ozovfbwhcvbgpgrxxjcj`; 15 migrations previously verified.
  One confirmed auth identity has a workspace binding; no intake source exists.
- `nodalx.in` is a verified production domain and returns 200 without SSO.
  `/api/contact` GET returns 405 JSON. No real submission was tested.
- Production revision `7a49c77d659f16ed3b4b510391ba020cdc8d6a08` is older;
  migrated health and workspace inquiry routes return 404 there.
- Vercel protection is `all_except_custom_domains`. Ordinary Preview access
  redirects to SSO, while authorized `vercel curl` reaches application JSON.
  CLI-authorized liveness is 200 and missing application auth is 401.

## Local changes already tested

- Direct `supabase-direct` intake and fail-closed gates; native Supabase Auth.
- Dashboard defers imports, recipes, key management and paid billing controls;
  original inquiry desk, owned processing jobs and usage remain available.
- `scripts/setup-intake-bindings.mjs` verifies owner Auth and RLS binding,
  prepares a disabled source with its credential hash, and saves private output
  only in ignored owner-only files. Supply owner session privately through stdin.
- 96 backend tests passed with all local Supabase opt-ins enabled; 131 SQL
  assertions passed. Build/typecheck, lint, syntax, secret scan and diff passed.
  Visual browser testing remains outstanding.

## Active step

Prepare and deploy reviewed working-tree changes to the existing staging Preview,
using branch-scoped environment settings. Verify the protected deployment via
authorized CLI requests and preserve the stable Auth callback alias. Deployment
result and new evidence will be appended here as work proceeds.

Current deployment blocker: Vercel CLI reports logged out / invalid token. Device
login is in progress; the owner was asked to finish it. The Vercel connector also
returns 403 for the correct team. Do not retry identical denied calls or deploy
through an unrelated account. Build/typecheck and secret scan were repeated and
passed. No new deployment exists yet.

New local migration `20261007040036_source_transport_metadata.sql` replaces the
hardcoded Make kind with server-owned `private.intake_sources.source_kind`.
Provisioning prepares website sources; unspecified origins remain unknown.
Existing inquiries are preserved. SQL/E2E checks are being run before cloud apply.

## Remaining work in order

1. Apply and review migration `20261007050000_outbound_email_desk.sql` in staging.
   Finish Resend domain verification for `nodalx.in`, create a sending-only API
   key, configure `RESEND_API_KEY` and `OUTBOUND_EMAIL_FROM` in Preview only, and
   keep `OUTBOUND_EMAIL_ENABLED=false` until an approved synthetic send test.
2. Verify deployed revision and same-origin frontend API configuration. Verify
   browser owner login, logout, recovery and exact callback destinations.
3. Prepare the source binding from the verified owner's session. Review disabled
   SQL and matching private Vercel token, apply it to staging, and verify ownership.
   Never choose a workspace by email or an arbitrary UUID.
4. Obtain the previously required exact-request approval before enabling source /
   intake network gates or sending a synthetic cloud inquiry. Request and side
   effects are in `phase-0-2-verification.md`. Keep Make/AI gates off.
5. Verify canonical storage, owner visibility, same-ID replay, changed-payload
   conflict, repeat customers, tenant denial and recovery in the approved staging
   rehearsal. Local tests do not establish cloud results.
6. Correct source-kind metadata with a new versioned migration: the existing
   ingestion function labels all transport as `make`, including direct intake.
7. Restore branded confirmation and owner notifications through a durable outbox;
   direct Supabase intake currently sends no inquiry email. Check Auth SMTP and
   email recovery separately. Do not claim email parity yet.
8. Decide and rehearse legacy Google Sheet / Firestore history and identity
   continuity; never silently show unavailable history as an empty inbox.
9. Verify production Supabase isolation, variables, exact auth callbacks, monitoring,
   backups/restore and rollback before production promotion. Do not copy staging
   service credentials into production implicitly.
10. AI classification: existing Gemini adapter/jobs need provider eligibility,
   privacy/cost approval, worker hosting, output evaluation and operational caps.
   Launch explicit manual analysis first. Preserve inquiry capture during outages.
11. CSV/Sheets imports, automation, subscriptions and final Firebase package
    retirement follow verified contracts; keep unavailable features deferred.

## Safe continuation

No secrets, auth sessions, customer messages or lease tokens belong in this file,
chat, process arguments, Git or logs. Do not dump environment files or raw provider
responses. Update AGENTS.md and the migration log with actual evidence after changes.
No commit, push, merge or production promotion was requested for this step.
