# NodalX import and processing: implementation and service roadmap

Date: 1 October 2026. Recommendations are product judgments, not validated demand,
measured ROI, compliance advice, or claims that these services already work.

## Positioning

Start with **a review-first operations desk for messy business inquiries**:
source → preview → validate → explicitly import or analyze → review → export.
Sell fewer copy/paste steps, visible exceptions and traceable outcomes, not
"process anything" or autonomous decisions. The pilot remains one owner UID per
workspace. Marketing for teams must not imply shared accounts or role support.

## Implemented in this pass

1. Import-only mode saves eligible inquiries without a processing provider or
   analysis credits. It still requires an active plan, inquiry allowance, batch
   limit and an available processing slot. The worker must run to finish jobs.
2. Readiness checks show preview, plan, available inquiry allowance (including
   reservations), occupied slots and analysis configuration/credits.
3. Preview returns format warnings, missing emails, skipped blank messages,
   exact mapped duplicates and previously imported rows. Issues carry source
   row references and recovery instructions, not customer text or emails.
4. Download up to 100 preview issues; filter recent jobs by title/status;
   filter and download failed job rows. Existing failed-analysis retry is kept.
5. Imported inquiries retain job ID, source title and row number for traceability.
6. Server validates mode and mapping on job creation, not only preview. Excel
   headings are normalized consistently with their data keys.

Original message content is not rewritten or generated. Existing boundary
whitespace trimming and email lowercase semantics remain unchanged. Exact
duplicate identity compares name/email/company/message, not email alone.
Email-format checks are advisory: they do not prove deliverability or consent.
Warnings are counted on unique eligible source rows before workspace dedupe;
quality counters can therefore include rows already imported into the workspace.
No source cells are modified. Exports target a separate results tab using RAW
values; CSV downloads keep existing formula-injection escaping.

## What companies manually process

| Workflow / raw input | Useful output | Fit / sequence | Important boundary |
| --- | --- | --- | --- |
| Sales inquiries: form exports, spreadsheets, CRM exports | Preserved request, qualification aid, next action and follow-up status | Launch: existing inquiry schema | Suggestions are not guaranteed fit or conversions; people send replies |
| Contact cleanup: customer/lead CSVs | Missing-field report, normalized suggestions, duplicate review, CRM-ready export | Next: separate contact service | No invented email/phone, no silent merge, no identity match based on name alone |
| Support requests: ticket exports and service messages | Topic, language, priority suggestion, exception queue | First adjacent service pilot | Separate ticket schema; do not label tickets as sales inquiries or claim shared routing |
| Customer feedback: surveys, reviews, cancellation reasons | Reviewed topics, supporting original responses, trend counts | Second adjacent pilot | No unsupported sentiment certainty; counts require explicit denominator and sampling coverage |
| RFQs and vendor requests: quote spreadsheets | Requested items, deadlines, missing specs, comparison checklist | Later, after typed fields | No autonomous supplier award or invented specifications |
| Invoices, receipts, purchase orders: PDFs/images | Extracted fields/line items, totals checks, duplicates, human approval export | Later document service | OCR, currencies/tax schemas and review required; no payments or accounting posting |
| Inventory/catalog exports | Missing SKU report, duplicate IDs, invalid prices, unit normalization suggestions | Later deterministic service | Preserve SKU case and units; do not invent stock or overwrite ERP records |
| Order/delivery exports | Duplicate order IDs, missing tracking, state exceptions and aging | Later typed service | Define source of truth and timezone; no unsupported real-time tracking |
| Recruitment, payroll, lending, medical and legal records | Potentially sensitive workflows | Exclude from initial roadmap | Separate privacy/permissions design; no automated high-impact eligibility decisions |

These are candidate use cases, not evidence that NodalX customers will pay.
Interview pilot users before funding a new provider or adding dashboard cards.

## Research grounding

