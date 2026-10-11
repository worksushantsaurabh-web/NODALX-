# OCI Migration — Session Handoff for Codex

**Date:** 11 October 2026
**Branch:** `nodalx-staging` (working tree has uncommitted Phase 0 changes — see "Working Tree State")
**Purpose:** Continue the Oracle Cloud Infrastructure migration. Read this file first, then `AGENTS.md`, then `docs/LLM-MIND.md`.

---

## 1. NON-NEGOTIABLES (from AGENTS.md, still binding)

- Never commit secrets, credentials, customer exports, or auth hashes.
- Never print secrets into logs or terminal output.
- Do not deploy, change DNS, change firewalls, or change database access **without explicit owner approval and an explanation of impact first**.
- Do not delete existing configurations without approval.
- Prefer incremental, reversible changes. Preserve existing functionality.
- Update `AGENTS.md` and `docs/LLM-MIND.md` in the same turn as any implementation.
- Run tests, build, secret scan, and `git diff --check` before calling anything complete.
- Distinguish verified facts from assumptions. Do not call a preview/mock a live integration.

---

## 2. WHAT WE ESTABLISHED THIS SESSION

### 2.1 Architecture (verified by code inspection)

| Layer | Actual technology |
|---|---|
| Frontend | React 19 + TypeScript + Vite + Tailwind, **static build** |
| Backend | **Node.js ESM serverless functions on Vercel** (`api/*.mjs` + `server/*.mjs`) |
| API style | Hand-rolled Vercel `req`/`res` handlers. **Not Next.js.** No Express in the production path. |
| Database | **PostgreSQL 18.3 on AWS RDS**, database `nodalx_app`, region `us-east-1` |
| ORM | **None.** Hand-written Supabase/PostgREST-compatible client in `server/rds-client.mjs` |
| Auth | Hosted **Supabase Auth** (identity only). Every request does a live `auth.getUser()` round-trip. |
| AI | Google Gemini API + approved-HTTP adapter. **Currently gated OFF.** |
| Queue | **Postgres-backed** (`FOR UPDATE SKIP LOCKED`, 120s lease, 3 attempts). **No Redis anywhere in the repo.** |
| Background worker | Exists and is Docker-packaged (`scripts/processing-worker.Dockerfile`) — **never built, never deployed** |
| Cron | **None on Vercel.** Only in legacy `functions/` which is not deployed. |
| Deploy | Vercel Git integration + CLI. `.vercelignore` is a **strict allowlist**. |
| CI | One GitHub Actions workflow, `main` only, **no deploy job** |

**Production state:** 1 workspace, 1 user, **0 inquiries**, 0 outbound emails. Effectively idle traffic.

### 2.2 ARM64 verdict: NO BLOCKERS

Every production dependency is pure JS (`pg`, `resend`, `@supabase/supabase-js`). No native modules. `node:24-alpine` publishes arm64.

---

## 3. ORACLE CLOUD SITUATION

| Fact | Value |
|---|---|
| Region | **Mumbai (ap-mumbai-1)** |
| Shape | VM.Standard.A1.Flex |
| Allocated | 2 OCPU / 12 GB |
| Boot volume | 200 GB, Balanced (10 VPU/GB) |
| OS | Oracle Linux Server 9.8, user `opc` |
| Docker | Installed and working (Engine + Compose v5.6.0), enabled at boot |
| Hostname | `vcnmodelhosting.oraclevcn.com` (OCI-provided VCN domain) |
| SSH key | `~/.ssh/oracle_nodalx.key` (key exists; host not yet in known_hosts) |

### 3.1 Account tier — IMPORTANT CORRECTION

The tenancy shows the **PAYG banner**: "first 3,000 OCPU hours and 18,000 GB hours per month for free… (equivalent to 4 OCPUs and 24 GB of memory)".

- This is the **paid-account** allowance, NOT the halved free-tier allowance.
- The 2 OCPU / 12 GB figure quoted widely since June 2026 applies only to **free-tier** accounts.
- **So the box has roughly 4 OCPU / 24 GB available, and 2/12 uses only half.**
- Do not repeat the earlier claim that "we are at the hard ceiling with no headroom" — **that was wrong.**

### 3.2 Boot volume cost — STILL UNVERIFIED

