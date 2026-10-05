# Deployment & domain health check — 5 October 2026 (16:30 IST)

Read-only live probes from this machine (dig/curl). No DNS, provider settings,
deployments, billing or data were changed. No real inquiry was submitted.

## TL;DR

| Layer | Status |
| --- | --- |
| Domain `nodalx.in` → Vercel (DNS + TLS) | ✅ Working |
| Marketing site, SPA routes, sitemap/robots/OG image | ✅ Working |
| `/api/contact` intake on Vercel | 🟡 Configured, but real submission is unverified |
| **Firebase Auth (sign-in)** | ❌ **Broken: GCP project suspended** |
| **Firestore (dashboard data)** | ❌ **Broken: GCP project suspended** |
| **Firebase Hosting `nodalxai-b9eb5.web.app`** | ❌ **"Site Not Found" 404** |
| **Dashboard API `/api/workspace/*`, `/api/inquiries/*`, etc.** | ❌ **404 HTML (proxy target is dead)** |
| Email on `@nodalx.in` | ❌ No MX records |

**In short:** the domain cutover to Vercel worked, and the public site loads.
Anything that needs a signed-in user does not work, because Google has suspended
the whole `nodalxai-b9eb5` project. This is worse than the documented
"Functions return 503". Auth, Firestore and Hosting are down too.

---

## ✅ What is working

### DNS
- Registrar: GoDaddy. Authoritative NS: Cloudflare (`chad`, `marissa`).
- Apex `nodalx.in` A → `216.198.79.x`, `64.29.17.x` (Vercel anycast). It is
  DNS-only, with no Cloudflare proxy on apex. Responses carry `server: Vercel`.
- The "Invalid Configuration" blocker in `release-repairs-2026-10-05.md` §3 and
  `REMAINING-WORK.md` is **resolved**. Those docs are now stale on this point.

### HTTPS / routing (Vercel project `nodalx-frontend`)
| URL | Result |
| --- | --- |
| `http://nodalx.in/` | 308 → `https://nodalx.in/` |
| `https://nodalx.in/` | 200, valid cert, title "NodalX — Business Inquiry Intake & Follow-up" |
| `https://www.nodalx.in/` | 307 → `https://nodalx.in/` (via Cloudflare proxy) |
| `/dashboard` | 200 SPA shell (the shell loads; data does not, see below) |
| `/sitemap.xml` | 200 `application/xml` |
| `/robots.txt`, `/og-image.png` | 200 |
| `https://nodalx-frontend.vercel.app/` | 200 |
| Security headers | HSTS, nosniff, Referrer-Policy, Permissions-Policy, COOP present |

### Contact intake function
- `GET /api/contact` → 405 (correct).
- `POST /api/contact {}` → **400 `INVALID_INQUIRY`**. The handler checks
  configuration *before* validation (`server/contact.mjs` L27-28). So
  `APPS_SCRIPT_WEB_APP_URL` and `APPS_SCRIPT_INTAKE_SECRET` **are now set** on
  Vercel production. On 4 Oct this request returned 503 `INTAKE_NOT_CONFIGURED`.

### Local release gates (current working tree)
- `frontend` build ✅ · `inquiryDesk.test.ts` 9/9 ✅
- `functions` lint ✅ · tests 35 pass / 0 fail / **39 skipped** (emulator integration tests not run)
- `scripts/scan-secrets.mjs` ✅ · `git diff --check` ✅

---

## ❌ What is NOT working (end to end)

### 1. Google Cloud project `nodalxai-b9eb5` is suspended (P0, root cause)
Live API responses:
- Identity Toolkit (Firebase Auth): `403 CONSUMER_SUSPENDED`. The project's web API key "has been suspended".
- Firestore REST: `403 CONSUMER_SUSPENDED`. "Consumer 'projects/nodalxai-b9eb5' has been suspended".
- Firebase Hosting `nodalxai-b9eb5.web.app` and `.firebaseapp.com`: **404 "Site Not Found"**.

User-visible effect:
- **Sign-in fails** (Google and email) on `nodalx.in`.
- **Dashboard cannot load any data.** Inquiries, workspace, uploads, sheets,
  recipes, usage, billing and API keys are all unavailable.
- Firestore rules/index deploys and backups through Firebase are impossible
  until the suspension is lifted.

Most likely tied to the open Veo billing dispute. Per `AGENTS.md`: **do not**
add a payment method or enable billing without explicit owner approval.
Owner action: get the suspension reason and status from Google Cloud billing
support (Console → Billing / project notifications). Choose between restoring
the project and the AWS migration in `runbooks/aws-migration.md`.

