# NodalX launch direction

## Product outcome

NodalX is an inquiry intake and follow-up desk for small teams that currently copy leads between forms, spreadsheets, and inboxes. A useful first release captures every inquiry, records its original message, optionally classifies intent and urgency, and gives a human a clear next action. The dashboard should measure loaded inquiries and their review status, not claim conversions or automation health without event evidence.

This addresses a real workflow: Salesforce's [State of Sales, 7th Edition](https://www.salesforce.com/en-us/wp-content/uploads/sites/4/documents/reports/sales/salesforce-state-of-sales-report-2026.pdf?bc=OTH) reports that sales representatives spend more than half their time on work outside selling, including data entry and prospecting. The product hypothesis is that reducing this manual transfer and triage time improves response speed. Validate that with pilot users before claiming revenue impact.

## Release flow

The authoritative pilot path is browser → Firebase Functions `/api/contact` → owner-scoped Firestore. The Vercel-to-Apps-Script proxy is an alternate configuration, not the current production architecture. Its Sheet submissions do not automatically enter the Firebase dashboard; a protected import or bridge is required. Production Functions remains blocked by the owner's billing suspension.

1. A company's server posts an inquiry to `/api/inquiries` with its `X-API-Key`. An automation may use `/api/webhook/{workspaceId}` with the same key and required fields. Reuse an `Idempotency-Key` header on retries to prevent duplicate records.
2. The API saves the original inquiry in Firestore. A `202` response confirms storage and returns an ID and `processingStatus`.
3. If `MAKE_WEBHOOK_URL` is configured, a background job sends the inquiry to the workflow. It must return JSON with a nonempty `classification` object. Failed or missing classification stays visible and can be retried. The original inquiry remains saved.
4. The Inquiry Desk lets a teammate review the original text, prioritize based on returned fields, open an email draft, and explicitly update status.
5. Google Sheets is an optional import and export path. It is not the database for the dashboard.

## Integrations to prioritize

1. **Website forms and server webhooks:** first priority because they create the inquiry record. Keep API keys on servers or trusted automation platforms.
2. **Google Sheets:** useful for onboarding companies whose historical leads already live in sheets. Share a sheet with the displayed service account, prove control using the verification tab, preview a mapping, and process a limited batch. Viewer access is enough for imports; Editor access is needed only for optional export into a separate results tab. Successful rows are retained if other rows fail. This is a deliberate import, not continuous sync.
3. **Slack alerts:** optional after intake and status updates are stable. A saved webhook URL does not prove delivery; use the test action and log failures.
4. **CRM push:** add after customer interviews identify the CRM most pilot teams actually use. Avoid advertising generic CRM or Airtable sync before a working connector exists.

Google documents [per-minute read and write quotas](https://developers.google.com/workspace/sheets/api/limits) and recommends batching. Sheets suits migration and lightweight export, but Firestore is a better source for the live work queue. Google also documents [append and batch value operations](https://developers.google.com/workspace/sheets/api/guides/values); use those carefully so repeat imports do not duplicate or overwrite user data.

## Configuration before publication

- Set `NODALX_OWNER_UID` in the Firebase Functions environment to the Firebase Auth UID that should receive inquiries from the public NodalX contact form. Set it in `backend/.env.local` for local development. Until this is set, `/api/contact` returns `503` and the form reports a failure instead of pretending success.
- Set `MAKE_WEBHOOK_URL` for classification. Without it, inquiries are stored as `awaiting_analysis`; import analysis returns `503`.
- Create monthly Starter and Growth plans in Razorpay and set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `RAZORPAY_STARTER_PLAN_ID`, and `RAZORPAY_GROWTH_PLAN_ID` on the API runtime. Configure the Razorpay webhook URL as `/api/billing/webhook`. The displayed price comes from those provider plans. Checkout stays disabled until the provider is configured.
- Deploy `firestore.indexes.json` and `firestore.rules` before switching production traffic to these API routes. Run a paid test checkout and a signed webhook test in Razorpay test mode before enabling live billing.
- Only after billing access is resolved, deploy the reviewed API, rules/indexes, and Hosting separately. Submit a signed test inquiry and verify that it appears in the intended dashboard. Local build and syntax checks cannot prove deployed credentials, Firestore indexes, Make responses, or Google Sheets permissions.
- Keep the workspace API key out of public browser code. Rotate any key previously pasted into a public site.

## Next release checks

- Require partners to send an `Idempotency-Key` on retries. The endpoint supports it, but callers that omit it can still create duplicate records.
- Confirm the exact Make response schema and log workflow run IDs so AI processing and alert delivery can be audited.
- Cursor pagination now supports inquiries beyond the first 100. Overview uses server-side counts across the selected period; the desk clearly labels its loaded subset. Validate production indexes before release.

## Workspace plans and limits

| Plan | Term | Inquiry allowance | Analysis credits | Rows per job | Sheets | Concurrent jobs |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Trial | 14 days | 100 | 50 | 25 | 1 | 1 |
| Starter | Monthly | 2,000 | 500 | 100 | 1 | 1 |
| Growth | Monthly | 10,000 | 2,000 | 500 | 3 | 2 |

One inquiry uses one inquiry allowance when first saved. One successful classification consumes one analysis credit. A failed classification releases its reservation and can be retried. Intake idempotency and import fingerprints prevent retries from silently consuming duplicate allowances. Plan expiration blocks new intake and analysis while preserving readable inquiries and prior results. Existing full-tier users receive a 30-day Starter transition when their server-side subscription record is first created; this is a migration allowance, not a recurring grant.

The Google Sheets connector scans up to 1,000 data rows per preview and never edits the source tab. File uploads support CSV, TSV, XLS, and XLSX up to 4 MB and 10,000 rows, subject to a 600 KB parsed text limit. The browser can export processed results as CSV. Qualification settings are passed to the workflow as `criteria`; the configured workflow must use that field for the settings to influence classification.
