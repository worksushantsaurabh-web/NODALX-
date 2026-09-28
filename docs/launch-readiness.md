# NodalX launch direction

## Product outcome

NodalX is an inquiry intake and follow-up desk for small teams that currently copy leads between forms, spreadsheets, and inboxes. A useful first release captures every inquiry, records its original message, optionally classifies intent and urgency, and gives a human a clear next action. The dashboard should measure loaded inquiries and their review status, not claim conversions or automation health without event evidence.

This addresses a real workflow: Salesforce's [State of Sales, 7th Edition](https://www.salesforce.com/en-us/wp-content/uploads/sites/4/documents/reports/sales/salesforce-state-of-sales-report-2026.pdf?bc=OTH) reports that sales representatives spend more than half their time on work outside selling, including data entry and prospecting. The product hypothesis is that reducing this manual transfer and triage time improves response speed. Validate that with pilot users before claiming revenue impact.

## Release flow

1. A company's server posts an inquiry to `/api/inquiries` with its `X-API-Key`. An automation may use `/api/webhook/{workspaceId}` with the same key and required fields. Reuse an `Idempotency-Key` header on retries to prevent duplicate records.
2. The API saves the original inquiry in Firestore. A `202` response confirms storage and returns an ID and `processingStatus`.
3. If `MAKE_WEBHOOK_URL` is configured, the workflow may return classification fields. Failed or missing classification stays visible as such.
4. The Inquiry Desk lets a teammate review the original text, prioritize based on returned fields, open an email draft, and explicitly update status.
5. Google Sheets is an optional import and export path. It is not the database for the dashboard.

## Integrations to prioritize

1. **Website forms and server webhooks:** first priority because they create the inquiry record. Keep API keys on servers or trusted automation platforms.
2. **Google Sheets:** useful for onboarding companies whose historical leads already live in sheets. Verify the service account email shown by the API, share a sheet with Editor access, and process a limited batch. Sheet analysis requires a configured workflow and writes results back only when every processed row has a returned classification. Do not present it as continuous sync.
3. **Slack alerts:** optional after intake and status updates are stable. A saved webhook URL does not prove delivery; use the test action and log failures.
4. **CRM push:** add after customer interviews identify the CRM most pilot teams actually use. Avoid advertising generic CRM or Airtable sync before a working connector exists.

Google documents [per-minute read and write quotas](https://developers.google.com/workspace/sheets/api/limits) and recommends batching. Sheets suits migration and lightweight export, but Firestore is a better source for the live work queue. Google also documents [append and batch value operations](https://developers.google.com/workspace/sheets/api/guides/values); use those carefully so repeat imports do not duplicate or overwrite user data.

## Configuration before publication

- Set `NODALX_OWNER_UID` in the Firebase Functions environment to the Firebase Auth UID that should receive inquiries from the public NodalX contact form. Set it in `backend/.env.local` for local development. Until this is set, `/api/contact` returns `503` and the form reports a failure instead of pretending success.
- Set `MAKE_WEBHOOK_URL` for AI classification. Without it, customer inquiries are stored with `processingStatus: not_configured`; Google Sheet analysis returns `503`.
- Deploy Functions and Hosting together after configuration, then submit a real test inquiry and verify that it appears in the intended dashboard. Local build and syntax checks cannot prove deployed credentials, Firestore indexes, Make responses, or Google Sheets permissions.
- Keep the workspace API key out of public browser code. Rotate any key previously pasted into a public site.

## Next release checks

- Require partners to send an `Idempotency-Key` on retries. The endpoint supports it, but callers that omit it can still create duplicate records.
- Confirm the exact Make response schema and log workflow run IDs so AI processing and alert delivery can be audited.
- Add pagination once a workspace can exceed the current 100-record dashboard fetch.
