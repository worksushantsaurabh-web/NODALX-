# Phase 3 backend operations and release gates

The new transport is website -> private durable submission buffer -> scheduled
Make lease handoff -> canonical Supabase inquiries -> native-auth dashboard API.
Saving a buffer entry before contacting Make is deliberate: a Make outage must
not discard an accepted submission. The buffer is private transport state, not
another dashboard database. Successful canonical completion clears its payload.

## Configuration

Default `INTAKE_PROVIDER=apps-script` preserves the existing public endpoint.
`supabase-direct` writes website inquiries directly to canonical Supabase through
the server-only `ingest_source_inquiry` RPC; it is the staging target when Make is
optional. `make-supabase` remains an optional durable queue mode where Make must
complete the handoff before dashboard visibility. Both Supabase modes require
explicit `INTAKE_ENVIRONMENT`, approved Supabase URL/service credentials,
`ALLOW_INTAKE_NETWORK=true`, and `INTAKE_SOURCE_TOKEN`. The Make consumer also
requires `MAKE_INTAKE_ENABLED=true` and a DIFFERENT `MAKE_INTAKE_TOKEN`. Never
reuse processing tokens or copy service-role credentials to Make. Use an enabled
private source binding whose credential hash matches the server source secret.
Keep its binding ID unchanged during credential rotation.

Local mode permits only 127.0.0.1. Staging/production permit only HTTPS approved
Supabase cloud origins. Production accounts/resources/deployment have not been
created or modified. Neither website acceptance nor this router calls Gemini.

## Response meanings

- Website 202 in `make-supabase`: the original is durably queued, processing, or previously stored.
  `id` is the stable transport ID, NOT a dashboard inquiry ID. No email/AI claim.
- Website 201 in `supabase-direct`: canonical inquiry storage is confirmed;
  same-payload retry returns 200 with the original inquiry ID and `duplicate:true`.
- Make `claim` returns only IDs and a lease, never message/email/credential hash.
- Make `complete` resolves original payload/tenant from durable state; no client
  payload or workspace is accepted. 200 `stored` confirms canonical storage.
- Same stored lease replay returns its original receipt with `duplicate:true`.
- Wrong/expired/unclaimed lease returns 409 before storing; changed website
  data under an old source ID conflicts. Never retry changed data as the old ID.
- Website failure/timeout 503 may be ambiguous: reuse the same submission key.
  Never fall back to a second store automatically; that can create divergent data.

This new intake mode does NOT yet send the legacy confirmation/owner emails.
The existing Apps Script email flow is unchanged in default mode. Notification
parity or explicit approval to launch without it is a production release gate.
Historical Sheets/Firestore data and verified legacy identity continuity are
separate migrations, not silently adopted by this router.

## Recovery

Leases expire in 120 seconds; claim again to recover a crashed worker. After
eight expired attempts the row becomes `failed` and retains its original payload.
Public resubmission of that key returns `INTAKE_RECOVERY_REQUIRED`, not false
success. Inspect metadata only, through privileged administration:

```sql
SELECT id, state, attempts, created_at, updated_at
FROM private.intake_deliveries
WHERE state IN ('queued','processing','failed')
ORDER BY created_at;
```

After resolving the cause, a privileged operator can call
`public.retry_intake_delivery(record_delivery uuid)` for a failed row. This keeps
the source key/original intact, resets attempts, and fences old callbacks. It
cannot retry a stored row. This RPC is not exposed as a public recovery endpoint.
Never log/export payloads, hashes, lease tokens or contact information.

Operator pause: disable the Make intake HTTP consumer and/or source binding.
Disabling a source stops its website intake and completion; originals remain.
Avoid accepting a queue indefinitely without a recovery plan. Backlog guard is
1000 pending per workspace; source staging accepts at most 60/minute, and Make
router accepts at most 120 successful claim/completion calls per minute globally.
Size polling/loop throughput and monitor oldest pending age against demand.
These application limits do not replace public edge abuse/bot protection.

## Production checklist (not performed)

- Owner confirms cloud project/region, source binding, private Make editor URL,
  credential-store configuration and approved operation budget/schedule.
- Configure edge/WAF/bot limits before enabling a public production intake route.
- Verify disabled Make duplicate with synthetic staging only, exact 200/202/409/
  429/503 branches, no raw PII, lease recovery and replay.
- Verify canonical inquiry appears through the SAME authenticated dashboard API,
  not Airtable/Sheets and not another Supabase project.
- Approve notification behavior, legacy identity/data migration and rollback.
- Rollback does not delete pending originals. Disable source intake, drain or
  preserve queued work, reconcile canonical acknowledgements, then switch the
  website configuration deliberately. Never replay a new source ID in both stores.
- Only after release approval deploy/cut over; default mode remains legacy here.

Apps Script fallback fix: ContentService TextOutput has no arbitrary setHeaders
or HTTP-status API. Calls are server-to-server, acknowledgements are body-based;
do not claim the old ALLOWED_ORIGIN property enforces browser CORS through it.
