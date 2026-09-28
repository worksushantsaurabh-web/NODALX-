---
title: Firebase Config
type: reference
tags: [firebase, config, hosting, emulators]
---

# Firebase Configuration

## Project

| Field | Value |
|-------|-------|
| Project ID | `nodalxai-b9eb5` |
| Region | `us-central1` |
| Config file | `.firebaserc` |

---

## firebase.json

Controls hosting, functions, firestore, and emulators.

### Hosting
```json
{
  "public": "frontend/dist",
  "rewrites": [
    { "source": "/api/**", "function": "api" },
    { "source": "**", "destination": "/index.html" }
  ]
}
```
- `/api/**` routes to [[Functions]] `api` export
- Everything else → SPA fallback
- Firebase Hosting serves the public web app; see [[Deployment]] and [[Domain-Setup]].

### Functions
```json
{
  "source": "functions",
  "codebase": "default",
  "disallowLegacyRuntimeConfig": true
}
```

### Emulators
```json
{
  "auth": { "port": 9099 },
  "firestore": { "port": 8080 },
  "ui": { "enabled": true, "port": 4000 }
}
```

Start emulators:
```bash
firebase emulators:start
```

---

## Firestore Indexes

File: `firestore.indexes.json`

Composite indexes are defined in `firestore.indexes.json`. Deploy changes as needed:
```bash
firebase deploy --only firestore:indexes
```

---

## Related

- [[Firestore-Rules]] — Security rules
- [[Functions]] — Cloud Functions config
- [[Deployment]] — Deploy commands
