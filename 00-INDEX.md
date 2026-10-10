---
title: NodalX — Project Index
type: MOC
tags: [index, moc, nodalx]
---

# NodalX — Project Map of Content

> Inquiry intake and follow-up desk for small businesses. Captures inbound inquiries, preserves the original message, optionally applies qualification/classification, and gives a human a clear next action.

---

## Current Continuation

- `docs/runbooks/ide-handoff-current-2026-10-07.md` — authoritative current
  phase, verified state, missing work, fine-tuned-model integration path and a
  paste-ready prompt for another IDE.

---

## Current Target Architecture

- **Frontend**: React + TypeScript + Vite + Tailwind (Deployed to Vercel)
- **Database & Authentication**: Supabase (Native Supabase Auth and PostgreSQL, replacing Firebase/Firestore)
- **APIs**: Vercel Serverless Functions (`api/` and `server/` directories)
- **Automation (Optional)**: Make (durable staging, opaque Make lease, and canonical Supabase completion)

*(Note: AWS, Firebase Hosting, Cloud Run, and Google Cloud billing are legacy/suspended or historical paths not used in the current target migration.)*

---

## Subsystems

| Module          | Path         | Deploys To         | Note                                      |
| --------------- | ------------ | ------------------ | ----------------------------------------- |
| Frontend & APIs | `frontend/`, `api/`, `server/` | Vercel | React UI and Vercel-hosted API endpoints |
| Database        | `supabase/`  | Supabase           | PostgreSQL schema, migrations, RLS        |
| Apps Script     | `appscript/` | Google Apps Script | Legacy intake (retained for recovery)     |
| Legacy Backend  | `backend/`   | Local / Archived   | Legacy Express/WebSocket server           |
| Legacy Functions| `functions/` | Firebase Functions | Legacy Firebase backend (suspended)       |

---

## Infrastructure & Config

- **Supabase**: Source of truth, schema migrations in `supabase/migrations/`
- **Vercel**: `vercel.json` used for deployment configuration and API rewrites
- **Environment**: Server secrets managed in proper secret managers (e.g., Vercel Preview/Production variables). Never commit secrets to code.

---

## Folder Legend

```
NODALXAI/
├── frontend/        → React + Vite SPA components
├── api/ & server/   → Vercel serverless API handlers and backend logic
├── supabase/        → PostgreSQL database migrations and types
├── appscript/       → Google Apps Script source (legacy intake)
├── backend/         → Legacy Express backend
├── functions/       → Legacy Firebase Functions
├── docs/            → Project documentation, runbooks, and system design
├── _archive/        → Deprecated files (safe to ignore)
└── .obsidian/       → Vault config
```

---

## Status, Rules, and Checkpoints

- `AGENTS.md` — Authoritative repository rules, pipeline migration logs, and latest implementation checkpoints. **Read this before modifying the codebase.**
- `docs/LLM-MIND.md` — Compact operating context, guardrails, and knowledge states.
- `docs/runbooks/` — Detailed staging, setup, and migration logs (e.g., `nodalx-ide-handoff.md`, `supabase-migration-log.md`).
- `docs/migration/` — Route matrix, data models, and Make automation contracts.
