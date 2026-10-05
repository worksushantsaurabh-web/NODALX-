# Vercel production deployment — 4 October 2026

## Deployed

- Project: `nodalx-frontend`, existing owner team.
- Production alias: https://nodalx-frontend.vercel.app
- Deployment: `dpl_GhLpG8MgSf5bi5TtMQwWKP1bBdSC`, state `READY`.
- Deployment URL: https://nodalx-frontend-jywcor1sr-worksushantsaurabh-webs-projects.vercel.app
- Inspector: https://vercel.com/worksushantsaurabh-webs-projects/nodalx-frontend/GhLpG8MgSf5bi5TtMQwWKP1bBdSC

The owner authorized this production deployment. No Firebase Functions, AWS
resources, Apps Script versions, DNS records or billing settings were changed.
No real inquiry was submitted and no new server secret was configured.

## Deployment fixes

The project previously used `frontend` as its root, excluding the root intake
function and conflicting with the repository's build commands. Its root directory
was reset to automatic/default (repository root). `vercel.json` now supplies the
frontend install/build/output paths; the cloud build verified them successfully.

Added `.vercelignore` with an allowlist for frontend sources, the contact function,
its shared intake module and required manifests/config. The default dry run had
included private backups, archived environment files and debug logs. **Those files
were never uploaded in this deployment.** After exclusion, the dry run verified
112 allowed files, 738,084 bytes, with no private backups, dotenv files, archives,
local dependencies or generated frontend build output. Do not remove this guard.

## Verified after deployment

| Check | Result |
| --- | --- |
| Homepage | HTTP 200; React root present |
| Referenced JavaScript and stylesheet assets | All HTTP 200, correct content types |
| `/dashboard` page route | HTTP 200 SPA document; not a signed-in data test |
| `GET /api/contact` | HTTP 405 JSON; local function is active |
| Empty `POST /api/contact` | HTTP 503 JSON, `INTAKE_NOT_CONFIGURED`; no upstream write |
| `/api/health/live` | HTTP 404; legacy dashboard backend is not usable here |
| `https://nodalx.in/` | HTTP 404; not serving this deployment |

18 local intake tests, working-tree secret scan and diff checks passed. The
production build ran TypeScript checking and Vite successfully. Signed-in auth,
customer data access and live Apps Script storage were not verified.

## Remaining release blockers

1. Configure `APPS_SCRIPT_WEB_APP_URL` and `APPS_SCRIPT_INTAKE_SECRET` privately
   in this project's production environment. Deploy the updated Apps Script
   version, then redeploy Vercel. Follow `aws-migration.md` for read-only health
   and an owner-approved real submission test. Apply public-intake abuse controls.
2. Restore or migrate the authenticated dashboard/workspace API. The current
   legacy Firebase proxy returns 404 on the health check. The AWS intake pilot
   cannot replace those authenticated APIs.
3. Connect and verify `nodalx.in` for the intended Vercel project. The Vercel
   domain inspector did not find it under the current team. Confirm ownership
   and current DNS before changing records; preserve mail records.
4. Review dependency security before calling this release production-ready.
   The cloud install reported nine high-severity vulnerabilities. No automatic
   breaking dependency upgrade was performed as part of deployment.

Future deployments should repeat the dry-run allowlist check and relevant tests,
then deploy from the repository root. Keep secrets in provider settings, not
frontend `VITE_*` variables or upload sources.
