---
title: Backend
type: subsystem
tags: [backend, express, cloud-run, api, vertex-ai]
path: backend/
deploys_to: Cloud Run
---

# Backend

> Express.js API server deployed on Google Cloud Run. Proxies Vertex AI requests and handles Google Sheets integration.

---

## Tech

| Tool | Purpose |
|------|---------|
| Express 5 | HTTP framework |
| Firebase Admin SDK | Auth verification + Firestore access |
| Google Auth Library | Service account auth for GCP APIs |
| googleapis | Google Sheets API |
| ws | WebSocket support |
| express-rate-limit | Request throttling |

---

## File Map

```
backend/
├── server.js           # Main entry — all routes defined here
├── lib/
│   └── googleSheets.js # Google Sheets read/write helpers
├── data/               # (empty — runtime data dir)
├── package.json
├── package-lock.json
├── .env.example        # Required env vars template
└── client_secret.json  # Google OAuth credentials (GITIGNORED)
```

---

## API Routes

| Method | Path | Purpose |
|--------|------|---------|
| `*` | `/api-proxy/*` | Vertex AI proxy (Gemini models) |
| `*` | `/api/*` | General API endpoints |
| `GET` | `/ws-proxy` | WebSocket upgrade for streaming |

### Vertex AI Proxy
Frontend calls `/api-proxy/generateContent` → Backend forwards to:
```
https://aiplatform.clients6.google.com/{version}/projects/{projectId}/locations/{region}/publishers/google/models/{model}:generateContent
```
This keeps GCP service account credentials off the client.

---

## Authentication

Every request is verified via Firebase Admin SDK:
```
Authorization: Bearer <firebase-id-token>
```
Backend decodes and verifies the JWT, extracts `uid`.

---

## Environment Variables

```bash
PORT=5001
GOOGLE_CLOUD_PROJECT_ID=nodalxai-b9eb5
GOOGLE_CLOUD_REGION=us-central1
GOOGLE_APPLICATION_CREDENTIALS=./client_secret.json
```

See [[Environment]] for full reference.

---

## Running Locally

```bash
cd backend
npm install
npm run dev    # uses nodemon for hot-reload
```

Listens on `http://localhost:5001`. Frontend dev server proxies to this.

---

## Deployment

Deployed to **Google Cloud Run** at:
```
https://api-iw12dxqnoa-uc.a.run.app
```

See [[Deployment]] for deploy commands.

---

## Related

- [[Frontend]] — Calls this API via `src/services/api.ts`
- [[Functions]] — Shares some logic (both use Firebase Admin)
- [[Architecture]] — Where backend fits in the system
- [[Environment]] — All backend env vars
