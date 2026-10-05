---
title: Architecture
type: reference
tags: [architecture, system-design, dataflow]
aliases: [system-overview, how-it-works]
---

# Architecture

> Firebase remains the workspace backend. The alternate Vercel intake route and
> an AWS intake pilot are prepared locally, not verified production replacements.
> See `docs/runbooks/aws-migration.md` for the 4 October audit and staged cutover.

## System Diagram

```text
Browser → Firebase Hosting (React SPA)
        → Firebase Auth (sign-in)
        → Firebase Functions (verified UID / server-held intake key)
          → Firestore (authoritative inquiry and workspace storage)
          → Optional configured classification workflow
          → Google Sheets (explicit import / optional export)
          → Optional configured Slack notifications

Alternate intake: Vercel api/contact.mjs → server/contact.mjs → protected Apps Script → Sheet
Prepared AWS intake pilot: API Gateway → Lambda → same intake service → Apps Script
Local-only legacy runtime: backend/ Express and disabled Vertex proxy
```

Production Functions is currently unavailable due to billing suspension. The
alternate Apps Script path has no automatic bridge into dashboard inquiries.
The audited custom domain currently returns 404; the Vercel production project
also lacks both required server-side Apps Script variables. AWS auth, workspace
APIs, data and workers have not been migrated. Do not remove Firebase yet.

---

## Data Flow

### 1. User signs up / logs in
`Frontend` → Firebase Auth → Firestore `/users/{uid}` created with `tier: "free"`

### 2. Inquiry submitted (contact form)
The frontend posts to `/api/contact`. Firebase Hosting routes to Functions and
Firestore; the alternate Vercel configuration reserves this route for the Node
function and protected Apps Script. Other Vercel `/api/*` requests still proxy
to Firebase. Which configuration is deployed must be verified with the owner.
Apps Script variables are server-only; captured Sheet rows do not automatically
appear in the Firestore-backed Inquiry Desk.

### 3. Dashboard loads
`Frontend` → Firebase Functions `/api/*` endpoints → owner-scoped Firestore.

### 4. Optional qualification
`Functions` → configured external workflow for optional classification. The
legacy `backend/` Vertex proxy is local-only and disabled unless explicitly
configured.

### 5. Cloud Functions (server-side triggers)
- API key generation/validation
- CSV/XLSX file upload processing
- Explicit Google Sheets import and optional results export
- Rate limiting

---

## Authentication Flow

```
User → Firebase Auth (Google/Email) → JWT token
     → Frontend stores token
     → Every API call sends Authorization: Bearer <token>
     → Backend/Functions verify via Firebase Admin SDK
```

See [[Firestore-Rules]] for per-collection access control.

---

## Key Boundaries

| Boundary | Trust Level |
|----------|-------------|
| Frontend → Backend | Authenticated (JWT verified server-side) |
| Server → Apps Script (alternate deployment only) | Server-held shared secret; never browser credentials |
| Backend → Firestore | Admin SDK (full access) |
| Functions → Firestore | Admin SDK (full access) |
| Client → Firestore | Restricted by [[Firestore-Rules]] |

---

## Related

- [[Tech-Stack]] — What each piece is built with
- [[Deployment]] — How each service deploys
- [[Environment]] — Secrets and config per service
