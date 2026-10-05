# NODALxAI system design

## Status

Approved pilot baseline: 1 October 2026. This document is the product and
tenancy contract for implementation. Unresolved decisions are listed at the
end rather than silently invented by an agent.

## Problem

Small businesses receive inquiries through forms, email-adjacent workflows,
spreadsheets and server webhooks. The work is to preserve each request, make
qualification context visible, and help a human decide the next action without
losing the original message.

## Pilot customer and tenancy

- Customer: a small business operator or a small operations team.
- Pilot tenancy: one Firebase Auth UID owns one workspace.
- Workspace-owned records store `customerId`/`uid` and every server read or
  mutation must enforce that owner boundary.
- Team membership, invitations, shared workspaces and role transfer are out of
  scope for the pilot. Do not imply multi-user collaboration in marketing.
- Future migration path: introduce `workspaces/{workspaceId}` and membership
  records only after a team use case is validated.

## Roles and permissions

The pilot has one effective role: workspace owner. The account holder may read
their records, manage their sources and settings, update inquiry status, and
manage their plan. Server-owned entitlement, subscription, quota, API-key and
usage fields cannot be changed by the client.

The future role matrix is documented in `docs/permissions.md` but is not a
launch feature.

## Core workflow

1. A user signs up or signs in with Firebase Auth.
2. The user configures a source: server API key, protected contact intake,
   Google Sheet import, or supported file upload.
3. An inquiry is accepted only after validation and ownership attribution.
4. Firestore stores the original message and source metadata.
5. Optional workflow classification produces explicit fields and a processing
   status. Failure must preserve the inquiry and expose a retryable state.
6. The Inquiry Desk shows the loaded subset, source warnings and original text.
7. The owner reviews, opens an email draft, and explicitly updates status.
8. Usage and plan limits are visible and enforced server-side.

## Data handled

- Inquiry names, email addresses, phone numbers, company, message and source
  metadata. This is customer and potentially personal data.
- Qualification criteria and connector metadata.
- API keys and provider credentials. These are server-owned secrets and must not
  be returned to the browser after initial display or stored in source control.
- Subscription, usage, job and audit metadata.

## Non-functional requirements

- Tenant isolation: a user can never read or mutate another user's records.
- Honest state: accepted means stored; processed means a classification result
  was received; contacted means explicitly marked by the owner.
- Availability: public intake should fail visibly and be monitored; do not claim
  a successful submission when storage or processing failed.
- Privacy: no secret in browser bundles or logs; original message is not sent to
  third parties except configured processing providers.
- Performance: paginated reads for growing lists; no unbounded tenant queries.
- Recovery: maintain an encrypted Firestore/Auth backup and test restoration.

## Out of scope for pilot

- Team invitations, role management, SSO and organisation billing.
- Guaranteed AI classification, autonomous email sending and conversion claims.
- Continuous two-way Google Sheets sync.
- Generic CRM/Airtable marketplace integrations.
- Public API promises beyond the documented inquiry and workspace routes.
- High-availability guarantees while the billing dispute/API suspension remains.

## Product decisions still requiring owner confirmation

- First paid provider and plan prices after the billing dispute.
- Whether Apps Script or a separate free intake service is the long-term public
  intake fallback.
- Data retention and account deletion period.
- Required India privacy/DPDP obligations and customer data-processing terms.
- When the product needs team workspaces rather than UID-owned pilot workspaces.
