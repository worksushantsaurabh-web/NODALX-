# NodalX audit implementation — 1 October 2026

## Outcome

NodalX's honest pilot scope is one owner workspace for saved business inquiries,
optional classification and human follow-up. It is not an autonomous emailing
platform, shared-team CRM, revenue attribution system or continuously synced
Google Sheet. This pass preserves the original inquiry and existing work.

## Implemented

- Six dashboard screens: Overview, Inquiry Desk, Sources & connections,
  Imports & processing, Usage & billing, Qualification settings. Old reports
  and integration links resolve to the consolidated screen rather than an
  unrelated command center.
- Stable cursor pagination with ownership checks, creation-date/document-ID
  tie ordering, strict limits and merge rules preserving locally saved status.
  Loaded counts are separate from full-workspace overview aggregates.
- User-scoped resource state and abortable requests prevent another account's
  stale data from being shown. Failed refreshes preserve previously loaded work.
- Real Firebase token checks include disabled/revoked users. Workspace requests
  use the shared server-side rate limiter.
- JSON boundary errors, safe request IDs, no-store responses, Retry-After and
  process/database health endpoints. Legacy provider error objects are no
  longer dumped into logs. Logs intentionally sacrifice raw error detail to
  avoid token/body leakage; investigate through safe operation and request IDs.
- Hash-at-rest and one-time display for new workspace keys, masked metadata,
  rotation and revocation, and compatible legacy migration. API profiles/status
  no longer return old raw keys. Legacy credentials remain accepted until their
  owner rotates them; direct owner profile reads may still contain unmigrated
  legacy keys, so this is not a completed global credential rotation.
- Optional analytics requires a deployment flag and explicit saved consent;
  preferences can withdraw collection. Corrected privacy/terms and unsupported
  marketing claims. The newsletter no longer pretends to save an address.
- CI runs unit and mandatory Auth/Firestore emulator integration tests rather
  than treating skipped integration tests as a complete check.
- Documented API contract, synthetic local preview, production architecture,
  release/rollback, incident response and outstanding restore drill.

## Validation evidence

- Production frontend build and TypeScript pass; 15 frontend tests pass.
- Functions lint passes; 18 unit and 11 emulator integration tests pass.
- Rules deny tier escalation, profile writes, cross-owner access and client
  intake; free signup is permitted.
- Alternate Apps Script proxy: 3 tests pass. These use mocked storage responses,
  not a real Sheet write.
- Local WebSocket unauthenticated/forged/invalid-origin attempts are rejected.
- Working-tree scan includes untracked, non-ignored source; local history scan
  and `git diff --check` pass. Pattern scanning is not proof of no secret.
- Synthetic browser QA verifies email sign-in, 105-record pagination, opening
  inquiry details without changing screen, persisted status and activity,
  empty-search state, desktop dark and 375px light layouts. Sources, imports,
  billing and settings fit without observed horizontal overflow. Billing remains
  disabled without provider configuration. Google Sheets reports missing service
  account configuration instead of implying a successful connection.
- Stopping the preview API and refreshing shows a source warning while retaining
  all 105 previously loaded records; it does not claim a confirmed empty inbox.
  Temporary preview servers and browser viewport overrides were stopped/reset.
- Firebase CLI emulator test scripts succeeded; the CLI's outer process also
  reported a local shutdown/update-notifier failure in two runs. A subsequent
  direct run against running emulators exited 0 with no skipped tests.

## Not claimed complete

Production billing suspension and 503 require the owner's Google support/billing
decision. No deploy, DNS change, payment method, real payment, credential rotation
or customer-data deletion occurred. Sheets permissions/export, Apps Script real
write, Slack delivery, workflow schema/retries and Razorpay provider callbacks
need staging evidence. Composite indexes must be deployed and verified separately.
Backups need an isolated restore drill. Legal text needs owner review. Browser
automation coverage, accessibility audit, load/performance measurement and team
tenancy remain follow-up work; manual spot checks do not prove every UI state.

See `REMAINING-WORK.md`, `testing.md` and
`runbooks/release-and-recovery.md` before publication. Existing uncommitted work
was preserved; this is not a clean release commit and no commit was created.
