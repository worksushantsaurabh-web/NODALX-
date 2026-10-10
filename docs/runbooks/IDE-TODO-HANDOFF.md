# NodalX AI Engineering Handoff & Phase-by-Phase TODO List

> **Sharable prompt & context for AI coding assistants across IDEs (Cursor, Claude Code, Windsurf, Copilot, ChatGPT)**
> **Updated**: 9 October 2026
> **Repository**: `/Users/sushantsaurabh/Desktop/NODALXAI`
> **Git Branch**: `nodalx-staging` (Preserve all uncommitted files in working tree; do not reset/stash/clean)
> **Baseline**: Certified **Golden Build** (Phase 0, 1, and 2 complete and verified)

---

## 1. Quick Context & Architecture

NodalX is an operational intake and follow-up desk for small business inquiries:
```text
Website Form -> secured Vercel backend -> canonical Supabase inquiry -> authenticated dashboard
                                           |
                                           +-> durable analysis job -> worker -> approved model
                                                                         |
                                           dashboard <- validated analysis result
```
- **Approved Target Stack**: React + Vite + Tailwind (`frontend/`), Vercel Serverless Functions (`api/`), Supabase Auth + Postgres (`supabase/`), Resend (`api/send-email`).
- **Make is optional**: Intake uses `supabase-direct` (Website -> Backend -> Supabase via atomic `ingest_source_inquiry` RPC). Make is completely bypassed.
- **Fail-Closed Gate Model**: Staging and production mutate only when `ALLOW_INTAKE_NETWORK="true"` and the source binding in `private.intake_sources` is `enabled=true`. Default is disabled.

---

## 2. Infrastructure Baseline (Verified Cloud Targets)

- **Vercel Project**: `nodalx-frontend` (Team: `worksushantsaurabh-webs-projects`)
- **Staging Preview**: `https://nodalx-frontend-4c31z8phq-worksushantsaurabh-webs-projects.vercel.app` (Deployment: `dpl_Ewi1i6z3EhUGN9gPcwCP8Cta4jSR`)
- **Supabase Staging**: Project `ozovfbwhcvbgpgrxxjcj` (Region: Mumbai, South Asia)
- **Domain & DNS**: `nodalx.in` hosted on Cloudflare. Resend DKIM, SPF, and MX verified.
- **Owner Identity**: Primary staging user `4ec1a5be-1432-47a7-863c-d758152f9423` bound to workspace `supabase:4ec1a5be-1432-47a7-863c-d758152f9423`.

---

## 3. Phase Status Matrix

| Phase | Title | Status | Summary |
|---|---|---|---|
| **Phase 0** | Scope & Route Reconciliation | **COMPLETE** | Supported vs. deferred services audited; UI updated. |
| **Phase 1** | Staging Access & Native Auth | **COMPLETE** | Supabase Auth, OTP flow, branded email templates, tenant isolation verified. |
| **Phase 2** | Direct Intake End-to-End | **COMPLETE** | **Golden Build Certified**: `supabase-direct` live cloud rehearsal passed (Idempotency, RLS, Dashboard visibility, 146/146 SQL tests, 102/102 backend tests). |
| **Phase 3** | Email & Legacy Continuity | **IN PROGRESS (ACTIVE)** | Resend DNS verified, outbound email ledger deployed, provider test send passed. Dashboard lead reply & legacy data migration next. |
| **Phase 4** | Operational AI Classification | **PREPARATION** | Durable jobs & Gemini adapter exist. Waiting on fine-tuned model metadata and offline evaluation. |
| **Phase 5** | Imports & Dashboard Coverage | **PLANNED** | CSV import first. Sheets import deferred. Responsive mobile & accessibility tests. |
| **Phase 6** | Production Pilot & Cutover | **PLANNED** | Production secret provisioning, domain routing, Golden Build promotion to `main`. |
| **Phase 7** | Subscriptions & Retirement | **PLANNED** | Final billing entitlements and Firebase legacy deprecation. |

---

## 4. Actionable Master TODO List

### Phase 3: Outbound Email & Legacy Continuity (Current Active Focus)
- [x] Verify custom domain `nodalx.in` on Resend (DKIM, SPF, MAIL FROM MX resolved on Cloudflare).
- [x] Apply migrations for outbound email ledger (`outbound_email_desk.sql`) and service-role reservation hardening (`harden_outbound_email_reservation.sql`).
- [x] Connect Resend API client (`api/send-email.mjs`) and verify test send to owner inbox.
- [ ] **Step 3.1: Dashboard Lead Email Rehearsal**
  - [ ] Prepare one synthetic inquiry in staging dashboard.
  - [ ] Draft reviewed human reply in dashboard UI composer.
  - [ ] Obtain owner approval immediately before sending.
  - [ ] Verify Resend provider acceptance, idempotency key recording, ledger row commit, and inquiry status transition to `Contacted`.
- [ ] **Step 3.2: Legacy Data Continuity & Identity Mapping**
  - [ ] Define export & ingestion strategy for legacy Google Sheets / Firestore records.
  - [ ] Map legacy user IDs to native Supabase identity bindings without email matching.
  - [ ] Ensure historical inquiry text remains immutable.
