---
title: Tech Stack
type: reference
tags: [tech-stack, dependencies, tools, versions]
aliases: [stack, technologies]
---

# Tech Stack

---

## Frontend ([[Frontend]])

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | React | 19.x (latest) |
| Build | Vite | latest |
| Language | TypeScript | latest |
| Routing | React Router | 7.x |
| Styling | Tailwind CSS | 3.x |
| Icons | Lucide React | latest |
| Auth | Firebase Auth SDK | 11.x |
| Database | Firestore SDK | 11.x |
| Hosting | Vercel | — |

---

## Backend ([[Backend]])

| Layer | Technology | Version |
|-------|-----------|---------|
| Runtime | Node.js | 22 |
| Framework | Express | 5.x |
| Auth | Firebase Admin SDK | 13.x |
| AI | Vertex AI (via proxy) | — |
| Sheets | googleapis | 140.x |
| WebSocket | ws | 8.x |
| Rate Limit | express-rate-limit | 7.x |
| Hosting | Google Cloud Run | — |

---

## Cloud Functions ([[Functions]])

| Layer | Technology | Version |
|-------|-----------|---------|
| Runtime | Node.js | 22 |
| Framework | Firebase Functions | v2 (6.x) |
| Admin | Firebase Admin | 13.x |
| File Parse | busboy + csv-parse + xlsx | — |
| Sheets | googleapis | 173.x |
| Hosting | Firebase Functions | us-central1 |

---

## Apps Script ([[Appscript]])

| Layer | Technology |
|-------|-----------|
| Runtime | Google Apps Script (V8) |
| AI | Gemini API (optional) |
| Storage | Google Sheets |
| Hosting | Google Web App |

---

## Infrastructure

| Service | Provider | Purpose |
|---------|----------|---------|
| Auth | Firebase Auth | User sign-up/login (Google, Email) |
| Database | Cloud Firestore | Primary data store |
| Storage | Firebase Storage | File uploads |
| Hosting (FE) | Vercel | Frontend CDN + builds |
| Hosting (BE) | Cloud Run | Backend API |
| Serverless | Firebase Functions | Event-driven compute |
| AI | Vertex AI (Gemini) | Text generation, classification |
| Webhooks | Google Apps Script | Inquiry pipeline |
| Sheets | Google Sheets | Inquiry storage (free) |

---

## Dev Tools

| Tool | Purpose |
|------|---------|
| npm | Package manager |
| concurrently | Run frontend + backend together |
| nodemon | Backend hot-reload |
| Firebase Emulators | Local auth + firestore |
| Vite dev server | Frontend HMR + proxy |

---

## Related

- [[Architecture]] — How these pieces connect
- [[Deployment]] — Where each deploys
- [[Environment]] — Config per service
