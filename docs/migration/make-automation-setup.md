# NodalX Make automation repair

## Status

Backend implementation and local synthetic validation only. The uploaded scenario
was inspected but has NOT been edited in your Make account. No credentials were
copied from it. No Google requests, cloud migrations, billing, deployment or
customer submissions were performed.

Rotate/revoke the Gemini key exposed in the uploaded blueprint before reuse.
Remove it from shared scenario exports and review request/execution logs. Create
new independent machine and signing secrets; never put them in browser variables.
Existing Airtable records must remain intact during migration.

## Architecture

Authenticated NodalX enqueue (ownership and credits verified in PostgreSQL) ->
scheduled Make claim -> Gemini -> NodalX signed completion -> Supabase dashboard.

Make no longer writes directly to Airtable or chooses a workspace. The callback
uses an expiring HMAC receipt binding the server-selected workspace, job, lease
and whether qualification criteria exist. PostgreSQL fences concurrent/repeated
settlement. Replay returns 409 without charging again. This does not guarantee
exactly-once Gemini billing after a lost response or crash.

The current public website intake still writes to Apps Script/Sheets. This queue
processes inquiries already in Supabase; this change is NOT a Sheets sync or an
automatic website-to-Supabase migration. Source sync and existing-user continuity
remain launch gates. The original inquiry text is never overwritten.

## 1. Cloud prerequisites (owner action)

- Approved cloud Supabase project with all versioned migrations applied after a
  backup and staging rehearsal; never run a reset against production.
- Vercel server-side environment variables below and a reviewed deployment.
- An eligible Gemini model verified in the owner's account. The uploaded model
  name has not been proven available. A structured-output model is required.
- Explicit customer-data/privacy approval and eligible paid Gemini project for
  real personal/confidential inquiries. Do not enable billing while the existing
  Google dispute remains unresolved without explicit approval.
- Make scheduling that can poll at least every 30 seconds. If the account cannot
  support this, use the supervised worker instead; do not buy a plan automatically.

Server-only configuration:

| Variable | Requirement |
| --- | --- |
| `MAKE_PROCESSING_ENABLED` | `true` only for approved staging/release |
| `MAKE_PROCESSING_TOKEN` | Independent random base64url secret, 32-256 characters; shared with Make |
| `MAKE_RECEIPT_SECRET` | Different random base64url secret, 32-256 characters; Vercel only |
| `SUPABASE_URL` | Approved HTTPS cloud Supabase origin |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel only; never give this to Make |
| `PROCESSING_ENVIRONMENT` | `staging` or `production` |
| `ALLOW_PROCESSING_NETWORK` | `true` after approval |
| `GEMINI_MODEL` | Verified structured-output model name |
| `GEMINI_DATA_APPROVAL` | `synthetic-only` for synthetic staging; `approved-customer` for approved production |
| `GEMINI_PAID_PROJECT_APPROVED` | `true` required in production; declaration is not proof of eligibility |

Production database operator gate remains disabled until rehearsal passes.
Readiness requires successful Make polls within 60 seconds; a poll does not
override the database operator gate. It proves connectivity, not Google health.
The existing supervised worker must not consume the same queue during this
rehearsal unless competing consumers have deliberately been approved.

## 2. Replace the scenario in a disabled duplicate

Keep the original disabled scenario and Airtable data for rollback. The existing
website intake must not be redirected to this machine-authenticated endpoint.

1. Replace module 2 (public webhook) with a scheduled HTTP v4 request:
   `POST https://YOUR_APPROVED_HOST/api/automation?action=claim`, JSON body `{}`.
   Use Make's API-key credential store to supply an `Authorization` header with
   `Bearer <MAKE_PROCESSING_TOKEN>`. No credentials in URLs or exported bodies.
   Parse response, timeout 15 seconds, redirects off. Claims are globally limited
   to one every two seconds by a locked PostgreSQL gate.
2. Add a filter: continue only when response `status` equals `claimed`.
   `idle` is a normal successful no-op; `rejected` means an exhausted/invalid job
   was handled without sending data to Google. Do not retry 429 immediately.
