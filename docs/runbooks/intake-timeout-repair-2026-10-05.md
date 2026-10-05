# Inquiry response timeout repair — 5 October 2026

## Observed production state

- `nodalx.in` serves the Vercel project `nodalx-frontend`; DNS and HTTPS were
  verified. The server-side Apps Script environment is configured.
- The existing Apps Script deployment was upgraded to Version 4, using the
  canonical `appscript/nodalx-intake.gs`. `setupSheet` completed successfully.
  A private spreadsheet backup was saved outside the repository first.
- One owner-approved labelled test was stored in row 9. Retrying unchanged
  content with the same operation key did not add another row. Both public
  requests nevertheless returned HTTP 502, `INTAKE_UNAVAILABLE`.
- An unauthenticated, read-only Google web-app request took approximately
  35 seconds to return its expected unauthorized JSON response. Apps Script
  executions completed much faster. This points to response/redirect latency
  beyond the proxy's former 15-second deadline; it does not prove every 502 has
  this cause.
- Storage duplicate prevention was observed. A public HTTP 202 duplicate
  acknowledgement, live changed-payload 409 and email delivery remain unverified.

## Local repair — not yet deployed

| Layer | Previous deadline | New deadline |
| --- | --- | --- |
| Vercel contact proxy and read-only provider health | 15 seconds | 45 seconds |
| Public inquiry form | 20 seconds | 55 seconds |
| Vercel contact function maximum duration | No explicit override | 60 seconds |

The server has time to return its own safe JSON error before the browser stops
waiting. Google fetch redirects and response-body reads use the same abort
signal. A timeout returns HTTP 502 with `INTAKE_TIMEOUT`, never `accepted: true`.
The form preserves its existing idempotency key on unchanged retries and warns
that storage may already have happened. Editing content intentionally starts a
new operation. No styling or dashboard behavior was changed.

The optional AWS pilot shares the intake module but retains its original
15-second provider deadline, safely below its existing 20-second Lambda budget.
No AWS infrastructure or Firebase services were deployed or changed.

Reference: [Vercel per-function duration configuration](https://vercel.com/docs/functions/configuring-functions/duration).

## Publish and verify

1. Renew Vercel CLI login in the owner's terminal. Browser sign-in is separate.
   Do not disclose tokens or bypass denied access to the local credential store.
2. From the repository root, rerun the deployment dry run and confirm
   `.vercelignore` excludes secrets, private backups, local dependencies and build
   output. The assistant's dry run was blocked by CLI cache access and did not
   produce a verified upload inventory.
3. Deploy this local checkout to the linked `nodalx-frontend` production project.
   A dashboard redeploy of an older build will not publish these local edits.
   Do not create another project, enable billing or change DNS for this repair.
4. Check homepage/assets and the contact method/validation responses first.
5. Reuse the existing labelled test's exact payload and operation key from the
   previous live check; do not create another lead. Expect HTTP 202,
   `accepted: true`, `duplicate: true`, and the same row ID. Confirm still one
   matching spreadsheet row. Only then test conflicting content under the same
   key for HTTP 409, without overwriting the original row.
6. If latency still exceeds the new deadline, retain the ambiguity warning and
   stable retry key. Investigate provider latency or design durable asynchronous
   acceptance; do not claim confirmed storage or silently retry with a new key.

Public-intake abuse protection and the authenticated dashboard backend remain
separate release blockers. Apps Script intake success does not establish
workspace dashboard access or notification delivery.
