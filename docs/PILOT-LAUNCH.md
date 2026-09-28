# NodalX Pilot Launch

## Offer To Validate

An inquiry response desk for small web-development agencies: one website form,
one qualification rubric, a prioritized queue, and one notification destination.
Sell faster, more reliable follow-up, not a general AI platform.

Pricing hypothesis: $250 setup plus $99/month with a defined inquiry allowance.
Validate willingness to pay and support costs before treating this as the price.

## First Implementation

- [x] Shared Inquiry Desk with search, exact status filters, sorting, and load more.
- [x] Clickable counts labeled as loaded records, not today's or lifetime totals.
- [x] Side-by-side desktop details and stacked mobile details.
- [x] Explain deterministic priority rules without inventing AI evidence.
- [x] Keep stale records on refresh failure and show per-source fetch status.
- [x] Keep Apps Script identities separate and disable unsupported cross-source edits.
- [x] Surface failed status saves and clipboard operations.
- [x] Remove fabricated upload results and submission success on network errors.
- [x] Label opaque Apps Script submission delivery as unverified.
- [x] Add nine queue logic regression tests.

These items do not establish production readiness. Authenticated browser flows,
cloud integrations, and tenant isolation still need verification.

## Blockers Before Real Customer Data

- [ ] Choose the canonical backend and align frontend/API response contracts.
- [ ] Persist a tenant owner on every inquiry; filter every read and authorize every mutation.
- [ ] Test that two signed-in customers cannot read or change each other's records.
- [ ] Secure or remove unauthenticated Apps Script list endpoints.
- [ ] Replace opaque form submission with confirmed, tenant-attributed intake.
- [ ] Add durable intake, idempotency, rate limits, and actionable delivery errors.
- [ ] Implement and test persisted status updates in the selected backend.
- [ ] Verify key handling and tenant ownership for Sheets, Slack, and HubSpot.
- [ ] Protect subscription fields from client writes and review WebSocket authentication.
- [ ] Resolve dependency security findings and run repeatable CI checks.
- [ ] Verify signed-in desktop/mobile layouts, keyboard flow, refresh failures, and retry behavior.
- [ ] Review privacy promises, deletion/export, backups, and monitoring before public launch.

Do not infer delivery, receipt time, or AI execution health from a successful
list fetch. Current source activity dates are not verified submission times.
The Express customer list is limited to 100 records and does not return all
classification/message fields. Apps Script records are read-only in the desk.
Bulk upload controls are not currently exposed in the connectors UI; fixing the
upload handler alone does not make that feature available to customers.

## Customer Validation

- [ ] Interview 10 agency owners about real inquiry volume and missed follow-ups.
- [ ] Recruit three pilots with written scope, price, and success criteria.
- [ ] Record baseline response time, overdue inquiries, and triage time.
- [ ] Onboard manually after the security and intake blockers above are resolved.
- [ ] Review outcomes weekly and ask for a paid renewal.
- [ ] Track hosting, model usage, support hours, and margin per customer.
- [ ] Publish a permissioned case study and short product demo.
- [ ] Add self-service checkout only after renewal demand is demonstrated.

## Local Checks

From the workspace root:

```sh
API_BACKEND_PORT=5001 VITE_API_BASE_URL='' npm run dev
npm run build --prefix frontend
node --test frontend/pages/inquiryDesk.test.ts
node --check frontend/public/widget.js
```

The development URL is `http://localhost:5173/#/dashboard` and requires sign-in.
Port 5001 avoids macOS services commonly listening on port 5000. Local servers
may still call configured cloud services; this is not an isolated emulator setup.
Do not submit real customer information as test data.