3. Configure module 8 (Gemini HTTP) as POST to
   `https://generativelanguage.googleapis.com/v1beta/models/<claim.model>:generateContent`.
   Use secure API-key credentials with header name `x-goog-api-key`; remove the
   query-string key. Disable redirects, use a 60-second timeout, parse response.
   Use Data structure JSON mapping (or JSON/Create JSON serialization), mapping
   the complete claim `geminiRequest` object. Never manually interpolate message
   text into JSON. The server supplies a structured schema, 0-100 score range,
   factual-review prompt, criteria, and bounded output tokens.
4. Delete module 9 (regex extraction) and module 10 (manual JSON parsing) from the
   disabled duplicate. Backend now verifies the entire Gemini response: STOP
   finish reason, no blocked/tool result, valid JSON, required nonempty fields,
   no extra fields and bounded score/text. Failed/truncated results cannot succeed.
5. Replace module 11 (Airtable create) with HTTP v4 completion:
   `POST https://YOUR_APPROVED_HOST/api/automation?action=complete` using the
   machine credential. Data structure body has `receipt` from the claim and
   `response` mapped as the COMPLETE parsed Gemini response object, not a JSON
   string or nested classification object. Timeout 15 seconds, redirects off.
6. Remove module 12 (webhook response). The scheduled run has no browser waiting
   on it. A NodalX `200 completed` confirms storage; a Gemini 200 alone does not.
7. Replace error responders 13/14 with a failure-completion HTTP request, using
   Data structure body `{ "receipt": <claim.receipt>, "failed": true }`.
   Do not include provider errors, contact details or credentials. Attach this
   handler to Gemini transport errors AND rejected completion results (400).

JSON mapping with a Data structure escapes reserved characters automatically:
[Make HTTP documentation](https://apps.make.com/http).
Structured-output request contract follows the current legacy GenerateContent
[Google documentation](https://ai.google.dev/gemini-api/docs/generate-content/structured-output).
Privacy eligibility must follow [Google terms](https://ai.google.dev/gemini-api/terms).

The claim's response contains message/criteria in `geminiRequest` but does not
include separate contact name/email/company. Message text can itself contain PII;
this is minimization, NOT anonymization. Enable Make confidential-data controls
and restrict scenario/log access. Receipts are temporary credentials too.

## 3. Error, timeout and duplicate policy

- Finish within 90 seconds; receipts expire after 110 seconds, database leases
  after 120 seconds. Do not use Make's longer webhook response timeout as a job
  deadline. No Vercel invocation waits for Gemini.
- Never rerun Gemini automatically on completion failure. Retry only completion
  with the same receipt/result before expiry after a transient 503/transport loss.
- A repeated completed callback returns 409 `LEASE_NOT_ACTIVE`; stop that attempt.
  Expired/tampered receipts also return 409. Never relabel a conflict as success.
- Failure completion releases reserved credits. Crash/lost callback keeps the
  reservation and permits reclaim after lease expiry; at most three claimed
  provider attempts, then the job is rejected and its reservation released.
- Monitor stalled jobs, released/reserved credits, quota rejection, provider
  errors and last successful run without recording customer text/secrets.
- If Make is paused, stop new enqueue by turning off the database operator gate.
  Keep the recovery consumer available for already queued jobs when appropriate.

## 4. Release checklist

- Rotate exposed key; verify Make credentials do not appear in a fresh export.
- Synthetic staging: quotes/newlines, criteria/no criteria, malicious embedded
  instructions, missing fields, blocked/truncated output, timeout and failures.
- Duplicate callback charges once; stale/wrong receipt changes no data; failure
  releases allowance; cross-tenant requests cannot choose workspace or job.
- Pause/restart Make and test freshness, expired lease recovery and retry ceiling.
- Verify dashboard original message unchanged and stale scores removed on new
  analysis without qualification evidence. Verify latest result and job state.
- Verify actual domain route, logs, Make frequency/cost and model availability.
- Only after approval enable customer processing; leave historical Airtable and
  working Apps Script email/intake in place until a separate source migration passes.

This is a configuration guide, not an import-ready Make blueprint. Private
connection IDs and account-specific schema IDs must be created in Make, not
fabricated in an export. Live scenario editing/verification remains outstanding.