- 200 GB is exactly the Always Free block volume allowance, and Oracle's docs state that allowance applies to **all tenancies, paid or free**. So the **storage capacity should be free**.
- Whether the **10 VPU/GB Balanced performance units are also free is genuinely ambiguous**. Oracle's public price list lists VPUs at $0.017/VPU/GB-month ($34/mo at 200GB × 10 VPU), but Oracle's own community forum has an unanswered thread titled *"VPU are included on Always Free plan?"*.
- **ACTION REQUIRED:** check OCI **Billing & Cost Management → Cost Analysis** for the current month, grouped by Block Volume. If $0.00 → no action. If ~$30–34 → shrinking to ~100GB saves ~$17/mo, 47GB saves ~$26/mo.
- **Do not change the boot volume until this is confirmed.** An earlier recommendation to shrink it was based on an unverified number.

---

## 4. WORK COMPLETED THIS SESSION

### 4.1 ✅ PHASE 0 — Support relay vulnerability fixed and DEPLOYED

**Vulnerability (confirmed live, not theoretical):** `api/send-email.mjs` was reachable at `https://nodalx.in/api/send-email` with:
- **no authentication**
- **no rate limit**
- **no origin check**
- client-chosen `to` **and** `html`
- using the Production `RESEND_API_KEY`
- **bypassing** the `OUTBOUND_EMAIL_ENABLED` gate that protects `server/outbound-email.mjs`

This was an **unauthenticated open email relay on the NodalX sending domain**.

**Fix applied** (`api/send-email.mjs`):
- `to` is **rejected**; recipient pinned server-side to `SUPPORT_EMAIL_TO` (default `support@nodalx.in`)
- `from` is server-owned
- `html`, `cc`, `bcc` **refused** — text only
- `replyTo` is the only client-supplied address field
- Missing or non-matching `Origin` → **403** (same-origin by default; optional exact list via `SUPPORT_EMAIL_ALLOWED_ORIGINS`)
- Fails closed behind `SUPPORT_EMAIL_ENABLED`
- Rate limit 5 per 10 minutes per client
- CR/LF header injection blocked in subject and replyTo
- Generic errors — never echoes provider text
- Handler exported via `createSupportEmailHandler({resendFactory, store})` so tests make **no network calls**

**Frontend:** `FeedbackWidget.tsx` sends `replyTo` instead of `to`.
**Docs:** new `SUPPORT_EMAIL_*` vars documented in `.env.example` only.

**Deployed:** Production `dpl_8gLbferLXPnxgTpqB6Lkn72Kr11J` (READY, `nodalx.in`), superseding `dpl_DdYdeXRcEADyR2eSJaRAM2tjUbPG`.
**Rollback target:** `dpl_CPLoArpwoRQyniemYQKpQSZ2UVem`.

**Env set in Production:** `SUPPORT_EMAIL_ENABLED=true`, `SUPPORT_EMAIL_TO=support@nodalx.in`, `SUPPORT_EMAIL_FROM=NodalX Support <support@nodalx.in>` (all Secrets).

**Live verification:**
- no-Origin relay attempt → `403 ORIGIN_NOT_ALLOWED`
- cross-origin spoof → `403 ORIGIN_NOT_ALLOWED`
- client-chosen `to` → `400 INVALID_INPUT`
- `html` payload → `400 INVALID_INPUT`
- labelled same-origin send → accepted by Resend `01a12bb7-7dc7-7ec8-beb7-9f4fc8bf953a`
- rate limiting → engaged

**Tests:** 15 focused tests in `tests/send-email.test.mjs`, all passing, no network.

> ⚠️ **LESSON LEARNED — do not repeat:** adding env vars with `vercel env add` triggers an **auto-redeploy that snapshots only the variables that existed at that moment**. The first add produced a **READY** deployment that still returned `SUPPORT_EMAIL_DISABLED`. An explicit redeploy was required. **Always probe the live endpoint after an env-triggered redeploy; never treat "Ready" as proof the config is active.**

> ⚠️ **Known limitation:** the support rate limit is an in-process `Map`. On serverless it is **per warm instance**, i.e. best-effort, not a global guarantee. The real controls are the pinned server-owned recipient plus same-origin enforcement.

> 📧 **Housekeeping:** three verification emails were delivered to `support@nodalx.in` and still need deleting by the owner.

### 4.2 ✅ RDS connection limit applied

```sql
ALTER ROLE postgres CONNECTION LIMIT 50;   -- was -1, unlimited
```

Applied to live RDS `nodalx_app` with owner approval. One statement. No data, schema, code, or deployment changed. Reversible with `-1`.

