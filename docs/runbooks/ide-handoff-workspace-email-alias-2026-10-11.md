# NodalX — IDE handoff prompt: per-workspace email aliases

> Update, 11 October 2026: implementation work has started in this checkout.
> The chosen managed identity is `<alias>@reply.nodalx.in`, with that address
> used as both From and Reply-To after end-to-end receiving verification.
> See `workspace-email-replies-2026-10-11.md` for the current staged status.
> The dated clean-tree and test counts below describe the earlier handoff
> snapshot, not the current working tree.

> Copy everything below this line into a new IDE session (Cursor, Claude Code,
> Copilot, Windsurf, or opencode). It is self-contained: another agent should be
> able to execute the task without reading this repository's history.

---

## Your task

Implement **per-workspace sending aliases** so that a dashboard reply to a lead
is sent from a real, dedicated inbox belonging to that customer's workspace
(e.g. `From: acme@nodalx.in`) instead of one shared `reply@nodalx.in` address.

Do **not** attempt to send from a customer's personal address (for example
`owner@gmail.com`). That is technically impossible for any provider and is
explained under "Why the From address is constrained" below.

Work through the phases in order. Do not start Phase 2 before Phase 1 is merged
and verified. Stop and ask the owner before anything that touches production,
spends money, or sends a real email.

---

## Repository and stack

- Repo: `/Users/sushantsaurabh/Desktop/NODALXAI`
- Branch: `nodalx-staging` (all work lands here; never merge to `main`)
- Frontend: React + TypeScript + Vite + Tailwind in `frontend/`
- APIs: Vercel serverless functions in `api/` and `server/`
- Auth: hosted Supabase Auth, project `ozovfbwhcvbgpgrxxjcj` (identity only)
- App database: AWS RDS PostgreSQL, database `nodalx_app`
- Email provider: Resend, domain `nodalx.in` verified and sending enabled
- Production: `https://nodalx.in`
- Git identity for this repo is already set to `work.sushantsaurabh@gmail.com`.
  Keep it. Do not change git config.

### Read these first (authoritative)

1. `AGENTS.md` — project rules and the dated implementation log. Its
   "Non-negotiable rules" section is binding.
2. `docs/LLM-MIND.md` — compact current state, invariants, next-action order.

---

## Current verified state

- Working tree is clean. HEAD is `7d628f7`.
- Production `nodalx.in` runs deployment `dpl_CPLoArpwoRQyniemYQKpQSZ2UVem`,
  built from commit `cb24e94` (content identical to `24024d5`; only the commit
  author email differs, which is required for Vercel deploys to be permitted).
- RDS `nodalx_app` has 20 migrations applied, all reported "Already applied".
  The last is `20261010214000_inquiry_analysis_persistence_and_review.sql`.
- RDS currently holds: 1 workspace, 1 auth mirror, 1 identity binding,
  0 inquiries, 0 outbound emails. Production is effectively unused.
- All SQL assertions pass: 156/156 across 9 files on RDS `nodalx_test`.
- Default backend suite: 112 pass, 0 fail, 5 Docker-only opt-ins skipped.
- Frontend build clean; secret scan 359 tracked files, 0 findings.

### Environment files (never commit, never print values)

- `.env.rds.local` — `RDS_DATABASE_URL`, form `/postgres?sslmode=require`
- `.env.local` — local dev config, gitignored
- Root `.env.example` documents required server variables

To load them in Node use `--env-file`:
`node --env-file=.env.rds.local scripts/check-rds.mjs`

---

## Existing email implementation

Everything you need already exists. Read these files before editing:

- `server/outbound-email.mjs` — sending path. Exports
  `senderFor(accountEmail, environment)`, `sendInquiryEmail(...)`,
  `validateOutboundEmail(...)`, `listInquiryEmails(...)`.
- `server/supabase-workspace.mjs` — routes
  `GET/POST /api/workspace/inquiries/:id/emails`. It already destructures
  `user` from `authorizeWorkspace` and passes `user.email` as `accountEmail`.
- `tests/outbound-email.test.mjs` — 5 tests including sender-selection cases.
- `supabase/migrations/20261005000700_outbound_email_desk.sql` and
  `supabase/migrations/20261007162333_harden_outbound_email_reservation.sql` —
  the ledger and service-only reservation RPC.

### Current sender logic