### 2. Dashboard API proxy points at a dead origin (P0, follows from #1)
`vercel.json` rewrites `/api/*` (except `/api/contact`) →
`https://nodalxai-b9eb5.web.app/api/*`. That origin now serves Firebase's
"Site Not Found" page. As a result:
- `https://nodalx.in/api/health/live` → **404 HTML**, not JSON.
- The live bundle calls about 30 routes (`/api/workspace/overview|inquiries|jobs|uploads|sheets|recipes|key|usage|plans|checkout|invoices|settings|exceptions…`,
  `/api/inquiries/:id`, `/api/onboarding/generate-key`, `/api/hubspot/contact`, `/api/webhook/`).
  **All of them fail.**
- The frontend gets an HTML body where it expects JSON. Check that the UI shows a
  clear "service unavailable" state and not a parse error or a blank screen.

Fix options: restore the GCP project and deploy Functions (needs billing
approval), or stand up the AWS API (`aws-migration.md`) and repoint this rewrite.
The AWS template covers **contact only** today. It has no dashboard parity yet.

### 3. Contact form: real submission is unverified (P1)
The env vars exist, but these are **not** proven:
- The Apps Script web app deployment is the updated version, and its
  `INTAKE_SECRET` script property matches Vercel's.
- A real POST returns 202 with a Sheet row, and a retry with the same
  `Idempotency-Key` does not create a duplicate.

No local secret exists (`.env.local` has no `APPS_SCRIPT_*`), so
`node --env-file=.env.local scripts/check-intake.mjs --upstream-health` cannot run here.
Owner step: run the health check with a private env file, then make one labelled
test submission (`release-repairs-2026-10-05.md` §2 steps 7-8).
Also, Apps Script rows **do not reach the dashboard** (and the dashboard is down anyway, see #1).

### 4. Firebase Auth authorized domains cannot be verified (P1, blocked by #1)
The bundle uses `authDomain: nodalxai-b9eb5.firebaseapp.com`. After the project is
restored, confirm that `nodalx.in` (and `nodalx-frontend.vercel.app`, if used) is
in Authentication → Settings → Authorized domains. Then test Google popup sign-in.

### 5. Email for `@nodalx.in` is not set up (P2)
- **No MX records.** A `zoho-verification=…` TXT exists, so Zoho setup was started
  but not finished. Mail to `@nodalx.in` will bounce.
- There is also no SPF, DKIM or DMARC.
- Add the MX/SPF/DKIM records from Zoho in **Cloudflare** (not GoDaddy). Keep the
  public contact address on Gmail until mail flow is tested.

### 6. Minor DNS/hosting hygiene (P3)
- A stale TXT `hosting-site=nodalxai-b9eb5` (old Firebase Hosting verification)
  remains. It is harmless, but you can remove it once Firebase Hosting is
  definitely retired.
- `www` is Cloudflare-**proxied** and redirects with **307** (temporary). A
  permanent 301/308 is better for SEO. Set it in the Vercel domain settings
  (redirect www → apex, permanent), or in a Cloudflare redirect rule.
- The Vercel CSP is `Report-Only`. Its `connect-src` allows `*.run.app`, but there
  is no Cloud Run backend. Tighten it and enforce it once the backend target is decided.
- The served main bundle (`index-DWawNpi5.js`, deployed 05 Oct 07:07 UTC) differs
  from the local build (`index-C2YB--Uf.js`). This may only reflect env-var
  differences, but parity between the deployment and the working tree is **unverified**.
  The working tree has many uncommitted changes, so nothing is reproducible from Git.

### 7. Docs are out of date (P3)
- `REMAINING-WORK.md` L13-16, L24, L30 still say DNS is invalid and the custom domain returns 404.
- `release-repairs-2026-10-05.md` §3 still lists DNS as pending.
- `Deployment.md`, `Domain-Setup.md`, `Vercel-Migration.md` and `RELEASE-STATUS.md`
  still say "Firebase Hosting serves `nodalx.in`".
- None of the docs records that the **whole project** is suspended (they only mention Functions 503).

---

## Skipped / not verifiable from here
- Signed-in browser E2E (sign-in, dashboard, status changes, mobile): blocked by #1.
- Apps Script upstream health and real submission: no secret locally, and needs owner approval.
- Vercel and Cloudflare dashboard settings (env var values, DNS record list, proxy
  flags): only inferred from live responses.
- `backend/` WebSocket auth test and Functions emulator integration tests (39 skipped).

## Suggested order
1. Owner: resolve the GCP suspension decision (support ticket, no billing change without approval), **or** commit to AWS.
2. Pick the API origin and repoint the `vercel.json` `/api/*` rewrite. Make the UI handle a non-JSON 404/503 gracefully in the meantime.
3. Run the intake upstream health check and one approved test submission.
4. Finish Zoho MX/SPF/DKIM/DMARC in Cloudflare.
5. Update the stale docs listed in §7, then commit or split the uncommitted work so deployments are reproducible.