- [ ] **Step 3.3: Supabase Auth Email Sender Decision**
  - [ ] Decide whether Supabase Auth confirmation emails keep Supabase platform sender or transition to custom SMTP (`smtp.resend.com`).

---

### Phase 4: Operational AI Classification
- [ ] **Step 4.1: Model Verification (Owner Intake)**
  - Collect provider, model ID, serving endpoint, auth mechanism, dataset provenance, and held-out evaluation metrics without exposing credentials.
- [ ] **Step 4.2: Durable Queue Integration**
  - Connect model adapter behind `analysis_jobs` interface (no client-side direct calls).
  - Add JSON schema validation, classification confidence scores, and unknown/fallback categories.
- [ ] **Step 4.3: Resilience & Safety Controls**
  - Implement per-tenant spend caps, timeout bounds, and global operator kill switch (`ALLOW_PROCESSING_NETWORK`).
  - Keep manual "Analyze" button in dashboard prior to any opt-in automated background classification.

---

### Phase 5: Imports & Dashboard Feature Completion
- [ ] **Step 5.1: CSV Import Pipeline**
  - Implement client-side CSV parsing with strict field validation, row count caps, and downloadable error receipts.
- [ ] **Step 5.2: Deferred Service Indicators**
  - Ensure Google Sheets write-back, custom webhooks, and billing management remain visibly deferred with honest UI labels.
- [ ] **Step 5.3: UI & Accessibility Hardening**
  - Validate responsive layout down to 375px mobile view.
  - Complete keyboard navigation and loading/empty state test coverage.

---

### Phase 6: Production Pilot & Cutover
- [ ] **Step 6.1: Production Secret Provisioning**
  - Generate distinct production `INTAKE_SOURCE_TOKEN` and bind in production database with SHA-256 hash.
  - Inject production variables on Vercel Production environment (`nodalx.in`).
- [ ] **Step 6.2: Backup & Disaster Recovery Drill**
  - Run database dump and test isolated restore drill.
  - Establish automated backup retention policy.
- [ ] **Step 6.3: Production Cutover Promotion**
  - Promote `nodalx-staging` Golden Build to `main`.
  - Perform live post-cutover smoke test on `nodalx.in` (liveness probe, contact form submission, dashboard read).

---

### Phase 7: Subscriptions & Legacy Deprecation
- [ ] Configure Stripe / billing entitlements after measured production costs.
- [ ] Decommission legacy Firebase project, close suspended cloud billing resources, and clean residual legacy files.

---

## 5. Non-Negotiable Invariants

1. **Zero Secrets in Git**: Never commit credentials, private keys, customer records, or raw authentication hashes.
2. **One Auth Identity = One Workspace**: Never authorize by email lookup or trust client-supplied workspace IDs. Bindings are enforced via `public.identity_bindings`.
3. **Preserve Exact Inquiry Text**: Original messages in `public.inquiries` are immutable; AI analysis and human tags live in separate columns/tables.
4. **Idempotency & Deduplication**: Same source ID + same payload returns existing row (`duplicate: true`); changed payload returns `409 Conflict`.
5. **No AI/Email Hard Dependency**: Intake storage must succeed even if AI classification or email delivery fails.
6. **No Automatic Customer Emails**: All dashboard replies require explicit human review and owner confirmation.
7. **Always Update Project Memory**: Update `AGENTS.md` and migration logs after every implementation.

---

## 6. Standard Validation Commands

Always run these verification commands before handoff or committing changes:

```bash
# 1. Typecheck and build frontend
npm --prefix frontend run typecheck
npm --prefix frontend run build

# 2. Run backend & integration tests (includes local opt-ins if Docker is active)
npm run test:intake

# 3. Run Supabase pgTAP SQL assertions (requires Docker)
npm run test:supabase

# 4. Run repository secret scanner
node scripts/scan-secrets.mjs

# 5. Check formatting and whitespace hygiene
git diff --check
```

---

## 7. Next IDE Prompt to Copy/Paste

```text
Act as a Staff-level systems architect and senior full-stack engineer.
Continue development on NodalX at /Users/sushantsaurabh/Desktop/NODALXAI on branch nodalx-staging.
Review docs/runbooks/IDE-TODO-HANDOFF.md, AGENTS.md, and docs/runbooks/ide-handoff-current-2026-10-07.md.

Preserve the uncommitted working tree. Do not reset, clean, or stash.
The Golden Build is certified (Phases 0, 1, and 2 complete with direct-intake live verified).
We are actively working on Phase 3: Outbound Email & Continuity.

Next Immediate Task:
Execute Phase 3 Step 3.1: Prepare and execute a reviewed dashboard lead reply email test from an authenticated staging session using Resend, verifying provider acceptance, idempotency ledger commit, and inquiry status transition to 'Contacted'.

Always maintain fail-closed gates, verify RLS tenant isolation, and run the standard validation suite (secret scan, tests, typecheck/build, git diff check) after every change.
```