```js
export function senderFor(accountEmail, environment) {
  const configured = environment.OUTBOUND_EMAIL_FROM;   // 'NodalX <reply@nodalx.in>'
  const local = configured.replace(/^.*<([^>]+)>$/, '$1');
  const configuredDomain = (local.split('@')[1] || '').toLowerCase();
  const address = typeof accountEmail === 'string' ? accountEmail.trim().toLowerCase() : '';
  if (!emailPattern.test(address)) return {from: configured, replyTo: null};
  const domain = address.split('@')[1];
  if (domain !== configuredDomain) return {from: configured, replyTo: address};
  const displayName = (environment.OUTBOUND_EMAIL_DISPLAY_NAME || '').trim();
  return {from: displayName ? `${displayName} <${address}>` : address, replyTo: address};
}
```

So today: an operator registered at `someone@nodalx.in` sends as themselves;
anyone on any other domain falls back to the NodalX sender with the operator's
address in `Reply-To`.

---

## Why the From address is constrained

This is settled and must not be re-litigated during implementation.

Email authentication works through SPF and DKIM DNS records published by the
sending domain. If NodalX set `From: owner@gmail.com`, the message would fail
DMARC because gmail.com never authorized NodalX to send as it. It would land in
spam and would damage NodalX's sending reputation.

Resend's documented behavior: *"Once a domain is verified in your Resend
account, you can send from any address at that domain."* Only `nodalx.in` is
verified.

Therefore the alias approach: give each workspace a real, dedicated inbox on
the already-verified `nodalx.in` domain. Leads see a consistent, working
address; replies arrive in that workspace's own inbox.

### Product options, with the owner's current decision

| Option | Outcome | Owner decision |
|---|---|---|
| Per-workspace alias on `nodalx.in` | Real dedicated inbox per customer | **APPROVED — implement this** |
| Customer verifies own domain | Sends from their real domain | Approved as a later upgrade path; not now |
| BYOK (customer supplies Resend key) | Native sending, but setup burden | Rejected — too hard for non-technical users |
| Open in customer's mail app | Replies from their own machine | Existing fallback; keep working |

### Decisions locked by the owner (11 October 2026)

**Q1 — alias is changeable, but only on explicit request.**
The alias is not permanently immutable. It changes only when the owner
deliberately asks for it, through a dedicated server-only action. Never change
it as a side effect of any other operation, never on signup, and never
automatically.

Implementation requirements:
- A single explicit `change` action, service-role only, on the owned workspace.
- Reuse the full validation path from allocation: format CHECK, reserved words,
  and uniqueness. Reject rather than silently fall back.
- Rate-limit changes, because alias churn is both an abuse vector and a way to
  squat another business's name. One change per workspace per 24 hours is a
  reasonable default; confirm with the owner before hard-coding.
- Audit every change. Append an entry recording old alias, new alias, actor,
  and timestamp. Do not overwrite the previous value in place.
- Confirm the trade-off in the UI before the change is applied: leads who
  already received mail at the old address will keep replying there. Older
  threads will not migrate.
- The previous alias must stop accepting new sends immediately, and must not be
  released back into the pool for another workspace to claim.

**Q3 — display name is generic and professional.**
Use the registered company name when present, otherwise the operator's display
name, otherwise `NodalX`. Never an email address and never a raw workspace id.

- Precedence: workspace/company name -> operator display name -> `NodalX`.
  Change this order only if the owner asks.
- Sanitize before it reaches a header. Strip CR, LF, other control characters,
  and the characters `<`, `>`, and `"`. A display name is interpolated into
  `From: Name <alias@nodalx.in>`, so an unsanitized value is a header-injection
  vector. Treat it as untrusted input from the profile table.
- Cap the length (60 characters is a sensible default).
- Collapse surrounding whitespace and trim. Do not allow the display name to
  change the alias.
- Cover the fallback chain and the injection cases in tests.

---

## Phase 1 — per-workspace alias (the task)

### 1a. Schema

Add a migration `supabase/migrations/<timestamp>_workspace_email_alias.sql`
using the next timestamp after `20261010214000`.

Requirements:
- Add an alias column to `public.workspaces` (e.g.
  `email_alias text UNIQUE`), or a separate private table if you prefer
  server-owned data to stay out of the workspace row.
