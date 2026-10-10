# Vercel to Supabase staging connection

## Verified target

- Vercel project: `nodalx-frontend`, ID `prj_SbAfNZNK4gBswh6ppCtY4lOhrUo1`.
- Supabase staging: `ozovfbwhcvbgpgrxxjcj`, Mumbai, migrations 1–15 applied.
- This is a Preview-only rehearsal. Do not edit Production variables, promote
  deployments, change `nodalx.in`, enable Make or import customer history.

## Current checkpoint: 6 October 2026

Vercel CLI account/project inspection works. The dashboard revealed the reason
environment creation failed: `main` is the production branch and cannot scope
Preview variables. A typed `nodalx-staging` scope was also rejected because that
branch did not yet exist in the connected Git repository. Owner approved creating
and pushing `nodalx-staging` after checks. No variable write succeeded at this
checkpoint; verify saved metadata after the branch exists.
Follow-up: branch `nodalx-staging` was pushed and its commit verified remotely.
Dashboard confirms both URLs, both publishable key names, the private server-key
name and eight safety/configuration variables saved for that Preview branch only.
Server credential value was not revealed or tested. Source/machine tokens and
bindings remain pending. CLI reads/writes/dry deployment still fail; use verified
dashboard state, not assumptions about automatic deployment. The API transport's
same-origin option is now tested; deploy its updated branch before verifying.
The server template now includes `SUPABASE_PUBLISHABLE_KEY`, required by the
authenticated workspace API separately from the service-role credential.

## Preview configuration

Restrict sensitive staging configuration to the trusted `nodalx-staging` Preview branch.
Do not distribute service credentials to untrusted pull-request deployments.
Use the dashboard secret manager for private values; never paste them into chat,
source files, frontend variables, command arguments, screenshots or Make exports.

| Variable | Value / rule |
| --- | --- |
| `SUPABASE_URL` | `https://ozovfbwhcvbgpgrxxjcj.supabase.co` |
| `VITE_SUPABASE_URL` | Same staging origin |
| `SUPABASE_PUBLISHABLE_KEY` | Staging publishable key (public client key) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Same publishable key; never a secret/server key |
| `VITE_API_BASE_URL` | `same-origin`; requires the tested API-client resolver on the staging branch |
| `VITE_SUPABASE_GOOGLE_ENABLED` | `false`; Google OAuth not configured yet |
| `INTAKE_PROVIDER` | `supabase-direct` for Website → secured backend → canonical Supabase → Dashboard; `make-supabase` is an optional queued workflow, not a storage dependency |
| `INTAKE_ENVIRONMENT` | `staging` |
| `ALLOW_INTAKE_NETWORK` | `false` until source-binding and synthetic test approval |
| `MAKE_INTAKE_ENABLED` | `false` |
| `MAKE_PROCESSING_ENABLED` | `false` |
| `ALLOW_PROCESSING_NETWORK` | `false` |
| `SUPABASE_SERVICE_ROLE_KEY` | Private staging server credential, Preview/nodalx-staging only |
| `INTAKE_SOURCE_TOKEN` | Distinct privately generated connector token, 32–256 base64url chars |
| `MAKE_INTAKE_TOKEN` | Different privately generated machine token, 32–256 base64url chars |

Do not silently reuse Apps Script secrets or Make processing tokens. Source
bindings must resolve the verified workspace, remain disabled initially and
store only the connector token hash. Never infer workspace ownership from email.
Missing credentials and disabled gates are intentional fail-closed states.

## Deployment and verification sequence

Checkpoint (6 October 2026): deployment `AqKK8D6HFM1qbCssWLaioKfdrAA7`
is Ready from `nodalx-staging` commit `1b8d694`. Landing page and sign-in modal
load; Google sign-in is disabled. Anonymous API requests redirect to Vercel SSO
(HTTP 302); browser API navigation was blocked by the client. These checks do
not prove backend health, credentials, tenant isolation or intake completion.
Keep deployment protection enabled and use an approved verification mechanism.

Authenticated probe follow-up: owner approved staging-only checks. Installed
Vercel CLI 59.1.3 still fails account/deployment-targeted commands. Full-URL
`vercel curl` returns a Vercel SSO redirect (302), not application JSON. Do not
report that response as a healthy API, a broken API, or a passed authorization
test. Restore owner CLI access or use an approved protected-preview mechanism;
do not disable protection or distribute bypass credentials to Make without a
separate scoped access review. No inquiry POST or scenario execution was made.

Auth allowlist verified (6 October 2026): owner approved and dashboard saved
exactly these two URLs (no wildcard):

```text
https://nodalx-frontend-git-nod-04bf63-worksushantsaurabh-webs-projects.vercel.app/auth/callback
https://nodalx-frontend-git-nod-04bf63-worksushantsaurabh-webs-projects.vercel.app/auth/callback?flow=recovery
```

Use the stable branch alias for signup/recovery rehearsal. The application builds
redirects from its current origin; disposable deployment origins are not allowed
by these entries. Site URL remains `http://localhost:3000` and is not a verified
cloud fallback. Custom SMTP is disabled; do not claim cloud email delivery works.
Google OAuth remains disabled. No signup/recovery email was sent in this check.

