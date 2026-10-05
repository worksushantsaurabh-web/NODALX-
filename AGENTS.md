# NODALxAI project memory

## Product

NODALxAI is an inquiry intake and follow-up desk for small businesses. It
captures inbound inquiries, preserves the original message, optionally applies
qualification/classification, and gives a human a clear next action.

The launch promise is operational clarity, not guaranteed conversion, delivery,
or autonomous sending.

## Current stack

- Frontend: React + TypeScript + Vite + Tailwind, `frontend/`
- Authentication: Firebase Auth
- Database: Cloud Firestore
- Production frontend: Firebase Hosting, project `nodalxai-b9eb5`
- Intended production API: Firebase Functions, `functions/`
- Intake connector: guarded Google Apps Script, used only server-side
- Optional processing: configured external workflow (`MAKE_WEBHOOK_URL`)
- Local-only legacy backend: Express/WebSocket server, `backend/`
- Deployment config: `firebase.json`; Vercel files are alternate configuration,
  not proof that Vercel serves the production domain

## Non-negotiable rules

- Never commit secrets, customer exports, authentication hashes, or credentials.
- Do not add a payment method or enable Google Cloud billing without explicit
  owner approval while the Veo dispute is open.
- Do not deploy Functions while billing is suspended; the API currently returns
  503 and this is an acknowledged release blocker.
- Firestore server-owned fields include entitlement/tier, subscription state,
  API keys, quotas and usage. Client writes to those fields are forbidden.
- For the pilot, one Firebase Auth UID is one workspace. Do not introduce team
  roles or cross-user sharing without an approved design change.
- Every endpoint needs boundary validation, authentication where applicable,
  ownership authorization, rate limiting where it can spend or mutate, and tests.
- Preserve original inquiry text; do not log message contents, tokens, emails or
  provider credentials unnecessarily.
- Do not call a preview, mock or static example a live integration.
- Keep inquiry body text opaque. Surface blur/glass is allowed; text blur is not.
- Use semantic theme tokens: `bg-bg`, `bg-surface`, `bg-surface-hover`,
  `border-border`, `text-text-primary`, `text-text-secondary`,
  `text-text-tertiary`, `bg-accent`, `text-accent`.
- Do not discard unrelated uncommitted work. Inspect before changing or deleting.

## Commands

```sh
cd frontend && npm run build
cd frontend && node --test pages/inquiryDesk.test.ts
cd functions && npm run lint && npm test
cd backend && npm run test:ws-auth
node scripts/scan-secrets.mjs
```

## Release gates

Before describing a change as complete, run the relevant build, lint, tests,
secret scan and `git diff --check`. List skipped live checks. Hosting can be
released independently; Functions, rules and indexes require separate review.

## Source of truth

- Product scope: `docs/system-design.md`
- Runtime architecture: `docs/Architecture.md`
- Permissions: `docs/permissions.md`
- API contract: `docs/api-conventions.md`
- Remaining work and blockers: `docs/REMAINING-WORK.md`
- Historical decisions: `docs/Decisions.md` and `docs/decisions/`
