# Phase 2: inquiry source of truth

Approved 6 October 2026: Supabase replaces Firestore as the pipeline's target
source of truth. Native Supabase Auth is authoritative; no Firebase JWT adapter.
Existing verified `identity_bindings` map `auth.uid()` to exactly one workspace.
Legacy Firebase UID mappings are retained only for independently verified owner
migration. Never infer ownership from an email, incoming workspace ID or company.

## Database contract

Migration 12 extends the existing `public.inquiries` rather than building a
parallel dashboard store. Existing tenant-read RLS remains in force; browsers
cannot insert inquiries or access private connector credentials. New columns:
`source_inquiry_id`, `content_hash`, `intake_source_id`.

Unique `(workspace_id, source_inquiry_id)` is the replay key. SHA-256 is calculated
inside PostgreSQL from canonical contact fields and the exact original message.
Same source ID and same hash returns the original row ID with `duplicate: true`.
Same source ID and different content returns a conflict without overwriting.
Same email OR identical content under a genuinely new source ID is allowed.
Do not enforce email uniqueness or content-hash uniqueness.

Original text/record ownership/source identity/hash cannot be changed by UPDATE,
including privileged writes. Analysis/status/notes remain mutable through their
existing authorized boundaries. Legacy nullable-source records are retained;
do not synthesize source IDs from emails or silently adopt old fingerprints.
Existing fingerprints are retained as metadata but no longer enforce uniqueness.

## Secure ingestion boundary (Phase 3 must wire this)

`public.ingest_source_inquiry(source_key_hash, source_id, inquiry)` is callable
only with backend service-role authority. This is NOT a public Make REST route.
Never give Make a service-role key. An API must verify a high-entropy connector
credential, calculate its hash privately, and pass it to the RPC. A private source
binding chooses the workspace; arbitrary workspace IDs are not accepted.

Each source defaults disabled. Provision a stable binding ID and at least
32 random bytes of secret material through approved server-side administration.
Store only its SHA-256 hash in `private.intake_sources`. Store the real credential
in the website/Make/API secret managers, never exports. Rotation updates the hash
on the SAME source binding; changing binding IDs breaks safe replay continuity.

The source row lock and unique constraint serialize retries, including competing
connectors in one workspace. A source ID must not collide with another connector
in the same workspace; use globally generated opaque IDs (8-128 alnum/underscore/
hyphen characters). Same ID from a different binding conflicts, not links data.

Accepted inquiry fields: name, email, company, message; optional phone, industry,
service. Reject all other fields, malformed types/addresses and oversized input.
The RPC rate-limits successful requests including retries to 60/minute per source;
the next API additionally needs unauthenticated/network abuse limits. No AI, email
or other external side effects occur inside the transaction. Return IDs/status/
duplicate only, never contact content or hashes in client acknowledgements.

## Explicit remaining work

Phase 3 must wire website stable IDs, authenticated Make-to-NodalX ingestion,
durable retry/recovery and storage acknowledgement. The existing public contact
endpoint still uses Apps Script; do not cut over until end-to-end staging passes.
No cloud project, source credentials, live migration or deployment was created.
Firebase package/remnant removal follows verified backend parity and identity
continuity; deleting dependencies now would not migrate their data or routes.

Phase 4 must verify submission, duplicate replay, changed-payload conflict,
cross-tenant denial, same-email repeat inquiry, Make timeout/retry and dashboard
read against the same database. Only then approve production cutover.