- Enforce format with a CHECK constraint: lowercase ASCII, 3–30 chars,
  `^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$`, no consecutive hyphens, no reserved
  words. Reject `admin`, `support`, `postmaster`, `abuse`, `noreply`,
  `security`, `billing`, `help`, `root`, `www`.
- Alias is allocated automatically and is **not** changed by any other
  operation. The owner may request a deliberate change through a dedicated
  service-only action — see "Decisions locked by the owner", Q1. When
  implementing, do not make the alias globally immutable and do not make it
  freely mutable: only an explicit owner request may change it, and every
  change is audited and rate-limited.
- RLS on: clients may read their own alias, never write it. Writes are
  server-only, exactly like the other server-owned fields.
- Reserved-alias uniqueness must be enforced in the database, not only in JS.

### 1b. Alias allocation

- Allocate in `bootstrap_workspace` or in a small helper the server calls after
  workspace creation. Derive a deterministic candidate from the workspace id,
  then disambiguate with a short suffix on collision.
- Allocate inside the database function so concurrent signups cannot collide.
- The alias is the workspace identity, not a user-chosen value at signup.

### 1c. Reply routing (Q2 still open — raise before implementing)

Replies to `acme@nodalx.in` must reach that workspace. Two candidate approaches:

- **Option A (preferred if supported):** Resend inbound routing / receiving
  domain, with a webhook that resolves the alias to a workspace and records the
  inbound message.
- **Option B:** forward or CC the alias to an owner-configured address.

Do not claim inbound routing works until it is verified end to end with a real
message. If Resend inbound routing is unavailable or unsuitable on the current
plan, say so and fall back to Option B rather than building something that
looks like inbound routing but silently drops mail.

### 1d. Changing the alias on owner request

Required because of decision Q1. This is a new, explicit, service-only path:

- A single `change` action that reuses the allocation validation path. It must
  not be reachable from any general update field.
- Rate-limit it. Suggested: one change per workspace per 24 hours. Confirm with
  the owner before hard-coding a value.
- Audit the change: old alias, new alias, actor, timestamp, appended not
  overwritten.
- After a change, the old alias stops accepting new sends immediately and is
  never handed to another workspace.
- The UI must state the consequence plainly: leads who already received mail at
  the old address keep replying there, and those threads do not migrate.

### 1e. Sender selection

Update `senderFor` so the workspace alias is preferred:

- `from` = `<Display Name> <alias@nodalx.in>`
- `reply_to` = the operator's verified account email, so a lead's reply reaches
  the human who pressed send
- fall back to the current behaviour when no alias exists

Display name precedence and sanitization are specified under "Decisions locked
by the owner", Q3. The sanitizer is the important part: the name is
interpolated into a mail header, so it must be treated as untrusted input.

Keep these invariants and keep them covered by tests:
- the alias always comes from the server-side workspace record, never from the
  request body
- the display name is sanitized and never contains `<`, `>`, `"`, CR or LF
- a lookalike domain such as `attacker@nodalx.in.evil.com` is never treated as
  sendable
- values containing CR/LF are rejected (header injection)
- the lead's own stored address remains the sole recipient; no owner-directed
  routing

### 1f. Settings UI

- Show the workspace sending address in the dashboard settings area, with the
  resolved display name next to it so the owner can see exactly what leads will
  see before sending.
- Offer a "change" control that runs the Q1 flow, including the plain-language
  warning that existing threads stay at the old address.
- Explain plainly that replies come to the operator's account and that the
  sending address is the workspace address.

### 1g. Tests

- `tests/outbound-email.test.mjs` — alias preferred, reply-to set, fallbacks,
  injection and lookalike rejection.
- `supabase/tests/database/*.test.sql` — alias allocation is unique under
  concurrency, format is enforced, reserved words are rejected, cross-workspace
  read/write is denied, and the alias cannot be client-written.
- Update the rate-limit assertion in `inquiry_desk.test.sql` if new accepted
  writes are added: `update_own_criteria` and every accepted review decision
  spend the same 60-write desk budget, so the loop count must be adjusted.

---

## Phase 2 — customer domain verification (later, ask first)

Only after Phase 1 ships and the owner decides. Use Resend's domain API to
verify a customer's domain, issue a domain-scoped API key, and select the
sending identity per workspace. This needs new UI, credential storage, and
bounce handling. Do not begin without explicit approval.

---

## Commands

