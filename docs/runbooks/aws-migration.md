# NodalX: restore intake, then migrate from Firebase to AWS

Updated: 4 October 2026. **AWS remains local preparation only.** Vercel frontend
and contact code were subsequently deployed successfully; see
`vercel-deployment-2026-10-04.md`. The pre-deployment audit below records the
original blockers; server intake configuration and dashboard migration remain open.

## Verified blockers

- `https://nodalx.in/` and an empty, non-writing `POST /api/contact` returned
  HTTP 404, “Site Not Found.” Do not assume this domain serves Vercel.
- The locally linked Vercel project is `nodalx-frontend`. Its production
  environment is missing `APPS_SCRIPT_WEB_APP_URL` and
  `APPS_SCRIPT_INTAKE_SECRET`. The existing browser-side Apps Script variable
  cannot replace either server variable.
- Neither server variable is configured in the inspected local environment
  files. No secret value was retrieved or printed.
- AWS CLI profile `default` selects `us-east-1`, but its SSO session has expired.
  The target account, deployment permissions and intended region are unverified.
- AWS SAM CLI is not installed. Template JSON and handler tests passed locally;
  SAM validation, cloud packaging and provider integration remain unverified.
- Firebase still supplies authentication, dashboard storage and workspace APIs.
  Its billing suspension is not resolved by deploying the separate intake route.

## 1. Restore the existing inquiry form

1. Owner: confirm which Vercel project and source checkout should serve the
   domain. Check its **Domains** screen and the current GoDaddy/Cloudflare DNS.
   Follow that project's displayed DNS values, not old Firebase IPs. Preserve
   mail/DKIM/DMARC records. Do not change DNS before confirming the destination.
2. Back up the inquiry spreadsheet privately. In the existing Apps Script
   project, replace the canonical script with `appscript/nodalx-intake.gs`.
   Keep `INTAKE_SECRET` and `SHEET_ID` in **Script Properties**. The ID is the
   value between `/d/` and `/edit`; do not assume a fixed character length.
3. Run `setupSheetHeaders` and `healthCheck` as the script owner. This version
   preserves the first 16 columns and extends compatible headings with `Service`
   and `Payload Hash`. Stop if it detects a different first tab or occupied
   extension headings. Review existing rows in columns 17–18 before upgrading.
4. Deploy a new web-app version: execute as the owner, access **Anyone**. The
   shared secret is still mandatory. Copy the exact URL ending in `/exec`.
   Editor URLs and `/dev` URLs are not production endpoints.
5. In the confirmed Vercel project's production environment, set the two
   server variables from `.env.example`. Use the dashboard's secret fields;
   do not paste secret values in chats, screenshots, source or shell arguments.
6. Review and deploy this checkout through the normal owner-approved Vercel
   process. Environment edits do not update an already-built deployment.
   Check the Vercel hostname before testing `nodalx.in`.
7. Add a WAF rate limit/bot rule for `/api/contact` before opening intake.
   A shared upstream secret does not stop abuse of the public proxy. Script
   email quota exhaustion and unwanted confirmation mail remain risks.
8. With locally configured, ignored `.env.local`, run:

   ```sh
   node --env-file=.env.local scripts/check-intake.mjs --upstream-health
   ```

   This checks deployment access without writing an inquiry or logging secrets.
9. With owner approval, submit one clearly labelled test through the website.
   It writes a row and may send two emails. Expect HTTP 202, `accepted: true`,
   and a row ID. Retry unchanged content with the same `Idempotency-Key`: one
   row, no duplicate notifications. Changed content needs a new key; conflicting
   reuse returns 409. Verify the row, service field and original message in Sheets.

The local proxy validates fields, rejects non-production script URLs, times out
provider calls, redacts failures and only acknowledges a confirmed row. Retries
are safe **only after the updated Apps Script version is deployed**. An ambiguous
timeout is not proof the first write failed; keep the same key when retrying.
Old submissions without hashes cannot be safely deduplicated automatically.

**Dashboard caveat:** Apps Script rows belong to the owner's spreadsheet, not
every signed-in workspace. The current dashboard reads Firebase. Do not expose
`doGet?action=list` to all authenticated users or place its secret in `VITE_*`.
Restored public intake is not a completed dashboard migration.

## 2. Optional AWS intake pilot already prepared

Files: `server/contact.mjs`, `aws/handlers/contact.mjs`, `aws/template.json`,
`scripts/package-aws-intake.mjs`, `tests/*.test.mjs`.

```sh
npm run test:intake
npm run build:aws-intake
```

The bundle includes exactly two allowlisted source files, not the repository,
dotenv files, customer exports or credentials. The SAM template defines only
an HTTP API `POST /api/contact`, Node.js 22 Lambda and 14-day log retention.
It does **not** create Cognito, DynamoDB, uploads, queues or workspace APIs.

