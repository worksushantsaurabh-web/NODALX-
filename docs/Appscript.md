---
title: Apps Script
type: subsystem
tags: [appscript, google-apps-script, webhook, inquiry, classification]
path: appscript/
deploys_to: Google Apps Script (Web App)
---

# Apps Script

> Google Apps Script web app for inquiry intake. The canonical source is `appscript/nodalx-intake.gs`; the other script examples are older alternatives.

---

## What It Does

1. **Receives** POST webhooks from the server-side Vercel `/api/contact` route
2. **Classifies** inquiry by intent, urgency, fit score, category
3. **Stores** in Google Sheets (free, no database needed)
4. **Serves** protected data through GET endpoints; the current dashboard has not been reconnected to this data source

---

## File Map

```
appscript/
├── nodalx-intake.gs          # Canonical Apps Script (deploy this alone)
├── Code.gs                   # Older alternative
├── InquiryPipeline.gs        # Older Gemini alternative
├── InquiryForm.tsx           # Reference: React form component
├── dashboard-integration.tsx # Reference: Dashboard fetch code
├── frontend-integration.tsx  # Reference: Full frontend example
├── README.md                 # Detailed setup + API docs
└── SETUP.md                  # Quick 5-minute deploy guide
```

---

## API Endpoints

| Method | URL | Purpose |
|--------|-----|---------|
| `POST` | `{WEBAPP_URL}` | Submit new inquiry |
| `GET` | `{WEBAPP_URL}?action=list` | List all inquiries |
| `GET` | `{WEBAPP_URL}?action=stats` | Aggregated statistics |

Keep the live `/exec` URL in the server-side `APPS_SCRIPT_WEB_APP_URL` variable. The repository does not contain the deployed URL.

---

## Classification Logic

Embedded keyword matching (zero API cost):

| Keywords | Result |
|----------|--------|
| buy, quote, pricing, budget | `intent: purchase` |
| partner, collaborate, reseller | `intent: partnership` |
| asap, urgent, immediately | `urgency: high` |
| enterprise, fortune 500, global | `category: enterprise` |

Fit score: 1-10 (calculated from intent + category + urgency signals)

---

## Deployment

1. Paste `nodalx-intake.gs` into [script.google.com](https://script.google.com)
2. Set Script Properties `INTAKE_SECRET` and `SHEET_ID`, then run `setupSheetHeaders()` once
3. Deploy as Web App (Execute as: Me, Access: Anyone)
4. Set the URL and secret as server-side Vercel environment variables `APPS_SCRIPT_WEB_APP_URL` and `APPS_SCRIPT_INTAKE_SECRET`

See `appscript/SETUP.md` for full instructions.

---

## Cost

| Service | Monthly |
|---------|---------|
| Apps Script | $0 |
| Google Sheets | $0 |
| Gemini (if using InquiryPipeline.gs) | $0 (free tier: 1500 req/day) |

Replaces n8n Cloud ($20-50/mo) + Airtable ($20/mo).

---

## Related

- [[Frontend]] — `InquiryForm.tsx` posts here
- [[Architecture]] — Data flow from form to storage
- [[Environment]] — Webhook URL variable
- [[Decisions]] — Why we moved from n8n to Apps Script
