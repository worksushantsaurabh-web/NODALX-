---
title: Deployment
type: reference
tags: [deployment, cloud-run, firebase, cicd]
aliases: [deploy, how-to-deploy]
---

# Deployment

## Overview

| Service | Platform | Trigger | URL |
|---------|----------|---------|-----|
| [[Frontend]] | Firebase Hosting | `firebase deploy --only hosting` | `https://nodalxai-b9eb5.firebaseapp.com` (custom domain: `nodalx.in` after DNS verification) |
| [[Backend]] | Cloud Run | Manual / gcloud | `https://api-iw12dxqnoa-uc.a.run.app` |
| [[Functions]] | Firebase | `firebase deploy` | Auto-generated |
| [[Appscript]] | Google | Manual redeploy | See [[Environment]] |

---

## Frontend (Firebase Hosting)

`nodalx.in` is currently served by Vercel. Note that the GCP project is suspended, causing API proxies to fail. For the planned Vercel move, use [[Vercel-Migration]]; changing Hosting does not fix the disabled Firebase API.

### Deploy
```bash
npm --prefix frontend run build
firebase deploy --only hosting --project nodalxai-b9eb5
```

### Config
`firebase.json` serves `frontend/dist`, routes `/api/**` to the Firebase `api` function, and falls back to `index.html` for the SPA. See [[Domain-Setup]] for GoDaddy DNS and custom-domain verification.

### Environment
Set frontend variables in `frontend/.env` or the build environment. Vite bakes them at build time — rebuild and redeploy after any change.
See [[Environment]] for full list.

---

## Backend (Cloud Run)

### Deploy
```bash
cd backend
gcloud run deploy nodalxai-api \
  --source . \
  --region us-central1 \
  --allow-unauthenticated
```

### Environment
Set via Cloud Run console or:
```bash
gcloud run services update nodalxai-api \
  --set-env-vars KEY=VALUE
```

---

## Cloud Functions (Firebase)

### Deploy all
```bash
firebase deploy --only functions
```

### Deploy single function
```bash
firebase deploy --only functions:api
```

### Deploy rules + indexes
```bash
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

---

## Apps Script

1. Edit at [script.google.com](https://script.google.com)
2. Deploy → Manage Deployments → Edit → **New Version**
3. URL stays the same

---


## Pre-deploy Checklist

- [ ] All [[Environment]] vars set on target platform
- [ ] `npm run build` succeeds locally (frontend)
- [ ] [[Firestore-Rules]] reviewed if changed
- [ ] No `client_secret.json` or `.env` in git (`git status` clean)

---

## Related

- [[Environment]] — What vars each platform needs
- [[Architecture]] — Service topology
- [[Frontend]] / [[Backend]] / [[Functions]] / [[Appscript]] — Individual service docs
