---
title: Cloud Functions
type: subsystem
tags: [functions, firebase, cloud-functions, serverless]
path: functions/
deploys_to: Firebase Functions (us-central1)
---

# Cloud Functions

> Firebase Cloud Functions (v2) handling server-side operations: API key management, file uploads, Google Sheets sync, and rate limiting.

---

## Tech

| Tool | Purpose |
|------|---------|
| Firebase Functions v2 | Serverless runtime |
| Firebase Admin SDK | Firestore + Auth admin access |
| busboy | Multipart file upload parsing |
| csv-parse | CSV file parsing |
| xlsx | Excel file parsing |
| googleapis | Google Sheets API |

---

## File Map

```
functions/
├── index.js            # All function exports (entry point)
├── lib/
│   └── googleSheets.js # Google Sheets helpers
├── test-api-key.js     # Manual test script
├── .eslintrc.js        # Linting config
├── .gitignore
├── .env                # Runtime secrets
├── package.json
└── package-lock.json
```

---

## Exported Functions

| Function | Trigger | Purpose |
|----------|---------|---------|
| `api` | `onRequest` | Express-style HTTP handler for `/api/**` routes |
| Key generation | `onCall` | Generate `nxk_live_*` API keys |
| Key validation | `onCall` | Verify API keys against Firestore |
| File upload | `onRequest` | Parse CSV/XLSX → Firestore |
| Sheets sync | `onCall` | Push/pull data to Google Sheets |

---

## Global Config

```javascript
setGlobalOptions({ region: "us-central1", maxInstances: 10 });
```
- Region: `us-central1` (same as Cloud Run backend)
- Max 10 concurrent containers (cost control)

---

## API Key Format

```
nxk_live_ + 24 random bytes (hex)
```
Stored in Firestore `/apiKeys/{keyId}` — no client access (see [[Firestore-Rules]]).

---

## Deployment

```bash
firebase deploy --only functions
```

Or deploy a single function:
```bash
firebase deploy --only functions:api
```

---

## Environment

Functions use `.env` in the `functions/` directory (auto-loaded by Firebase Functions v2).

See [[Environment]] for variables.

---

## Related

- [[Backend]] — Similar role but runs on Cloud Run (always-on)
- [[Firestore-Rules]] — Functions bypass rules via Admin SDK
- [[Architecture]] — Where functions fit in the system
- [[Deployment]] — Full deploy instructions
