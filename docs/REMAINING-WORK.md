# NODALxAI remaining work

Updated: 5 October 2026

## Latest repair pass

See `runbooks/release-repairs-2026-10-05.md` for the owner-action checklist.
The frontend gRPC security dependency is patched locally: full audit warnings
are reduced from nine to five; runtime-only audit reports zero. The remaining
braces/Tailwind build advisory has no published patch. 47 scoped tests and the
frontend build pass; the patch is not yet redeployed because CLI refresh failed.

`nodalx.in` is now attached to the Vercel project, but DNS is still invalid.
Actual authoritative DNS is Cloudflare, not the former GoDaddy zone. The Vercel
page's exact CNAME recommendation is recorded in the checklist. Cloudflare
sign-in, intake secrets and approved AWS account access remain owner steps.

## Intake recovery and AWS migration

Vercel frontend/contact code is now deployed at
https://nodalx-frontend.vercel.app. See
`runbooks/vercel-deployment-2026-10-04.md` for verification and remaining blockers.
The contact route returns configured JSON errors, but intake secrets are still
missing. The legacy API health check and custom domain still return 404.

The new request is to move off Firebase. Follow `runbooks/aws-migration.md`;
the older Firebase release checklist below applies only if that path is retained.
Do not reactivate Google billing to implement the AWS path.

- Verified custom domain returns 404; confirm its intended hosting destination.
- Linked Vercel project `nodalx-frontend` lacks both Apps Script server variables.
- Hardened proxy, stable retry handling, Apps Script duplicate protection and
  an intake-only AWS handler/template are implemented. The proxy/frontend are
  deployed to Vercel; Apps Script updates and AWS infrastructure are not deployed.
- 18 intake tests and frontend build/typecheck pass. Script provider execution,
  cloud deployment and signed workspace migration tests remain unverified.
- AWS default SSO is expired. Confirm account/region, cost approval and identity
  migration before provisioning. Do not delete existing Firebase data/config.
- Newly added local recipes/automation must be included in migration scope;
  historical completed test counts below are not certification of that new work.

## Import and processing follow-up

Import-only mode, readiness checks, source-quality issues, failed-row downloads,
job filters and source references are implemented locally. See
`import-processing-roadmap-2026-10-01.md` for the research-backed expansion plan,
unchanged subscription limits and release gates. New service schemas, saved
mapping recipes, recurring imports and document OCR remain planned, not live.

## Completed in this pass

- Added `AGENTS.md` project memory and release rules.
- Added authoritative system design, permissions, API conventions and ADRs.
- Chose and documented UID-owned pilot workspaces; team roles are not implied.
- Audited the deployment boundary: Firebase Hosting is live; Functions is the
  intended API but currently returns `503` because billing is suspended.
- Preserved unrelated uncommitted feature work; no reset, checkout or deletion.
- Frontend build/typecheck and 15 frontend tests pass.
- Functions lint and 18 unit tests pass; all 11 integration tests run against
  Auth/Firestore emulators without skips. Firestore access-denial checks pass.
- Dashboard has six consolidated screens, safe tab aliases, owner-scoped
  pagination beyond 100 records, stale-data warnings and tenant-state isolation.
- Added correlated safe API errors, no-store headers and health endpoints.
- New workspace keys are hashed, shown once, and support rotation/revocation.
  Legacy profile/status API responses no longer return raw keys. Legacy stored
  credentials still require owner migration/rotation before release.
- Analytics is off by default and requires explicit consent when enabled.
- Removed unsupported homepage accuracy/timing, automatic sending, continuous
  sync and deletion claims. Replaced the fake newsletter success with changelog.
- Added a guarded synthetic emulator preview and release/recovery runbook.
- Apps Script proxy's 3 tests and WebSocket authorization checks pass.
- Working-tree and local-history secret scanners and diff whitespace check pass.

## P0 — blocks a real SaaS release

- Resolve the Google billing dispute or obtain written support guidance before
  choosing a billing path. Do not add a payment method without owner approval.
- Deploy and verify Functions after billing access is resolved.
- Configure production Functions secrets: `NODALX_OWNER_UID`, processing webhook,
  billing provider credentials and any connector credentials.
- Run a signed end-to-end inquiry: intake → Firestore → processing state →
  dashboard → status update.
- The uncommitted workspace feature was formatted with Prettier and has a
  scoped ESLint style override. Correctness rules remain active, but a style-
  only Google-format cleanup is still required before this feature is promoted
  to a release. No Functions deployment should happen until that review is done.

## P1 — security and operational readiness

- Review and deploy the current Firestore indexes separately from UI changes.
- Rotate all provider credentials exposed during earlier development and apply
  Firebase browser-key HTTP-referrer restrictions.
- Add uptime checks for homepage, login and `/api/health/live`; alert on API
  5xx, intake failure and billing suspension.
- Request IDs and redacted API failure logs are implemented. Configure alert
  delivery and evaluate external error tracking; local logs are not monitoring.
- Create scheduled encrypted backups and test restore into a separate project.
- Define retention, deletion/export and India DPDP/privacy obligations.

## P1 — product and tenancy

- Validate whether pilots need shared team workspaces. If yes, design the
  workspace/membership migration before adding invitations or roles.
- Decide the first paid provider and plan prices after the billing dispute.
- Confirm whether Apps Script remains the public intake fallback or is replaced
  by another independent service.
- Document the external workflow response schema and retry/idempotency contract.

## P2 — quality and scale

- Add Playwright or equivalent browser tests for auth, inquiry intake, status,
  upload/import and mobile dashboard states.
- Add axe accessibility checks and test keyboard navigation at 375px width.
- Add a caching/performance strategy and Lighthouse baseline.
- Run a measured load test against staging; do not estimate scaling from code.
- Consolidate or remove the local `backend/` after the Functions boundary is
  proven.

## Known repository state

There are substantial uncommitted changes in workspace routes, UI, indexes,
Functions and an `api/` alternate deployment. They may be valid user work, but
they are not one reviewable release. Split and review them before merging.

## Safe next sequence

1. Review this document and `docs/system-design.md`.
2. Review the focused fixes and separate pre-existing uncommitted feature work.
3. Repeat `docs/testing.md`; verify production indexes and live providers later.
4. Resolve billing/support decision.
5. Deploy Functions and indexes separately, then run signed smoke tests.
6. Add monitoring and tested backups before inviting pilot customers.
