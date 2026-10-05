# NodalX release repairs: complete these steps in order

Updated: 5 October 2026. Do not interpret a deployed frontend as a working
authenticated backend or a verified inquiry submission.

## 1. Dependency security — local repair completed

- Pinned the Firestore dependency's gRPC override to `1.14.5`, a maintained
  security-patched release. The lockfile was regenerated without a Firebase
  major upgrade or a Tailwind migration.
- Full frontend audit: **9 → 5 high warnings**. Runtime-only audit: **0**.
- The five remaining warnings trace to the same unpatched `braces` dependency
  through the Tailwind development/build tools. The currently published release
  is still `3.0.3`; do not pretend a non-existent `3.0.4` fixes it.
- Tailwind scans trusted repository paths, not customer uploads or customer
  glob expressions. Its build dependency is not part of the contact function.
  This limits exposure; it does not remove the advisory or prove zero risk.
- Added a lockfile regression test and a CI runtime-dependency audit. Full
  development audit warnings remain visible and must be reviewed separately.
- 19 root tests and 28 frontend tests pass. Typecheck/build, SDK loading, secret
  scan and whitespace checks pass. The CSS output hash is unchanged.
- The security patch has **not been redeployed**: Vercel's CLI login could not
  refresh. Renew the CLI login, repeat the safe deployment dry run, then deploy.
  Do not solve the remaining warning using an unreviewed `npm audit fix --force`.

References: [gRPC maintainer advisory](https://github.com/grpc/grpc-node/security/advisories/GHSA-m9gg-hp2v-232j),
[braces advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm),
[maintainer issue](https://github.com/micromatch/braces/issues/70).

## 2. Inquiry intake — owner configuration required

Status update, 5 October: server variables are configured and Apps Script
Version 4 is deployed. One labelled inquiry was stored without duplication on
retry, but both public requests returned 502. The timeout repair is local and
awaits Vercel publishing. See `intake-timeout-repair-2026-10-05.md`; the steps
below remain a setup checklist, not the current verification status.

1. Open Apps Script **Project Settings → Script Properties** for the existing
   inquiry project. Keep `INTAKE_SECRET` and `SHEET_ID` there. Do not change or
   disclose the secret unless deliberately rotating both ends together.
2. Back up the inquiry sheet privately. Deploy the canonical
   `appscript/nodalx-intake.gs` alone, run `setupSheetHeaders` and `healthCheck`,
   and stop if the first tab has incompatible headings or extension columns.
3. **Deploy → Manage deployments → Edit → New version**, web app executing as
   the owner with access Anyone. The shared-secret gate remains mandatory.
   Copy the actual `/macros/s/.../exec` URL, not the project editor URL.
4. Open [Vercel environment settings](https://vercel.com/worksushantsaurabh-webs-projects/nodalx-frontend/settings/environment-variables).
   Add both variables for **Production**, using the private fields:

   | Variable | Value |
   | --- | --- |
   | `APPS_SCRIPT_WEB_APP_URL` | Deployed web-app URL ending in `/exec` |
   | `APPS_SCRIPT_INTAKE_SECRET` | Exact value of Apps Script `INTAKE_SECRET` |

5. Add a public intake rate-limit/bot rule before opening submissions to traffic.
   The server secret does not prevent bots using the public proxy to spend the
   owner's email quota. Do not activate a paid protection plan without approval.
6. Redeploy Vercel after environment changes. Keep `.vercelignore`: it prevents
   private backups, archived credentials and logs being uploaded.
7. Run protected, read-only provider health using an ignored local environment:

   ```sh
   node --env-file=.env.local scripts/check-intake.mjs --upstream-health
   ```

8. With owner approval, submit one labelled inquiry to an inbox the owner
   controls. Verify a real Sheet row and HTTP 202. Retry the exact same payload
   with the same key: one row and no duplicate notifications. A different
   payload must have a different key. A health check alone does not prove storage.

**Confirmed public intake is not yet verified after the timeout repair.** Apps Script rows are
not automatically visible in the current Firestore dashboard. Never expose the
entire owner spreadsheet to every signed-in user.

## 3. Domain — Vercel attachment completed, DNS verified

`nodalx.in` was added to `nodalx-frontend`, and the signed-in Vercel domain page
confirms the association. It is now verified and resolving properly.

The domain's authoritative nameservers are:

```text
chad.ns.cloudflare.com
marissa.ns.cloudflare.com
```

GoDaddy may still be the registrar, but the live DNS is now Cloudflare. Editing
the former GoDaddy DNS zone will not fix the currently delegated records.

Vercel's project-specific recommendation observed in the domain panel:

| Type | Name | Target | Proxy |
| --- | --- | --- | --- |
| CNAME | `@` | `b819ace95be0a449.vercel-dns-017.com` | Disabled / DNS only |

1. Sign in to the Cloudflare account containing `nodalx.in` (the login page is
   open in Chrome). Do not create a new account or select an unrelated account.
2. Open **nodalx.in → DNS → Records**. Save a private record snapshot first.
3. Recheck [Vercel domain settings](https://vercel.com/worksushantsaurabh-webs-projects/nodalx-frontend/settings/domains)
   for the current recommendation before editing; provider values can change.
4. Replace only conflicting apex web-serving A/AAAA/CNAME records with the
   recommended apex CNAME. Cloudflare supports apex CNAME flattening. Preserve
   MX, SPF, DKIM, DMARC, NS and unrelated TXT records; do not change nameservers.
5. Vercel recommends DNS-only. Turning off the Cloudflare proxy removes that
   hostname from Cloudflare's proxied WAF path. The owner must approve that
   trade-off before an assistant changes it; use appropriate Vercel protections.
   Do not weaken TLS or switch to Flexible SSL to work around certificate errors.
6. Save, then use Vercel's **Refresh**. Confirm **Valid Configuration**, a valid
   HTTPS certificate and the actual NodalX page at `https://nodalx.in`.
   Attachment alone is not DNS propagation or TLS validation.
7. Add `www.nodalx.in` only if wanted, using its own Vercel recommendation and
   redirect to the selected canonical domain. No `www` domain was added here.

References: [Cloudflare record management](https://developers.cloudflare.com/dns/manage-dns-records/how-to/create-dns-records/),
[apex CNAME flattening](https://developers.cloudflare.com/dns/cname-flattening/).

## 4. Dashboard backend — blocked on approved AWS access

The legacy dashboard API remains unavailable; no fake data or shared-owner Sheet
bridge was substituted. Follow `aws-migration.md` for the full route/data/auth
inventory. The existing AWS template implements **contact only**, not dashboard.

1. Owner confirms the target AWS account/profile, region, staging environment
   and cost approval. Current default profile selects `us-east-1`, but its SSO
   session is expired and account identity is not verified.
2. Owner renews the approved profile's login, then verify the account identity.
   Do not share access keys, passwords or SSO tokens in chat.
3. Implement Cognito auth and stable Firebase-UID/workspace mapping, tenant-keyed
   DynamoDB repositories, existing API contracts and server-owned entitlements.
4. Include uploads, Sheets ownership, saved recipes, usage periods, queues,
   schedules, exception handling and billing replay guards; do not migrate only
   inquiries and accidentally abandon the other services.
5. Test two-user isolation, preserved subscription limits, failed-provider
   recovery and actual dashboard reads/status changes in staging.
6. Rehearse an approved encrypted data migration and rollback before production
   cutover. Only remove Firebase after parity, preservation and cutover checks.

No AWS infrastructure was provisioned, no Google billing was activated, and no
customer data was exported or deleted during this repair pass.
