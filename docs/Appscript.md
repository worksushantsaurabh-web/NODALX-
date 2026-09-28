---
title: Apps Script
type: subsystem
tags: [appscript, google-apps-script, webhook, inquiry, classification]
path: appscript/
deploys_to: Google Apps Script (Web App)
---

# Apps Script

> Google Apps Script web app that replaces the old n8n workflow. Receives inquiry form submissions, classifies them using keyword rules, and stores results in Google Sheets.

---

## What It Does

1. **Receives** POST webhooks from [[Frontend]] `InquiryForm.tsx`
2. **Classifies** inquiry by intent, urgency, fit score, category
3. **Stores** in Google Sheets (free, no database needed)
4. **Serves** data back to dashboard via GET endpoints

---

## File Map

```
appscript/
├── Code.gs                   # Main Apps Script (deploy this)
├── InquiryPipeline.gs        # Enhanced version with Gemini AI
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

Live URL: see `VITE_APPSCRIPT_WEBHOOK_URL` in [[Environment]]

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

1. Paste `Code.gs` into [script.google.com](https://script.google.com)
2. Run `setupSheet()` once
3. Deploy as Web App (Execute as: Me, Access: Anyone)
4. Copy URL → set as `VITE_APPSCRIPT_WEBHOOK_URL`

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
