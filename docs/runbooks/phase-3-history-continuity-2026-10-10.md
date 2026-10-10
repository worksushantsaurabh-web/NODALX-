# Phase 3 history and identity continuity

Status: blocked on an authorized legacy export. The live RDS inquiry desk shows
new RDS records; an empty RDS list does not prove that historical Google Sheet
or Firestore inquiries are absent. The API states this limitation to the owner.

## Source inventory and recovery record

1. Obtain read-only access to the suspended Firebase project and the specific
   owner-controlled Google Sheet. Record project ID, collection paths, sheet ID,
   tab names, owner account, export time and whether each source was accessible.
   Do not reactivate Google billing or deploy legacy Functions for this step.
2. Export to a private encrypted location. The existing
   `scripts/backup-firestore.mjs` preserves Firestore document paths and typed
   values and writes a SHA-256 manifest, but its snapshot is not consistent and
   excludes Firebase Auth, Storage, rules and indexes. Export Sheets separately
   with row IDs, tab names, raw cell values and original timestamps. Restrict
   access to the migration operator; never commit or attach customer data.
3. Before importing, write a manifest with counts, checksums, source locations,
   export operator/time, inaccessible sources and known gaps. Retain immutable
   originals until the destination and rollback have been independently checked.

## Identity and data mapping gate

- Use a verified Supabase Auth UID and a trusted, operator-reviewed legacy UID
  binding to select the RDS workspace. Never infer ownership from an email,
  company name, browser workspace ID or Sheet row alone. Put ambiguous records
  in a private review set; do not expose them in any customer's workspace.
- Preserve original message, source document/row ID, source timestamp and source
  lineage. Use a deterministic import key scoped to the verified workspace and
  source so retries cannot create duplicates. Do not overwrite live RDS inquiry
  rows or invent missing classification/status values.
- Stage a dry-run mapping report first: source count, duplicate IDs, unmapped
  owners, malformed rows, expected inserts and conflicts. Import only after
  owner mapping and destination backup are reviewed.
- Verify row counts, checksums and a sample of exact original messages and
  timestamps. Confirm owner visibility and another tenant's denial using real
  authenticated sessions. Re-run the import to prove idempotency, then rehearse
  rollback in a separate database before considering production import.

## Current boundary

No legacy export or import has been run for this phase. The Firebase project is
reported suspended, so access and source completeness are unknown. Keep the
dashboard history notice visible until the above verification passes. Record
inaccessible history explicitly rather than reporting an empty inbox as a full
migration.