**Number derived from measured data, not guessed:**
- RDS `max_connections` = 81, 3 superuser-reserved → 78 usable
- App pool = `max: 4` per function instance
- Observed live usage = **1** connection
- DB-side intake caps already exist: 60/min per source, 120/min router-wide
- 50 = ~12x legitimate headroom (~12 concurrent function instances), while bounding a credential-flood attacker to ~64% of free slots

**Enforcement proven, not assumed:** with one admin connection held, 49 further connections were accepted and the 50th was rejected with PostgreSQL error **`53300`** (too many clients).

**Verification after change:** liveness 200 with `x-nodalx-data-source: rds`, inquiries 401, contact 400, frontend 200, `/api/send-email` still refuses no-Origin attempts. 176/176 RDS SQL assertions, 131 default backend tests (5 Docker opt-ins skipped), `migrate:rds` fully idempotent.

### 4.3 ✅ CORRECTED FINDING — do NOT allowlist "Vercel egress IPs"

**My earlier advice was wrong and was NOT executed. Do not repeat it.**

Vercel serverless functions have **no fixed outbound IP** on any plan this project uses. Static egress requires **Vercel Static IPs at $100/month** (Pro/Enterprise), and **Vercel publishes no allowlistable range**.

Applying that advice would have **severed all production API database access** — the intake form and dashboard would have failed immediately.

**Verified actual RDS posture (read-only):**
- TLS 1.3, cipher `TLS_AES_256_GCM_SHA384`
- `pg_hba` line 13 = `hostssl all all 0.0.0.0/0 md5` → **plaintext authentication impossible**
- `postgres` is **NOT a superuser**, holds **no BYPASSRLS** — only a member of the restricted `rds_superuser` role
- `rdsadmin` is the sole superuser and is **rejected from host access** by `pg_hba` rules 11–12

**Conclusion:** `0.0.0.0/0` on 5432 is a **credential-stuffing and connection-flooding** risk, **not** direct data exposure. The connection limit addresses the flooding half. **Closing 5432 to the world is only possible after moving the API off Vercel** onto the OCI instance (which has a static public IP) — this is now the strongest security argument for the OCI migration.

---

## 5. AGREED PLAN AND ORDER

**Phase A (deferred, pending owner verification):** confirm boot volume VPU cost in Cost Analysis; shrink only if actually billing.

**Phase B — NEXT ACTION:** Move the **API** to OCI behind Caddy, keep RDS.
- This is the highest-value remaining action because it **unlocks closing RDS port 5432 to the world**.
- Note: Phase "worker only" does **not** improve security. If the goal is the security fix, go straight to the API move.

**Phase C:** Move the **processing worker** to OCI (the one workload Vercel cannot run; currently running nowhere).

**Phase D:** Database migration to OCI Postgres — **separate explicit approval**, and blocked until these are de-hardcoded first:
- `server/rds-client.mjs:39` — `url.pathname = '/nodalx_app'` unconditionally rewrites the DB name with no guard
- `scripts/migrate-rds.mjs:8` — asserts the literal hostname `nodalx-db.c69g2gg22fls.us-east-1.rds.amazonaws.com` and loads the AWS CA bundle; **cannot target OCI Postgres**

**Do NOT introduce Redis.** The Postgres-backed queue already works. Redis would add a service, a backup surface, and a failure mode for zero benefit.

### 5.1 Resource budget on the box (measured estimate)

| Component | RAM |
|---|---|
| Oracle Linux + Docker Engine | ~800 MB |
| PostgreSQL 17 (tuned, `shared_buffers=256MB`) | ~400 MB |
| API (Node) | ~120 MB |
| Processing worker (Node) | ~120 MB |
| Caddy | ~40 MB |
| **Total** | **~1.5 GB** |

The box will sit ~87% idle. **The binding constraint on this migration is operational risk, not capacity.**

### 5.2 Cost reality

| Item | Now | Note |
|---|---|---|
| Vercel | $0 | No saving available; moving API off Vercel saves ~$0 |
| RDS PostgreSQL | ~$15–25/mo | The only genuine target |
| OCI A1 2/12 | $0 | Comfortably within the 4/24 PAYG allowance |
| Block volume | verify first | May be $0 (see §3.2) |
| OCI outbound | 10 TB/mo free | Ample |
| Vercel Static IPs | $100/mo | **Would defeat the cost goal — avoid** |

