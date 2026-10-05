# NodalX Apps Script Setup (Replaces n8n)

## What You Get

| Feature | How It Works |
|---------|-------------|
| **Webhook** | Apps Script `doPost()` receives form submissions |
| **Classification** | **Embedded text rules** — keyword matching (zero API calls) |
| **Storage** | Google Sheets (free, no Airtable needed) |
| **Owner-only data API** | Secret-protected `doGet()`; not a multi-tenant dashboard API |
| **Limits** | Subject to Google account, execution and email quotas; no unlimited/free guarantee |

---

## Deploy and verify

See `../docs/runbooks/aws-migration.md` for the hosting/configuration audit and
AWS plan. The audited domain returns “Site Not Found”; configuring Apps Script
alone cannot repair a domain pointing at the wrong hosting destination.

### 1. Create Apps Script Project
- Go to [script.google.com](https://script.google.com)
- **New Project**
- Delete the default `myFunction()`
- Paste the entire contents of **`nodalx-intake.gs`**. The other `.gs` files are older alternatives and must not be pasted into the same project because they define the same entry points.

### 2. Set the Intake Secret (required)

Both `doGet` and `doPost` return customer contact details, so the deployed
endpoint is guarded by a shared secret. **Do this before deploying.**

- **Project Settings → Script Properties → Add script property**
- Property: `INTAKE_SECRET`
- Value: any long random string, e.g. `openssl rand -hex 32`
- Property: `SHEET_ID`
- Value: the ID between `/d/` and `/edit` in your inquiry spreadsheet URL
- Do not share either value in source, chats or screenshots.

Apps Script web app requests must supply it as a query parameter. The server-side proxy adds this parameter; browsers never see it:
```
?secret=<value>              # query param
```

If `INTAKE_SECRET` is unset, every request is rejected. The check fails
closed on purpose: an unconfigured deployment must never accept traffic.

> ⚠️ If you deployed before setting this, your web app URL is the only thing
> protecting the spreadsheet. A previous deployment URL was published in a
> public git repository, so treat that URL as compromised and delete the
> deployment before creating a new one.

### 3. Run Setup Once
- In the editor dropdown, select `setupSheetHeaders`
- Click **Run** (▶️)
- Grant permissions when prompted
- Check **Execution log** for the Sheet URL
- Back up the sheet privately first. The first tab must have the canonical first
  16 headings. This version adds `Service` and `Payload Hash` without changing
  those original columns; stop and review if the extension columns have data.
- Run `healthCheck` and confirm the secret, sheet configuration and access.

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
> **Never commit the web app URL.** Keep it and the intake secret in server-side
> deployment environment variables, never in `frontend/.env` or a `VITE_` variable.

### 5. Configure the Vercel contact route

Confirm the correct project serves your domain. The locally linked project is
`nodalx-frontend`; both variables were absent from its production environment
on 4 October. Set these **server-side Vercel environment variables** there:

```text
APPS_SCRIPT_WEB_APP_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
APPS_SCRIPT_INTAKE_SECRET=<the same INTAKE_SECRET from Script Properties>
```

Redeploy the Vercel project. The site form posts to `/api/contact`, whose Vercel function forwards the inquiry to Apps Script and returns success only after Apps Script confirms a sheet row. Never put the secret in a `VITE_` variable or call the protected Apps Script URL directly from browser code. Add rate limiting for `/api/contact` in your Vercel WAF settings before opening the public form to traffic.

This restores **form intake**. The current Inquiry Desk and Overview still read Firebase, so they will not show Apps Script rows until a secured dashboard read connector is configured. Existing sheet rows remain in Google Sheets.

---

## API Endpoints

### Read-only provider health

After setting the two server variables in an ignored root `.env.local`:

```sh
node --env-file=.env.local scripts/check-intake.mjs --upstream-health
```

This uses the protected `action=health` endpoint without writing customer data.
Do not put secrets in shell arguments or query URLs in logs. The upstream uses
a secret query parameter for Apps Script compatibility; never expose it to the
browser. A health success verifies access, not a complete submission.

### POST — Submit Inquiry through the public proxy

Only after owner approval: this writes a row and can send confirmation email.
Replace the placeholder origin with the verified deployment. Use an inbox you
control; keep the same key and identical data for retries.

```sh
curl -X POST "https://YOUR_VERIFIED_SITE/api/contact" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: owner-test-001" \
  -d '{
    "name": "Jane Doe",
    "email": "YOUR_CONTROLLED_TEST_INBOX",
    "company": "Acme Corp",
    "phone": "+1 555-0000",
    "industry": "SaaS",
    "service": "Import processing",
    "message": "Owner-approved intake verification."
  }'
```

**Public proxy response:** HTTP 202 only after a confirmed Sheet row. The
classification is rule-based, not an external AI result.
```json
{
  "accepted": true,
  "id": "owner-test-001",
  "duplicate": false,
  "processingStatus": "classified",
  "requestId": "correlation-id"
}
```

An unchanged retry returns `duplicate: true` and does not append another row or
send another notification. Reusing the key for different data returns HTTP 409.
This requires deployment of the new Apps Script code, not just the proxy.

### GET — Owner-only list and stats

`action=list` and `action=stats` remain protected server-only operations. They
cover the entire configured sheet. Do not expose them as a general signed-in
user's dashboard connector: they lack per-workspace authorization.

### Requests without the secret
```json
{ "success": false, "message": "Unauthorized" }
```

---

## Classification Logic (Embedded Rules)

No API calls. The script scans the inquiry text for keywords:

These are heuristic labels/suggestions, not measured qualification accuracy or
automatic follow-up. Storage acceptance does not confirm email delivery. Google
imposes [Apps Script and email quotas](https://developers.google.com/apps-script/guides/services/quotas).

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
| `nodalx-intake.gs` | Canonical Apps Script backend (deploy this file alone) |
| `frontend/components/InquiryForm.tsx` | Live React form; posts to `/api/contact` |
| `SETUP.md` | This file |

---

## Updating Your Dashboard to Read from Apps Script

The current dashboard uses the Firebase inquiry API. Do not fetch the protected
Apps Script URL from `Dashboard.tsx`: browser bundles expose values from `VITE_`
variables, and `doGet?action=list` returns customer contact details. A dashboard
connector must verify the signed-in user's authorization on the server, then call
the Apps Script list endpoint with the server-side secret and return only the
inquiries that user is allowed to see. Until that connector exists, use the
Google Sheet to review inquiries submitted through Apps Script.

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
