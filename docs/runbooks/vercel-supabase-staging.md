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
| `INTAKE_PROVIDER` | `make-supabase` only in this staging preview |
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
7. Provision the owned source binding, prepare a separate disabled Make router,
   then separately approve gate changes and one labelled synthetic E2E test.

The new intake mode has no Apps Script confirmation-email parity yet. Existing
production intake stays unchanged until this and all release gates are resolved.
