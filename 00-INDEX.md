---
title: NodalX — Project Index
type: MOC
tags: [index, moc, nodalxai]
---

# NodalX — Project Map of Content

> AI-powered customer intelligence platform. Classifies inbound inquiries, surfaces insights, and automates follow-up workflows.

---

## Architecture

- [[Architecture]] — System overview, data flow, how services connect
- [[Tech-Stack]] — All technologies, versions, and why each is used

---

## Subsystems

| Module          | Path         | Deploys To         | Note          |
| --------------- | ------------ | ------------------ | ------------- |
| Frontend        |              | Vercel             | [[Frontend]]  |
| Backend         | `backend/`   | Cloud Run          | [[Backend]]   |
| Cloud Functions | `functions/` | Firebase Functions | [[Functions]] |
| Apps Script     | `appscript/` | Google Apps Script | [[Appscript]] |

---

## Infrastructure & Config

- [[Deployment]] — How to deploy each service
- [[Environment]] — All environment variables across services
- [[Firestore-Rules]] — Security rules explained
- [[Firebase-Config]] — firebase.json, .firebaserc, indexes

---

## Key Files (quick reference)

| File | Purpose |
|------|---------|
| `vercel.json` | Vercel deployment config (Vite SPA) |
| `firebase.json` | Firebase hosting, functions, emulators |
| `firestore.rules` | Firestore security rules |
| `firestore.indexes.json` | Composite indexes |
| `.firebaserc` | Firebase project alias |
| `package.json` | Root workspace (dev scripts only) |

---

## Folder Legend

```
NODALXAI/
├── frontend/        → [[Frontend]]
├── backend/         → [[Backend]]
├── functions/       → [[Functions]]
├── appscript/       → [[Appscript]]
├── docs/            → All vault notes live here
├── _archive/        → Deprecated files (safe to ignore)
└── .obsidian/       → Vault config
```

---

## Status & Decisions

- [[Decisions]] — Key architectural decisions and why
- [[TODO]] — Active tasks and next steps