Deployment gates, before any provisioning:

- Owner approves account, region, staging environment, expected costs and budget
  alerts. AWS is not guaranteed free; API, Lambda, logs and Secrets Manager cost
  money. Do not enable Google billing while the dispute remains open.
- Owner renews AWS SSO and verifies account identity; install/approve SAM tooling.
- Owner creates or selects a Secrets Manager JSON secret containing `webAppUrl`
  and `intakeSecret`; pass only its ARN to CloudFormation. The deploy role needs
  access to resolve it, plus any required KMS permission.
- Run SAM validation/build against the prepared staging bundle and inspect the
  change set before deploying. There is no automatic deployment script here.
- The dynamic references resolve into Lambda environment values at deployment.
  Rotation alone does not refresh those values: update/redeploy the configuration
  or replace this pilot with runtime secret retrieval before managed rotation.
- Stage throttling is a global safety cap, not per-visitor abuse prevention.
  Add an appropriate edge/WAF/bot control; never rely on process-memory limits.
- Keep browser calls same-origin through the approved hosting proxy. Direct
  cross-origin calls need an explicit allowlisted CORS policy and frontend config.

Do not point all `/api/*` at this pilot: it implements contact only. Keep Vercel
intake as the approved path until staging behavior and cutover are verified.

## 3. Complete migration: preserve actual feature scope

Inventory the route contract and access patterns before choosing tables. Current
code includes far more than inquiries: profiles, notification settings, API keys,
flows/data sources, subscriptions, usage periods, processing jobs/rows/events,
Sheets claims, uploads, analysis results, billing checkout/provider bindings and
event replay protection. New local work also includes import recipes, records,
runs, daily budgets and exception queues. Feedback writes use Firestore directly.

| Existing responsibility | AWS replacement to implement and test |
| --- | --- |
| Firebase Auth | Cognito user pool, public SPA client with PKCE, email/reset and approved Google federation |
| Verified UID + workspace authorization | Access JWT verification + server-owned identity-to-workspace mapping |
| Firestore + server transactions | DynamoDB repositories, conditional writes and atomic quota reservations |
| Functions HTTP/callable routes | API Gateway + Lambda route adapters preserving response contracts |
| Firestore processing trigger | Durable outbox/queue delivery, SQS worker, retry policy and dead-letter queue |
| Recovery and import polling schedules | EventBridge Scheduler + guarded, idempotent workers with leases |
| Large uploads/export artifacts | Private S3, size/type limits, expiring signed links and ownership checks |
| Operational evidence | Redacted CloudWatch metrics/logs, alarms, budget alerts, backups and tested restore |

### Authentication and identity: no ownership reset

- One existing Firebase UID remains one stable workspace. Map verified Cognito
  `sub` values to that stable workspace ID **server-side**. Never trust a client
  `customerId`, writable custom attribute or email match as authorization.
- Select the identity migration deliberately: bulk user import requires a
  password-reset flow; just-in-time migration needs secure validation against
  the old provider. Google sign-in requires verified account linking. Test
  existing users, email changes, duplicate emails, reset and deletion cases.
- Do not copy password hashes or token exports into this repository. Obtain
  owner approval before exporting any production identity/customer data.
- APIs use Cognito **access tokens**, not a blind switch to ID tokens. Validate
  signature/JWKS, issuer, expiry, `token_use`, client binding and required scopes.
  Configure route scopes and enforce workspace membership inside every handler.
- Introduce a frontend auth/session interface before replacing SDK imports.
  Update login/signup/reset, protected routes, token refresh, uploads, Sheets,
  notification settings, API client, direct feedback writes and analytics.
  Preserve sign-out and tenant-change state clearing. No browser AWS credentials
  or unauthenticated Identity Pool is needed for ordinary authenticated API calls.

### DynamoDB model: tenant-first, not a global inquiry scan

Example access-pattern design, **not yet provisioned**:

```text
PK = WORKSPACE#<stable-workspace-id>
SK = INQUIRY#<id> | PROFILE | SETTINGS | SUBSCRIPTION
   | USAGE#<period> | JOB#<id> | RECIPE#<id> | ...
Inquiry feed GSI PK = WORKSPACE#<stable-workspace-id>#INQUIRIES
Inquiry feed GSI SK = <createdAt>#<id>
Identity mapping PK = IDENTITY#<verified-cognito-sub>, server-owned
```

- Jobs with many rows need additional workspace-prefixed partitions and explicit
  ownership validation; do not force every access pattern into this illustration.
- Detail reads use tenant keys; list/status-filter queries use tenant-partitioned
  indexes. Validate/scope pagination cursors. Global `createdAt` indexes alone
  do not preserve tenancy. GSIs are eventually consistent: test stale-state UI.