**Cross-cloud note:** OCI Mumbai ↔ RDS us-east-1 is inter-region. Moving the API to OCI makes every DB call inter-region (~150–200ms) and turns RDS traffic into AWS internet egress at $0.09/GB. This is acceptable at current volume (0 inquiries) but must be measured before real traffic.

---

## 6. WORKING TREE STATE

Uncommitted changes exist (Phase 0). **Do not discard.**

```
 M .env.example
 M AGENTS.md
 M api/send-email.mjs
 M docs/LLM-MIND.md
 M frontend/components/FeedbackWidget.tsx
 M tests/send-email.test.mjs
+ untracked: docs/runbooks/oci-infrastructure-session-handoff-2026-10-11.md
```

Note: Phase 0 was deployed to Vercel **without a commit**. If you commit, use `work.sushantsaurabh@gmail.com` as the author — Vercel rejects production deploys when the **commit author email** is not a team member. Local git identity is already set to that address. Do not modify global git config.

---

## 7. KNOWN BLOCKERS / OPEN ITEMS

1. **AWS CLI SSO token expired** — `aws sts get-caller-identity` fails with "Token has expired and refresh failed". Owner must re-authenticate (`aws sso login`) before the RDS security group can be inspected. Needed for: verifying the actual `0.0.0.0/0` rule and its source group.
2. **Boot volume VPU cost unverified** — see §3.2. Owner to check Cost Analysis.
3. **Three test emails** in `support@nodalx.in` need deleting.
4. **Doc drift:** `00-INDEX.md`, `docs/Tech-Stack.md`, `docs/Architecture.md` still describe Firebase/Supabase as the stack. `AGENTS.md` and `docs/LLM-MIND.md` are accurate.
5. **Dead code:** `backend/` (Express + WebSocket Vertex proxy, 1566 lines), `functions/` (Firebase), `frontend/lib/firebase.ts` + `lib/session/firebaseAdapter.ts` (imported by nothing), HubSpot/Sheets/Slack integrations — none reachable from production. `firebase: ^11.7.0` still in `frontend/package.json`.
6. **Duplicate route implementations:** `app/api/send-email/route.ts` and `pages/api/send-email.ts` contain **near-identical copies of the old vulnerable code**. They are **NOT deployed** (absent from the `.vercelignore` allowlist and the build is `framework: "vite"`), but they are a latent risk if framework detection ever changes. Recommend deletion — requires owner approval.
7. **OCI instance** has never been logged into; no SSH host entry yet in known_hosts.

---

## 8. FIRST COMMANDS FOR CODEX

```sh
# 1. Orient — read these first
cat docs/runbooks/oci-infrastructure-session-handoff-2026-10-11.md
tail -120 AGENTS.md
tail -40 docs/LLM-MIND.md

# 2. Confirm working tree is as expected (do NOT discard)
git status --short

# 3. Re-verify the baseline still holds
npm run test:intake          # expect 131 pass, 0 fail, 5 skipped
npm --prefix frontend run build
node scripts/scan-secrets.mjs
git diff --check

# 4. Confirm RDS is reachable and understand the change
npm run check:rds
```

**Before touching the OCI instance:** confirm with the owner that SSH is intended, and ask them to run `aws sso login` so the security group can be inspected.

**Before any production change:** explain the impact and get explicit approval.

---

## 9. KEY FILE REFERENCES

| Concern | File |
|---|---|
| Data client / hardcoded DB name | `server/rds-client.mjs:39` |
| Migration runner (RDS host-pinned) | `scripts/migrate-rds.mjs:8` |
| RDS SQL test harness (forces `nodalx_test`) | `scripts/test-rds-db.mjs` |
| Worker + daemon | `server/processing-worker.mjs`, `server/processing-daemon.mjs` |
| Worker Dockerfile (never built) | `scripts/processing-worker.Dockerfile` |
| Worker packaging allowlist | `scripts/package-processing-worker.mjs` |
| API routing (single catch-all) | `vercel.json` |
| Deployment allowlist (strict) | `.vercelignore` |
| Support relay (fixed this session) | `api/send-email.mjs` |
| Outbound email desk (gated) | `server/outbound-email.mjs` |
| CI workflow (no deploy job) | `.github/workflows/ci.yml` |
EOF
echo "written:"; wc -l docs/runbooks/oci-infrastructure-session-handoff-2026-10-11.md