# Phase 0–2 verification and remaining cloud rehearsal

7 October 2026. Local implementation is not a production deployment.

## Access evidence

- Vercel CLI confirms project `nodalx-frontend` under `worksushantsaurabh-webs-projects`.
- Latest ready staging deployment: `nodalx-frontend-rwqhco2f4-worksushantsaurabh-webs-projects.vercel.app`, revision `1b8d69415545a9cda00811b28c8e661d195c60a9`.
- CLI-authorized GET liveness returns 200 JSON; missing application auth returns 401 JSON.
- Ordinary unauthenticated GET liveness still returns 302: public machine access is NOT fixed by CLI access. Keep preview protection; do not distribute a protection credential to Make.
- Supabase `ozovfbwhcvbgpgrxxjcj` is healthy with 15 applied migrations, one confirmed identity linked to a workspace, and zero intake sources. Aggregate SQL corroborates the binding; it is not an owner browser session test.
- Supabase/intake environment variable names are Preview-only, branch `nodalx-staging`. Secret source/Make/service-role entries are sensitive. Metadata inspection does not verify their values. Shared legacy Firebase settings still exist; production was not changed.

## Safe source preparation

`scripts/setup-intake-bindings.mjs` is preparation-only. Supply staging URL,
expected project ref and publishable key via private environment configuration.
Supply the verified owner's access token as JSON on stdin through a private local
process, never as a command argument, chat message or shell-history literal.
The tool verifies Auth and RLS-owned identity binding; it accepts no workspace ID.
Reuse the existing privately stored source credential when available; otherwise
coordinate rotation before activation, because sensitive Vercel values cannot be
assumed retrievable. Never use a Supabase service credential as a source token.

Output files under ignored `.private-backups/intake-setup-*` have owner-only
permissions. The SQL contains a hash, not the source credential; it rechecks the
verified binding and prepares a disabled source. Applying SQL, setting private
Vercel variables, deployment and enabling intake are separate reviewed steps.
Never enable another tenant's source or expose the source token to the browser.
This website source is for its verified owner, not a universal multi-tenant inbox.

## Approval required before live rehearsal

After deploying reviewed changes to staging and authenticating the owner:

1. Prepare and review the disabled source binding, then obtain approval to enable
   that source and `ALLOW_INTAKE_NETWORK=true`, with provider `supabase-direct`.
   Keep Make and processing gates off. No AI provider request is needed.
2. For a browser rehearsal, retain the protected preview and use same-origin API
   requests from its authorized session. An API-only public host requires separate
   narrowly scoped protection/DNS approval; it is unnecessary for optional Make
   when only the protected browser is being tested.
3. Show the exact request before execution:

```http
POST https://<approved-staging-host>/api/contact
Content-Type: application/json
Idempotency-Key: synthetic-phase2-20261007-one

{"name":"Synthetic Phase 2 Test","company":"Synthetic Test Only","email":"phase2@example.test","message":"SYNTHETIC staging verification. No customer data."}
```

Expected: first call 201 stored, identical replay 200 same ID, changed message
under the same key 409. A second key ending `-two` permits the repeat customer.
Side effects: two labelled canonical staging inquiries and source counters; no
Make run, Gemini call, Google Sheet write, confirmation or owner email. Cleanup
of the exact test records needs an explicit agreed action. Verify authenticated
owner visibility and another tenant's denial without logging tokens or messages.
Do not run this request or activate gates until the owner approves.

## Still outstanding

Validation: all 96 backend tests passed with all local Supabase opt-ins enabled
and sequential execution; zero skipped. The 131 SQL assertions, frontend
build/typecheck, Functions lint, new script/test unused-variable lint, syntax,
working-tree secret scan and diff checks passed. Browser layout was not tested.

- Owner browser login/logout/recovery and exact callback verification.
- Review and deploy local changes; source preparation/activation and cloud E2E.
- Public API-only access decision if machine clients are required.
- Historical Google Sheet migration, email continuity, worker and production cutover
  belong to later phases. Direct RPC source metadata still labels transport as
  `make`; reconcile via a new versioned migration before claiming source reporting
  parity. Do not edit an already-applied migration to hide this discrepancy.