```sh
# RDS
npm run check:rds                      # connectivity, TLS, PG version
npm run migrate:rds                    # apply pending migrations
npm run test:rds                       # 156 SQL assertions on nodalx_test
npm run test:rds -- --reset            # rebuild the test database from zero

# backend
npm run test:intake                    # default suite, 5 Docker opt-ins skipped
node --test tests/outbound-email.test.mjs
node --test tests/nodalx-v3-*.test.mjs

# frontend
cd frontend && npm run build
cd frontend && node --test pages/inquiryDesk.test.ts

# always
node scripts/scan-secrets.mjs
git diff --check
```

`npm run test:rds` is the only database path; it can never reach `nodalx_app`
by construction. Do not point it at the application database.

---

## Rules you must follow

1. Never commit secrets, customer exports, auth hashes, or credentials.
2. Never print secret values in output. Pull to gitignored files only.
3. No payment method, no Google Cloud billing, no paid resources.
4. No Make or Gemini execution. The owner has a privately trained model; the
   processing gate stays off.
5. Preserve unrelated uncommitted work. Inspect before changing or deleting.
6. Original inquiry text is immutable and must never be overwritten.
7. One verified identity = one workspace. No email matching, no shared access.
8. Use semantic theme tokens only: `bg-bg`, `bg-surface`,
   `bg-surface-hover`, `border-border`, `text-text-primary`,
   `text-text-secondary`, `text-text-tertiary`, `bg-accent`, `text-accent`.
9. Before calling anything complete, run the build, lint, tests, secret scan,
   and `git diff --check`, and list any skipped live checks.
10. **After every passed implementation, update `AGENTS.md` and
    `docs/LLM-MIND.md` in the same turn.** Record what changed, new
    constraints, the verification run, and pending owner actions.
11. Do not deploy to Production without explicit owner approval. Do not disable
    Vercel deployment protection.
12. Do not describe configuration-only checks as live health.

---

## Deployment notes (read before deploying)

- Vercel CLI is authenticated as `worksushantswarab-web`.
- Vercel blocks a Production deploy when the **commit author email** is not a
  team member. The repo-local git identity is already set to
  `work.sushantsaurabh@gmail.com` for this reason. Do not change it back.
- CLI `--prod` deploys run to a long timeout. Run it detached and poll
  `vercel ls`; do not assume a timeout means failure.
- Deploy from a clean worktree at the exact reviewed commit, never from a dirty
  checkout.
- **Always smoke-test a Preview before promoting.** A green build does not mean
  working routes: `.vercelignore` is a strict allowlist, and a missing server
  module ships a build that fails every API route at runtime with
  `ERR_MODULE_NOT_FOUND`. `tests/supabase-routing.test.mjs` now derives the
  required allowlist from real imports; keep that test passing.
- Rollback for the current Production build: `dpl_FFL6UHqrpWpyt9QhubpvYcHWRqno`.

---

## Definition of done

Phase 1 is complete when:
- a workspace receives a unique alias on `nodalx.in` and it is stored server-side
- a dashboard reply uses that alias as `From` with the operator as `Reply-To`
- replies are verifiably routed to that workspace
- SQL and JS tests cover allocation, isolation, the explicit change flow
  (including its rate limit and audit record), and injection
- `npm run test:rds`, `npm run test:intake`, the frontend build, the secret
  scan, and `git diff --check` all pass
- `AGENTS.md` and `docs/LLM-MIND.md` are updated in the same turn
- nothing is deployed to Production without owner approval

## Open questions for the owner

**Answered:**
1. ~~Should the sending alias be immutable?~~ **No — changeable, but only when
   the owner explicitly asks for it.** See the Q1 section above.
3. ~~What display name should outgoing mail use?~~ **Generic and professional:
   the registered company name, otherwise the operator's display name,
   otherwise `NodalX`, always sanitized.** See the Q3 section above.

**Still open — answer these before Phase 1 ships:**
2. Where should inbound replies land: Resend inbound routing (needs provider
   support and a webhook), or a forward/CC to an owner-configured address?
   This decides whether replies actually reach the workspace.
4. Is a per-workspace subdomain such as `<alias>.send.nodalx.in` preferred for
   reputation isolation, or is a flat `<alias>@nodalx.in` acceptable?

**Additional question raised while writing this up:**
5. What rate limit should apply to alias changes? Suggested default is one per
   workspace per 24 hours, to prevent alias churn and name squatting.
