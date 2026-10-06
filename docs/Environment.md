---
title: Environment Variables
type: reference
tags: [env, secrets, config, environment]
aliases: [env-vars, secrets, configuration]
---

# Environment Variables

## Frontend (`frontend/.env`)

All must be prefixed with `VITE_` for Vite to expose them to the client bundle.

| Variable | Value | Notes |
|----------|-------|-------|
| `VITE_FIREBASE_API_KEY` | `<from Firebase console>` | Firebase client key (public) |
| `VITE_FIREBASE_AUTH_DOMAIN` | `nodalxai-b9eb5.firebaseapp.com` | |
| `VITE_FIREBASE_PROJECT_ID` | `nodalxai-b9eb5` | |
| `VITE_FIREBASE_STORAGE_BUCKET` | `nodalxai-b9eb5.firebasestorage.app` | |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `282855451102` | |
| `VITE_FIREBASE_APP_ID` | `1:282855451102:web:bcc0fe6d2bf769b6b2154f` | |
| `VITE_FIREBASE_MEASUREMENT_ID` | `G-7BS7QT9M3S` | Analytics |
| `VITE_API_BASE_URL` | empty | Uses same-origin `/api` Firebase Hosting rewrite; local Vite proxies `/api` |
| `VITE_APP_HOST` | `https://nodalx.in` | Public site URL after domain verification |
| `VITE_APPSCRIPT_WEBHOOK_URL` | `https://script.google.com/macros/s/AKfycbx.../exec` | [[Appscript]] URL |

### Where to set
- **Local dev**: `frontend/.env` or `frontend/.env.local`
- **Production**: Configure in the Firebase Hosting build environment before running `npm --prefix frontend run build`
- Access in code: `import.meta.env.VITE_FIREBASE_API_KEY`

---

## Backend (`backend/.env`)

| Variable | Value | Notes |
|----------|-------|-------|
| `PORT` | `5001` | Local dev port |
| `GOOGLE_CLOUD_PROJECT_ID` | `nodalxai-b9eb5` | GCP project |
| `GOOGLE_CLOUD_REGION` | `us-central1` | Vertex AI region |
| `GOOGLE_APPLICATION_CREDENTIALS` | `./client_secret.json` | Service account (NEVER commit) |

### Where to set
- **Local dev**: `backend/.env` (gitignored)
- **Production**: Cloud Run environment variables

---

## Functions (`functions/.env`)

| Variable | Notes |
|----------|-------|
| Firebase Admin auto-initializes from project context | No explicit credentials needed |
| Custom vars as needed | Set via `firebase functions:config:set` or `.env` |

### Where to set
- **Local dev**: `functions/.env`
- **Production**: Auto-loaded by Firebase Functions v2 runtime

---

## Sensitive Files (NEVER commit)

| File | Contains | Gitignored |
|------|----------|-----------|
| `backend/client_secret.json` | Google OAuth service account | Yes |
| `*-service-account.json` | Firebase Admin keys | Yes |
| `*-firebase-adminsdk-*.json` | Firebase Admin keys | Yes |
| `.env` (any) | Runtime secrets | Yes |

---

## Related

- [[Deployment]] — Where to set vars on each platform
- [[Frontend]] — How frontend accesses env vars
- [[Backend]] — Backend env setup