Backend verification repeated: 83 default tests passed (four local opt-ins
skipped), all four local integration tests passed explicitly, and 131 SQL
assertions passed. API/server boundary lint and Functions lint passed. These
results use local Supabase and a simulated Make consumer, not the live scenario.
Make's scenario inventory shows the legacy classification and Gemini scenarios;
no dedicated opaque claim/complete router is present. Source/machine credentials,
verified owner workspace and protected-preview API checks remain prerequisites
before a separately approved synthetic cloud round-trip.

1. Verify saved Preview/nodalx-staging metadata without retrieving secret values.
2. Typecheck/build and inspect Vercel upload allowlist before deploying from the
   repository root to Preview, not Production. Ensure CLI preview branch metadata
   is `nodalx-staging`; otherwise branch-scoped configuration will not be injected.
3. Keep preview deployment protection on. Authenticate automated verification
   through an approved mechanism; do not disable protection as a shortcut.
4. Configure Supabase Auth redirects for the exact approved preview origin:
   `/auth/callback` and `/auth/callback?flow=recovery`. Avoid broad wildcards;
   do not change the production site URL to a disposable preview URL.
5. Review Auth email delivery/SMTP before testing real signup or recovery.
   Cloud database deployment alone does not prove auth email reliability.
6. Check assets, same-origin API routing, unauthenticated denial and disabled
   intake/processing responses. Run owner-approved synthetic auth/workspace tests.
7. Provision the owned source binding, deploy and verify `supabase-direct` with
   the network gate off, then obtain explicit approval before enabling the gate
   and submitting one labelled synthetic E2E test. Prepare a separate disabled
   Make scenario only if optional downstream automation is still required.

## Vercel SSO and public staging access decision

Vercel Deployment Protection runs before application routes, so API auth logic
cannot convert its SSO redirect into JSON. Current Vercel documentation describes
project-wide automation bypass secrets and domain-wide Deployment Protection
Exceptions; it does not document a normal-request path-only exception. Do not put
a bypass secret in Make or turn protection off. If the owner approves, add only
the stable `nodalx-staging` alias as a Deployment Protection Exception. This
makes the whole staging deployment publicly reachable, while Supabase Auth and
server-side route authorization protect account data and machine routes remain
Bearer-gated. This option may require Advanced Deployment Protection. Otherwise,
stage a separate API-only Vercel project/host and keep the web Preview protected.
No exception or API-only project has been configured yet.

### API-only host implementation (local scaffold)

The repository now contains a separate Vercel project root at `staging-api/`.
It exposes only the existing server handlers required by the staging dashboard
and inquiry intake; it does not contain frontend assets. The web project remains
protected. CORS is exact-origin allowlisted with `API_ALLOWED_ORIGINS`; browser
requests still require normal Supabase Auth, while machine routes retain their
dedicated bearer/source-token checks. CORS is not authentication.

Owner setup, only after signing into the correct Vercel team:

1. Create a new Vercel project from the existing Git repository named
   `nodalx-staging-api`, set Root Directory to `staging-api`, and enable
   **Include source files outside of the Root Directory in the Build Step**.
   Do not modify or unprotect `nodalx-frontend`.
2. Attach only `api-staging.nodalx.in` to this API-only project. Use the exact
   DNS target Vercel displays; do not guess the CNAME target. In GoDaddy, add
   the displayed record only after confirming no conflicting record exists.
3. Set the API project's deployment environment to staging values only:
   `API_ALLOWED_ORIGINS` must be the exact stable staging web origin (no
   wildcard); set the existing Supabase server credentials and staging
   configuration. Keep `ALLOW_INTAKE_NETWORK`, `MAKE_INTAKE_ENABLED`, and
   `MAKE_PROCESSING_ENABLED` false. Never put service-role or intake secrets in
   frontend variables or Make.
4. Set `VITE_API_BASE_URL=https://api-staging.nodalx.in` only in the web
   project's `Preview` scope for `nodalx-staging`. This requires a new staging
   deployment before the browser uses the API host.
5. Deployment Protection still applies to the new host. If SSO blocks its API,
   the narrowest documented exception available is scoped to that API domain,
   not an individual route. That makes all API-only paths publicly reachable;
   handler authentication remains mandatory. Do not disable protection or use a
   project-wide bypass token. Do not purchase an add-on. Obtain explicit owner
   approval before adding any domain exception. If unavailable, stop: there is
   no verified machine-access path without changing the access boundary.
6. Initially verify only anonymous health and expected auth-denial responses.
   Do not submit inquiries, enable gates, run Make, or trigger email without the
   exact-request and side-effect approval described above.

No Vercel project, DNS record, deployment, environment variable or protection
setting has been changed from this local scaffold. The current browser/CLI
identity must first be corrected to the `worksushantsaurabh-web` owner account.
The new intake mode has no Apps Script confirmation-email parity yet. Existing
production intake stays unchanged until this and all release gates are resolved.
