# Release, rollback and incident checklist

## Gate: currently blocked

Do not deploy Functions or enable Google billing while the owner's billing
dispute is open. A local success cannot repair a suspended production runtime.
Do not switch DNS or replace Firebase with the alternate Vercel configuration
without an approved architecture decision and data/authentication plan.

## After the owner resolves the blocker

- Review the uncommitted patch as separate frontend, API, rules/index and
  integration changes. Run `docs/testing.md` and review scoped lint overrides.
- Confirm environment names, owner UID, provider credentials and plan IDs
  without printing secrets. Rotate exposed provider and legacy workspace keys.
- Back up Firestore and Auth to private encrypted storage; record the release
  commit, deployment identifiers and recovery owner. Never commit exports.
- Deploy reviewed rules/indexes separately and wait for index readiness.
- Deploy API and exercise liveness, readiness, real Auth, cross-owner denial,
  signed intake, repeated intake, status updates and import partial failure.
- Test Google Sheets sharing and export permissions against a synthetic sheet;
  test Slack delivery, workflow response validation and Razorpay test-mode
  signed/duplicate webhooks. No live payment is needed for these checks.
- Release Hosting only after its API contract is available. Verify desktop,
  mobile, privacy preferences and real-browser sign-in on the intended domain.

## Incident

- Record time, affected route/status and request ID. Do not paste customer
  messages, provider responses or tokens into tickets.
- Separate process failure, database failure, billing suspension and provider
  failure using health endpoints and redacted logs. Configure actual uptime
  monitoring and alert delivery before inviting paying users.
- If intake is unavailable, display an honest failure; never claim storage.
  If classification is unavailable, retain raw inquiries and stop new jobs.
- If a workspace key leaked, revoke or rotate it and update trusted callers.
- Escalate billing incidents to the owner; do not attach a payment method.

## Rollback

- Restore a previously verified Hosting release through the Hosting console.
- Roll back Functions only to a reviewed compatible version after deployment
  access is restored. Review new hashed-key and pagination contracts first.
- Do not roll back rules to broader access, or delete newly written customer
  data. Use a forward compatibility fix if old code expects plaintext keys.

## Backup and restore drill (still required)

- Establish schedule, encryption, retention, IAM and failed-backup alerts.
- Restore a sanitized Firestore export into a separate non-production project.
  Validate document counts, ownership, status and pagination before cutover.
- Validate Auth restoration separately; hashes and import credentials require
  restricted handling. Reapply rules/indexes and verify access denial.
- Measure recovery time and data-loss window and record evidence. Existing
  exports are not proof of a working restore. Never rehearse against production.
