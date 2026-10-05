# Release status — 30 September 2026

## Billing constraint

Do not add a payment method, enable billing, or link another billing account while
the overdue Veo charges are under dispute without the owner's explicit decision.
Moving projects does not cancel the balance. No promise can be made that a new
billing account prevents collection; obtain written guidance from Google support.

## Completed

- [x] Fixed the stale Firebase token getter and closed direct profile writes.
- [x] Replaced the broken synchronous WebSocket placeholder with an explicit
  async `openVertexSocket` helper. Native interception now fails clearly.
- [x] Local Vertex HTTP and Live proxies require explicit opt-in, Firebase auth,
  and an explicit Gemini model allowlist. HTTP predict and reasoning engines
  are denied. This is a local development backend, not the deployed Functions API.
- [x] Published frontend and Firestore rules to `nodalxai-b9eb5`, without enabling
  billing. Both `nodalx.in` and the Firebase host serve `index-BlF9pcZ4.js`.
- [x] Verified both public hosts return HTTP 200, new security headers and no
  proxy-shim markers in their main bundle. The tested API route still returns 503.
- [x] Vercel now serves the domain `nodalx.in`. The GCP project is suspended.
- [x] Rule emulator tests cover free signup, tier escalation, profile writes,
  cross-tenant reads and direct intake writes. Added these tests to CI.
- [x] Repaired backup traversal, pagination and typed-value preservation.
  Verified 41 Firestore documents across 18 collections; exported 5 Auth accounts.
- [x] Backups copied to `.private-backups/verified-20260930/`, ignored by Git,
  with owner-only filesystem permissions. Treat these as sensitive local files.
- [x] Removed the obsolete local `safety-pre-scrub` tag. All reachable-history
  secret checks now pass; no remote tags were advertised at inspection.
- [x] CI scans real Git history; staged mode reads the index, not working files.
- [x] Removed stale Apps Script URLs from local frontend environment files and
  retired the credential in the ignored archived proxy copy.
- [x] Upgraded Firebase server dependencies and CSV parser; SheetJS now uses
  its official 0.20.3 tarball. Scoped gaxios 6 override uses patched uuid 11
  (gaxios uses its compatible `v4()` API). Production npm audits report zero
  vulnerabilities for frontend, Functions and local backend.

## Still blocked or requiring live acceptance

- [ ] Functions and scheduler deployment: billing dispute unresolved. No billing
  change was made. Frontend deployment does not restore the API.
- [ ] Firestore indexes release: review live index changes before deployment.
- [ ] Provider-side credential revocation/rotation and Firebase browser API-key
  HTTP-referrer restrictions: require console access and credential ownership.
- [ ] Authorized Apps Script GET smoke test: requires the server-held intake secret.
  Never paste it into chat or put it in a VITE variable.
- [ ] Signed-in end-to-end dashboard, HubSpot, responsive/theme and Live socket
  acceptance: cannot infer success from an HTTP 200 or an unauthenticated 401.
- [ ] Configure production uptime and billing alerts in the selected provider.
- [x] Reviewed and committed the current release changes; see Git log for the
  release commit. Repository publication is separate from Functions deployment.

## Backup limits

The Firestore export is paginated, not a transactionally consistent snapshot.
It includes nested collections and raw typed fields but excludes Storage objects,
rules, indexes and secrets. Auth export is separate; restoring password accounts
also requires the source project's password-hash configuration. No restore or
project migration has been performed. Copy the protected backup to trusted
encrypted storage before relying on it as disaster recovery.

## Corrections to earlier chat advice

- As of Oct 2026, the apex resolves to Vercel anycast IPs, not Firebase.
- Domain discussed here is `nodalx.in`; claims about `nodalx.ai` were a mistake.
- Billing suspension is not the same as project deletion; there is no established
  automatic 30-day deletion deadline for this project's billing suspension.
- The previous export missed nested documents and was not a complete backup.
- Veo charge attribution remains unproven. A proxy finding is not evidence that
  the proxy was deployed or caused those charges. Preserve billing/audit evidence.
- Budget alerts notify; they are not hard spending caps. Free services also have
  quotas and suspension conditions. Firebase Storage should not be assumed to
  remain available without Blaze.

## Resume safely

Keep the existing project while the dispute proceeds. Ask Google billing support
about interim service access without adding a payment method. If an independent
free backend is chosen, scope that migration separately: authentication, APIs,
secret storage, quotas and AI costs must all be addressed before changing DNS.
`functions/` remains the production API; `backend/` is development-only.
