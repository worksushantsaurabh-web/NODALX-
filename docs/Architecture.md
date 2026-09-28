---
title: Architecture
type: reference
tags: [architecture, system-design, dataflow]
aliases: [system-overview, how-it-works]
---

# Architecture

## System Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER (Browser)                               │
└──────────────┬──────────────────────────────────┬───────────────────┘
               │                                  │
               ▼                                  ▼
┌──────────────────────────┐      ┌──────────────────────────────────┐
│   Frontend (Vercel)       │      │   Apps Script (Google)           │
│   Vite + React SPA        │      │   Inquiry webhook + classifier   │
│   → [[Frontend]]          │      │   → [[Appscript]]                │
└──────────┬───────────────┘      └───────────────┬──────────────────┘
           │                                      │
           │ REST API calls                       │ Stores to
           ▼                                      ▼
┌──────────────────────────┐      ┌──────────────────────────────────┐
│   Backend (Cloud Run)     │      │   Google Sheets                  │
│   Express + Vertex AI     │      │   (Inquiry storage, free tier)   │
│   → [[Backend]]           │      └──────────────────────────────────┘
└──────────┬───────────────┘
           │
           │ Admin SDK
           ▼
┌──────────────────────────┐
│   Firebase                │
│   ├── Auth (user login)   │
│   ├── Firestore (data)    │
│   └── Functions           │
│       → [[Functions]]     │
└───────────────────────────┘
```

---

## Data Flow

### 1. User signs up / logs in
`Frontend` → Firebase Auth → Firestore `/users/{uid}` created with `tier: "free"`

### 2. Inquiry submitted (contact form)
`Frontend` → Apps Script webhook → Gemini classification → Google Sheets storage
`Frontend` also reads back via `GET ?action=list` for the dashboard

### 3. Dashboard loads
`Frontend` → [[Backend]] `/api/*` endpoints → Firestore reads
`Frontend` → Apps Script `?action=stats` → Aggregated metrics

### 4. AI features (Vertex AI)
`Frontend` → [[Backend]] `/api-proxy/*` → Google Vertex AI (Gemini)
Backend proxies to avoid exposing GCP credentials client-side

### 5. Cloud Functions (server-side triggers)
- API key generation/validation
- CSV/XLSX file upload processing
- Google Sheets sync
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
| Frontend → Apps Script | Public webhook (CORS-restricted) |
| Backend → Firestore | Admin SDK (full access) |
| Functions → Firestore | Admin SDK (full access) |
| Client → Firestore | Restricted by [[Firestore-Rules]] |

---

## Related

- [[Tech-Stack]] — What each piece is built with
- [[Deployment]] — How each service deploys
- [[Environment]] — Secrets and config per service
