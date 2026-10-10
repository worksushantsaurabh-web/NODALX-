# Make intake router: disabled staging setup

## Account status

Owner supplied the private scenario editor URL on 6 October 2026. The original
"NodalX Inquiry Classification Pipeline" is a legacy Gemini/Airtable flow. The
owner completed Make sign-in privately. No scenario/account setting was changed,
duplicated, activated or executed during that review. The owner reports the
scenario is currently active and its latest scheduled run failed at the
Airtable connection check with HTTP 400; its Gemini webhook-response module also
warns that it cannot run on a scheduled trigger. Do not edit, clone, pause, or
otherwise change its status without owner instruction. To pause it manually:
open Make > Scenarios, open that exact scenario, use the scheduling toggle in
the scenario editor to switch scheduling off, then confirm the status reads
Inactive. This does not delete it. New staging router work must use a separate
scenario and must not reuse the legacy webhook.

The Make account shows a secure keychain named "NodalX staging router" with
usage count 1, but the linked scenario and credential contents were not inspected
or exposed. No separate staging router was verified in the scenario inventory.
Do not assume that key is correctly configured or reuse it in a module until its
owner and intended scenario are confirmed. Never reveal, export, or paste its value.

The stable staging Vercel deployment is Ready, but its preview APIs redirect
unauthenticated requests to Vercel SSO. Do not put a project-wide Vercel
protection-bypass credential in Make or disable protection. No approved
machine-reachable API host is currently verified. A narrow API-only staging
deployment/host with application Bearer authentication and fail-closed gates is
needed before the Make modules can be safely saved or run. The preview gates
remain disabled. Cloud migrations are aligned at 15; no live Make execution or
cloud inquiry write was performed in this checkpoint.

The delegated Make review did not produce a final artifact and was stopped.
Parent implemented/validated the backend and wrote this integration contract.
This guide is not an import-ready Make blueprint or proof of live integration.

## Minimal scenario

Create a disabled staging duplicate after login and approved staging deployment.
Leave the existing original untouched. Intake must not depend on Gemini, Airtable,
regex parsing or Sheets. Those modules belong outside this storage-critical path.

1. Scheduled HTTP v4: POST to the APPROVED API host `/api/intake?action=claim`,
   JSON body `{}`, parse response, timeout 15 seconds, redirects disabled.
   Use secure API-key credentials to supply `Authorization: Bearer` followed by
   the Make intake token. Never put credentials in a URL, mapped body or export.
2. Filter: continue only if parsed response `status` is `claimed`. An `idle`
   response is a normal no-op, not an inquiry acknowledgement.
3. HTTP v4: POST to the SAME approved host `/api/intake?action=complete`, using
   the same machine credential. JSON Data structure maps only `deliveryId` and
   `leaseToken` from the claim. No email, message, workspace or altered inquiry.
4. Treat 200 with `status:stored` as canonical storage confirmation. A repeated
   stored callback returns the same ID with `duplicate:true`; this is successful
   replay acknowledgement. Do not infer storage from a claim's HTTP 200.

Scheduling at 30 seconds is a recommendation, NOT confirmation of account plan
support. If unavailable, choose an approved cadence/consumer alternative and
review backlog latency; do not buy a plan. Process a bounded number of queued
items per run only after validating cost/throughput. Two HTTP operations per
delivery and idle polls consume Make operations. Global router limit is 120
successful claim/completion calls per minute; source acceptance is 60/minute.

## Response/error branches

| Response | Required behavior |
| --- | --- |
| claim 200 idle | End successfully; nothing to process |
| claim 200 claimed | Complete the exact lease within 120 seconds |
| complete 200 stored | Acknowledge the returned canonical inquiry ID |
| complete 200 stored duplicate:true | Same stored receipt; do not create another record |
| 400 | Stop malformed mapping; fix configuration rather than loop |
| 401 | Stop; resolve machine authentication privately |
| 409 | Wrong/expired/stale lease; stop this attempt and let durable reclaim handle it |
| 429 | Honor Retry-After; no immediate retry loop |
| 503 or lost completion response | Retry completion only with the same IDs while lease remains valid |

The 120-second expiry applies BEFORE storage. Stored receipt replay with the
same token remains idempotent; a successful storage acknowledgement does not
become a failure merely because a later retry occurs after the original expiry.
Never claim another delivery as a substitute for retrying the current callback.
Never replay with a new website source ID to conceal a failure.

Eight expired claims lead to an observable failed delivery. An approved server
operator may use `public.retry_intake_delivery(uuid)` for recovery, preserving
the original/source ID. This is NOT a Make/public HTTP recovery route. No errors
should return raw provider text, payloads, bearer tokens or lease tokens in logs.

## Security and deployment gates

- `MAKE_INTAKE_ENABLED=true` is required; default is false.
- `MAKE_INTAKE_TOKEN` must differ from website source and processing tokens.
- Make never receives Supabase service-role credentials or contact message data.
- A server-selected private source binding determines workspace ownership.
- Keep confidential-data settings and restricted scenario/log access enabled;
  lease tokens are credentials even though customer PII is not mapped here.
- No Gemini key is required for this router; no Google billing or API calls.
- Approved cloud Supabase project and deployed staging API remain prerequisites.
- Configure edge abuse protection and notification behavior before production.
- New mode does not yet send legacy confirmation/owner emails; obtain parity or
  explicit approval. Keep original Apps Script intake as default until cutover.

Website acceptance is a durable private queue acknowledgement. Dashboard records
appear only AFTER canonical completion. Historical Sheets/Firestore records are
not automatically imported. Follow `intake-recovery.md` for release/rollback.

Reference: [Make HTTP credentials and JSON Data structures](https://apps.make.com/http).
Keep stored credentials in the dedicated credential fields, not HTTP header
values embedded in a shared scenario export.
