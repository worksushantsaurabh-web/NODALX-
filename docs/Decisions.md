---
title: Decisions
type: log
tags: [decisions, adr, architecture-decisions]
aliases: [ADR, architecture-decision-record]
---

# Architecture Decisions

> Key decisions made during development and their reasoning.

---

## D1: Replaced n8n with Google Apps Script

**Date**: 2025  
**Status**: Done  

**Context**: n8n Cloud was costing $20-50/mo for a simple webhook → classify → store pipeline.

**Decision**: Move to Google Apps Script with embedded keyword classification.

**Consequence**:
- Cost: $0/mo (was $70/mo with Airtable)
- Tradeoff: Less flexible than n8n visual editor
- Mitigation: Classification logic is simple enough for keyword rules

See [[Appscript]] for implementation.

---

## D2: Vercel for frontend instead of Firebase Hosting

**Status**: Active

**Context**: Firebase Hosting works but Vercel offers better DX (preview deploys, instant rollbacks, edge CDN).

**Decision**: Deploy frontend to Vercel. Keep `firebase.json` hosting config as fallback.

**Consequence**:
- `vercel.json` in root handles frontend
- `firebase.json` hosting section is unused but preserved
- Env vars must be set in Vercel Dashboard (not Firebase)

See [[Deployment]] for both paths.

---

## D3: Backend on Cloud Run (not Firebase Functions)

**Status**: Active

**Context**: Backend needs always-on WebSocket support and longer execution times than Functions allow.

**Decision**: Express server on Cloud Run for the main API. Firebase Functions for event-driven tasks only.

**Consequence**:
- [[Backend]] = Cloud Run (always warm, WebSocket OK)
- [[Functions]] = Firebase (cold-start OK, event triggers)
- Both use Firebase Admin SDK for Firestore

---

## D4: No workspaces (removed)

**Date**: 2026-08-14  
**Status**: Active

**Context**: npm workspaces hoisted all deps into root `node_modules` (731MB). Frontend deploys independently on Vercel, backend on Cloud Run — no shared deps at build time.

**Decision**: Remove workspaces. Each subfolder is self-contained.

**Consequence**:
- Root `node_modules` = 13MB (only `concurrently`)
- `npm run dev` still works via `--prefix`
- Each service installs/builds independently

---

## D5: Firestore client updates blocked by rules

**Status**: Active

**Context**: Users shouldn't be able to upgrade their own tier.

**Decision**: `allow update: if false` on `/users/{uid}`. All tier changes go through Admin SDK ([[Functions]]).

**Consequence**:
- Frontend can create user doc (with `tier: "free"` only)
- All upgrades/modifications are server-side only
- See [[Firestore-Rules]]

---

## Template for new decisions

```markdown
## D#: Title

**Date**: YYYY-MM-DD
**Status**: Proposed / Active / Superseded

**Context**: What prompted this decision?

**Decision**: What was decided?

**Consequence**: What are the tradeoffs?
```