- [Google Sheets Smart Cleanup](https://support.google.com/docs/answer/10098582?hl=en)
  already provides cleanup suggestions and column statistics. NodalX should not
  compete as merely a prettier spreadsheet: differentiation should be repeatable
  processing, visible exceptions, saved outcomes and review history.
- [HubSpot deduplication documentation](https://knowledge.hubspot.com/records/deduplication-of-records)
  describes contact/email and company/domain matching plus record identifiers.
  A contact-cleanup service therefore needs explicit record identity and update
  policies; inquiry fingerprints are not a substitute for a CRM contact model.
- [Zendesk intelligent triage](https://support.zendesk.com/hc/en-us/articles/4964463770650-About-intelligent-triage)
  uses topic, sentiment, language and entities for ticket workflows. This supports
  support-triage as an adjacent pattern, not proof that NodalX implements it.
- [Qualtrics Text iQ](https://www.qualtrics.com/support/survey-platform/data-and-analysis-module/text-iq/text-iq-functionality/)
  documents topic-based text analysis. Feedback processing should retain source
  evidence and reviewed labels before presenting aggregate findings.
- [Microsoft invoice extraction](https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/prebuilt/invoice?view=doc-intel-4.0.0)
  documents OCR and structured field/line-item extraction from invoices. This is
  a different input pipeline from CSV inquiry classification, not a free extension
  of the current message field.

## Google Sheets decision

Keep Sheets as an explicit source and optional results destination. Small firms
can continue using their sheets while moving repetitive review into NodalX.
Do not build a spreadsheet editor or describe manual imports as live sync.
Viewer import and optional Editor export permissions must remain distinct.
Current service-account ownership verification must be tested on a dedicated
staging sheet before release; local emulators do not prove provider access.
CSV/Excel should remain usable when the Sheets connector is unavailable.
OAuth may reduce setup friction later, but introduces token storage, consent,
revocation and provider review work; it is not enabled by this change.

## Step-by-step remaining delivery

1. **Release the import foundation:** resolve the existing production API billing
   blocker, review Functions/rules/indexes, then run a real owner-approved import,
   worker completion, raw inquiry review and CSV/Sheet export in staging.
2. **Repeatable import recipes:** UID-owned named mappings, exact header/schema
   compatibility checks and an explicit Apply action. Do not store customer data
   in browser localStorage or reuse another owner's recipes.
3. **Operational reliability:** bounded paginated job detail/history, stale-worker
   warning based on heartbeat, cancellation that releases only unspent reserves,
   row-specific retry selection and interruption/recovery tests. Current UI polls
   every five seconds; that is not evidence of worker health.
4. **Contact data-quality service:** implement deterministic checks and exports
   first; keep records outside `inquiries`; preview proposed changes and require
   approval for merges. Deliverable: source-to-output comparison and issue queue.
5. **Choose one adjacent classification service:** pilot support triage OR feedback
   tagging with agreed typed output, sanitized examples and evaluated fixtures.
   Do not expose both as working services before an end-to-end test.
6. **Documents last:** add file malware/type limits, private object storage, OCR,
   page-level metering, source evidence and human review before invoice exports.
7. **Recurring imports after manual reliability:** schedules need revoked-source
   handling, run-level budgets, idempotent source cursors, failure alerts and
   explicit owner consent. Do not silently enable scheduled spending.

## Architecture required before more service buttons

- Server-allowlisted service identifier and schema version, never an arbitrary
  client webhook URL or prompt; authorization and entitlement per service.
- Service-specific records/output schemas, independent from sales inquiries.
- Source snapshot, row/document reference, transformation version and human
  review state. Preserve original data, show uncertain/missing results.
- Transactional reservations, leases, bounded retries, provider idempotency,
  redacted logs and completion/recovery metrics across all services.
- Prevent imported text from controlling tools or instructions; validate provider
  outputs. No outbound sending, CRM writes, accounting writes or supplier awards
  without separately designed explicit approval.
- Define retention/deletion, provider data handling and cost ceilings before
  accepting documents or more sensitive business datasets.

## Subscription boundaries

Existing server-owned limits remain unchanged:

| Plan | Inquiry allowance | Analysis credits | Sheets | Batch rows | Concurrent jobs |
| --- | ---: | ---: | ---: | ---: | ---: |
| Trial (14 days) | 100 | 50 | 1 | 25 | 1 |
| Starter | 2,000 | 500 | 1 | 100 | 1 |
| Growth | 10,000 | 2,000 | 3 | 500 | 2 |

Import-only is included within inquiry allowance, not unlimited storage.
Successful inquiry classifications cost one analysis credit; failures/duplicates
do not. Existing results remain readable/exportable after expiration.
Do not bill future OCR pages, cleanup rows and inquiry classifications as the
same unit without measured provider costs and a disclosed conversion policy.
Proposed future entitlements should include allowed services, import row budget,
document page budget, storage retention and schedule run cap, all server-owned.
Prices, add-ons and payment changes are not implemented here.

## Pilot measurement and stop conditions

For 3–5 consenting companies, observe an existing task, collect a sanitized
representative sample, agree the correct output, and compare manual versus
NodalX work. Track import completion, warnings corrected, duplicate handling,
processing failures, reviewed suggestions, actual handling time and provider
cost. Do not fabricate savings or classify a saved draft as a sent reply.
Stop expansion if source access is unreliable, records disappear, failures are
opaque, cross-workspace isolation breaks or actual cost exceeds the agreed cap.

## Validation and limitations

Run frontend build/typecheck and helper tests; Functions lint/unit tests;
Auth/Firestore integration tests (including import-only with exhausted credits,
quota/slot/expiration enforcement, idempotency, ownership, fresh snapshots and
optional later analysis). Inspect responsive import UI with synthetic data.
Production Functions, real Sheets/OCR/CRM providers, payment flows, restore,
provider retention and load/scale are not verified by local testing.
Nothing in this pass enables billing, changes DNS or deploys the project.

Local validation result: frontend build/typecheck and 18 frontend tests pass;
Functions lint and 20 unit tests pass; 16 Auth/Firestore integration tests pass
without skips. Synthetic browser import saved three inquiries and used zero
credits, analysis-without-provider was blocked, source issues and completed-job
filters were visible. Responsive checks at 320, 375, 768, 1024 and 1440px found
no horizontal control overflow; light and dark import layouts were inspected.
Working-tree secret scan (192 files) and diff whitespace check pass. These are
local checks, not a live provider certification or exhaustive accessibility audit.
