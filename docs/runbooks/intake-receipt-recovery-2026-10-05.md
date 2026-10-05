# Intermittent inquiry acknowledgement repair — 5 October 2026

## Observed failure

The public `/api/contact` route sometimes returned HTTP 502 even though the
owner-approved test inquiry's confirmation and owner notification arrived.
Production diagnostics reproduced a JSON parsing failure on an upstream
HTTP 404 HTML response, not an expired 45-second server deadline. Other exact
retries succeeded in approximately 3–43 seconds. Increasing timeouts alone
does not address this failure.

Google's Content Service serves JSON through a one-time redirect URL on
`script.googleusercontent.com`; the previous automatic redirect handling hid
the distinction between the intake write and receipt retrieval.
Reference: [Google Content Service redirects](https://developers.google.com/apps-script/guides/content#redirects).

## Changes

- Handle redirects explicitly. Only HTTPS `script.googleusercontent.com`
  `/macros/echo` receipts are accepted. Reject sign-in/untrusted destinations,
  credentials, custom ports, fragments, secret query parameters and 307/308
  POST-preserving redirects. Redirect chains stop after three hops.
- Retrieve receipts with GET, without the original inquiry body or intake
  secret. A receipt redirect alone never counts as confirmed storage.
- If a validated receipt returns 404/410, request one fresh receipt by resending
  exactly the same serialized inquiry and operation ID. The deployed Apps
  Script Version 5 stores identical retries once and does not repeat emails.
  Never enable this recovery against an older, non-idempotent script.
- Retry recognized transient network failures and 429/500/502/503/504 responses
  within the original abort deadline: at most two attempts per POST stage and
  three per GET stage. Receipt body transport failures retry GET, not POST.
  One receipt refresh can run a second POST stage; the maximum is four POST
  attempts, all with the same operation ID. Backoffs are small; provider
  `Retry-After` delays longer than two seconds are not bypassed.
- Configuration/authorization errors, malformed JSON, conflicts and invalid
  success payloads are not automatically retried. An unavailable intake
  deployment's initial 404 is not treated as an expired receipt.
- Keep the 45-second Vercel provider deadline, 55-second browser deadline and
  60-second function budget. AWS retains its separate 15-second deadline.
- Add safe diagnostics with a random correlation ID, stage, HTTP status,
  coarse content type, elapsed time and allowlisted transport error code.
  Never log inquiry fields, operation IDs, secrets, redirect URLs/tokens, raw
  provider messages or stack traces. Logger failure cannot break intake.
- Return HTTP 202 only after validating a successful JSON storage receipt with
  a nonempty row ID. Exhausted retries remain unconfirmed and include a safe
  `Retry-After` header; the browser retains its unchanged-submission retry key.

## Local verification

- 40 intake/security/Apps Script/AWS tests and 29 frontend tests pass.
- Regression coverage includes missing/expired receipts, duplicate-safe replay,
  GET-only transport/body retries, exhausted budgets, shared deadlines,
  authorization/configuration failures, redirect security, redacted diagnostics
  and provider backoff.
- Frontend typecheck/build, working-tree secret scan and whitespace checks pass.
- Vercel dry run includes 112 allowlisted source entries (748,445 bytes), with
  the contact route and server module present and private files excluded.
- No frontend styling, inquiry schema, Apps Script deployment, private
  environment variables, DNS, Firebase billing or AWS infrastructure changed.

## Production verification

- Vercel deployment `dpl_c2tN2yGJ12ZKJsdYGBgS63wewSkZ` is `READY` and
  serves `https://nodalx.in`; the cloud build passed. Private configuration and
  DNS were retained. Source edits remain local unless separately pushed.
- Three sequential exact retries of the existing owner-approved email-design
  test returned HTTP 202, `accepted: true`, `duplicate: true` and the original
  record ID. They took 37.342, 4.999 and 13.097 seconds. No new operation was
  submitted; the Sheet was not directly re-inspected during this repair.
- The first live check reproduced a validated Google receipt's HTTP 404 HTML
  response at 13.153 seconds. Its `intake_receipt_retry` log has correlation ID
  `517d9ca0-f1bf-47b3-a89d-48c6e5cbf4d0`. It recovered automatically, returned
  HTTP 202 and confirmed the already-stored inquiry instead of returning 502.
  This verifies the repair against the actual production failure, not just mocks.
- Homepage and four referenced JavaScript/CSS assets returned HTTP 200.
  Contact GET returned 405 and invalid empty POST returned 400 without invoking
  Google. Neither test writes a row or sends an email.
- These checks verify observed recovery, not guaranteed Google availability
  or every customer's email delivery. Existing branded emails are unchanged.

For future checks, reuse only an owner-approved test, unchanged, with its
existing operation key. Do not create a new inquiry or use another person's
email without separate permission.

## Recovery and scope

Use Vercel runtime logs filtered to `/api/contact` and the public response's
`requestId`. `intake_receipt_retry` identifies a recovered 404/410 receipt;
transport/provider retry events identify other transient failures. Final
failure events remain distinct from confirmed HTTP 202 requests.

If Google remains unavailable until the deadline, keep the honest uncertainty
warning and retry unchanged. Do not fabricate acceptance, regenerate the key,
or treat email arrival as a durable public API receipt. Guaranteed asynchronous
acceptance would require a separately approved durable queue/outbox design.

Public intake abuse protection and the suspended authenticated dashboard API
remain separate launch blockers. This repair does not certify those services.
