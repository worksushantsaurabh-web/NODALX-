# NodalX Apps Script Setup (Replaces n8n)

## What You Get

| Feature | How It Works |
|---------|-------------|
| **Webhook** | Apps Script `doPost()` receives form submissions |
| **Classification** | **Embedded text rules** — keyword matching (zero API calls) |
| **Storage** | Google Sheets (free, no Airtable needed) |
| **Dashboard API** | Apps Script `doGet()` serves inquiry data as JSON |
| **Cost** | **$0** |

---

## Deploy in 5 Minutes

### 1. Create Apps Script Project
- Go to [script.google.com](https://script.google.com)
- **New Project**
- Delete the default `myFunction()`
- Paste the entire contents of **`Code.gs`**

### 2. Set the Intake Secret (required)

Both `doGet` and `doPost` return customer contact details, so the deployed
endpoint is guarded by a shared secret. **Do this before deploying.**

- **Project Settings → Script Properties → Add script property**
- Property: `INTAKE_SECRET`
- Value: any long random string, e.g. `openssl rand -hex 32`

Callers must then send it as either a header or a query parameter:
```
x-nodalx-secret: <value>     # header, for server-to-server
?secret=<value>              # query param
```

If `INTAKE_SECRET` is unset, every request is rejected. The check fails
closed on purpose: an unconfigured deployment must never accept traffic.

> ⚠️ If you deployed before setting this, your web app URL is the only thing
> protecting the spreadsheet. A previous deployment URL was published in a
> public git repository, so treat that URL as compromised and delete the
> deployment before creating a new one.

### 3. Run Setup Once
- In the editor dropdown, select `setupSheet`
- Click **Run** (▶️)
- Grant permissions when prompted
- Check **Execution log** for the Sheet URL

### 4. Deploy as Web App
- Click **Deploy → New Deployment**
- Click gear ⚙️ → **Web App**
- Configure:
  - **Execute as:** Me
  - **Who has access:** Anyone
- Click **Deploy**
- **Copy the Web App URL**

> ⚠️ **Important:** After any code change, redeploy (Manage Deployments → Edit → New Version).
>
> **Never commit the web app URL.** It is a bearer credential for your customer
> data. Keep it in `frontend/.env` (git-ignored) or in Firebase Functions
> environment config.

### 5. Add URL to Your Frontend

Create/edit `frontend/.env`:
```bash
VITE_APPSCRIPT_WEBHOOK_URL=https://script.google.com/macros/s/AKfycb.../exec
```

Then copy `InquiryForm.tsx` into your frontend components folder and import it where needed.

---

## API Endpoints

### POST — Submit Inquiry
```bash
curl -X POST "YOUR_APPSCRIPT_URL" \
  -H "Content-Type: application/json" \
  -H "x-nodalx-secret: YOUR_INTAKE_SECRET" \
  -d '{
    "name": "Jane Doe",
    "email": "jane@company.com",
    "company": "Acme Corp",
    "phone": "+1 555-0000",
    "industry": "SaaS",
    "message": "We need to buy your AI automation solution ASAP.",
    "source": "https://nodalx.in/contact"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Inquiry received and classified!",
  "classification": {
    "intent": "purchase",
    "urgency": "high",
    "fit_score": 10,
    "summary": "Acme Corp (SaaS) is evaluating a purchase.",
    "suggested_action": "Schedule executive demo within 24 hours. Prepare enterprise pricing deck.",
    "category": "enterprise"
  },
  "rowId": "550e8400-e29b-41d4-a716-446655440000"
}
```

### GET — List Inquiries (for Dashboard)
```bash
curl "YOUR_APPSCRIPT_URL?action=list&secret=YOUR_INTAKE_SECRET"
```

### GET — Stats
```bash
curl "YOUR_APPSCRIPT_URL?action=stats&secret=YOUR_INTAKE_SECRET"
```

### Requests without the secret
```json
{ "success": false, "message": "Unauthorized" }
```

---

## Classification Logic (Embedded Rules)

No API calls. The script scans the inquiry text for keywords:

| Detected Words | Result |
|----------------|--------|
| buy, quote, pricing, budget, invest | `intent: purchase` |
| partner, collaborate, reseller | `intent: partnership` |
| support, help, bug, fix | `intent: support` |
| viagra, crypto, lottery, free money | `intent: spam` |
| asap, urgent, immediately, deadline | `urgency: high` |
| enterprise, fortune 500, global, 1000+ | `category: enterprise` |
| startup, small business, sme | `category: smb` |
| freelancer, solo, individual | `category: individual` |

**Fit Score** is calculated automatically:
- Purchase (+3), Partnership (+2), Support (+1), Spam (1)
- Enterprise (+3), SMB (+2), Individual (+1)
- High urgency (+2), Medium (+1)
- Range: 1-10

---

## Files

| File | Purpose |
|------|---------|
| `Code.gs` | Apps Script backend (deploy to Google) |
| `InquiryForm.tsx` | React form component (drop into your frontend) |
| `SETUP.md` | This file |

---

## Updating Your Dashboard to Read from Apps Script

In your `Dashboard.tsx`, replace the `/api/customers` fetch with:

```tsx
const APPSCRIPT_URL = import.meta.env.VITE_APPSCRIPT_WEBHOOK_URL;

// Fetch inquiries
const response = await fetch(`${APPSCRIPT_URL}?action=list`);
const data = await response.json();
const inquiries = data.customers; // Array of inquiry objects

// Fetch stats
const statsRes = await fetch(`${APPSCRIPT_URL}?action=stats`);
const statsData = await statsRes.json();
const stats = statsData.stats;
```

The inquiry object shape matches what your dashboard already expects:
```ts
{
  id: string;
  name: string;
  email: string;
  company: string;
  industry: string;
  intent: string;
  urgency: string;
  fit_score: number;
  summary: string;
  suggested_action: string;
  category: string;
  status: string;
  last_active: string;
}
```