- Reserve usage, create jobs and dedupe atomically; unchanged retries must not
  debit twice. Subscription, hashed API key and entitlement fields remain
  server-owned. Preserve current limits, credits and paid state during migration.
- Use conditional writes/versioning for status updates and worker leases. Verify
  billing webhook signatures, provider bindings and replay guards before changes
  to subscriptions. No payment activation or new prices are part of this change.
- DynamoDB has a 400 KB item limit and transactions of at most 100 distinct
  items / 4 MB. Store large raw uploads privately in S3; chunk jobs with explicit
  progress/recovery. Do not mechanically replace large Firestore batches.
- TTL is asynchronous cleanup, not authorization or exact lease expiry. Enforce
  expiry in application reads/conditions even before expired items are deleted.

### Intake and automation truthfulness

The pilot keeps Apps Script as intake storage. In the completed system, decide
which backend is authoritative. For dashboard-visible inquiries, prefer one
durable DynamoDB acceptance transaction plus an idempotent outbox for optional
Sheets mirrors/processing. Do not report acceptance after only a Sheet write if
the workspace DB write failed. Never perform uncoordinated dual writes.

Preserve original text/source lineage, import-only vs processing semantics,
review exceptions, quota reservations, dedupe fingerprints and safe retry.
Automated recipes must remain disabled until staging provider tests, stop/pause,
recovery, budgets and ownership checks pass. Do not claim autonomous sales
sending, guaranteed delivery or time saved without measured evidence.

## 4. Phases and exit gates

1. **Intake recovery:** confirmed hosting, configured server vars, updated Apps
   Script, abuse controls and an owner-approved live submission verified.
2. **AWS staging:** approved account/budget, Cognito identity map, DynamoDB/S3,
   API auth and repositories; no production cutover. Contract tests cover every
   endpoint, two-tenant access denial and all existing UI flows.
3. **Worker parity:** queue/scheduler, retries/DLQ, billing webhook replay,
   Sheets import/export and automatic recipe pause/recovery. Run fault tests for
   duplicate delivery, provider timeout, failed rows and depleted quotas.
4. **Migration rehearsal:** approved encrypted backup/export; recursive
   subcollection migration, counts/checksums, stable ownership and original
   timestamps; restore rehearsal and explicit orphan handling. Do not store
   exports in git. Compare records without logging PII.
5. **Frontend staging:** Cognito adapter, all API paths and direct Firestore
   replacements; typecheck/build, unit/integration tests and browser checks at
   mobile/tablet/desktop, keyboard, error/empty/loading states. Existing local
   build success is not cloud end-to-end proof.
6. **Controlled cutover:** announced write freeze or durable change capture,
   final delta replay, reconciled counts/entitlements and stable IDs. Route
   hosting/API only after smoke tests. Protect any AWS-only writes in a rollback;
   merely reverting DNS would lose them. Test token/logout transition explicitly.
7. **Retirement:** after the approved observation/rollback and retention window,
   remove Firebase imports/dependencies and deployment config, then retire
   resources deliberately. Keep necessary backups/audit evidence. Do not delete
   rules, indexes, `.firebaserc` or working auth before replacement parity.

## Validation evidence for this local pass

- 18 intake tests pass: shared proxy, AWS HTTP event adapter, and mocked Apps
  Script storage/authorization/lock/retry/schema/notification behavior.
- 28 frontend unit tests pass, including the preserved import/automation view
  helpers. Frontend build includes TypeScript checking and passed after the
  retry change. These tests do not certify background automation providers.
- Dependency-free intake bundle builds locally. Health checker correctly reports
  both missing local server variables without disclosing values.
- No live Sheet write, script redeployment, Vercel deployment, DNS edit, AWS
  provisioning, customer export or Firebase deletion was performed.
- Provider runtime, SAM/template deployment and Vercel rewrite deployment are
  still required checks. Mocked Google services cannot prove real permissions.
- New uncommitted automation code from another IDE is preserved, not certified
  by these intake tests. Review its integration and rules tests independently.

## Primary references

- [Vercel rewrite configuration](https://vercel.com/docs/routing/rewrites)
- [Cognito token verification](https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-using-tokens-verifying-a-jwt.html)
- [API Gateway JWT authorizers and scopes](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-jwt-authorizer.html)
- [Cognito user migration trigger](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-migrate-user.html)
- [Cognito bulk user import](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-using-import-tool.html)
- [DynamoDB tenant modeling](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/data-modeling-blocks.html)
- [DynamoDB constraints](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Constraints.html)
- [DynamoDB TTL behavior](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/TTL.html)
- [Secrets Manager dynamic references](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/dynamic-references-secretsmanager.html)
- [Apps Script quotas](https://developers.google.com/apps-script/guides/services/quotas)
