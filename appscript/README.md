# NODALxAI — Apps Script Inquiry Pipeline

Replace your n8n subscription with a **free Google Apps Script** that handles inquiry classification using Gemini AI and stores data in Google Sheets.

---

## What Was n8n Doing?

Your n8n workflow handled:
1. **Webhook trigger** — Received `POST` inquiries from your website
2. **Gemini AI classification** — Classified intent, urgency, fit score, summary, suggested action, category
3. **Airtable storage** — Saved classified inquiries to Airtable
4. **GET endpoint** — Served inquiry data to your dashboard

---

## What Apps Script Will Do

| Feature | n8n (Old) | Apps Script (New) |
|---------|-----------|-------------------|
| Webhook endpoint | ✅ | ✅ |
| AI Classification (Gemini) | ✅ | ✅ |
| Data Storage | Airtable | **Google Sheets (Free)** |
| Dashboard API | ✅ | ✅ |
| Monthly Cost | **$20-50** | **$0** |

---

## Step-by-Step Setup

### Step 1: Get a Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Click **"Create API Key"**
3. Copy the key (looks like `AIzaSy...`)

---

### Step 2: Create the Apps Script Project

1. Go to [script.google.com](https://script.google.com)
2. Click **"New Project"**
3. Delete the default `myFunction()` code
4. Copy and paste the entire contents of `InquiryPipeline.gs` into the editor
5. **Replace** `YOUR_GEMINI_API_KEY_HERE` with your actual API key:
   ```javascript
   GEMINI_API_KEY: 'AIzaSyYourActualKeyHere',
   ```

---

### Step 3: Run Setup

1. In the Apps Script editor, select the function `setupSheet` in the dropdown
2. Click **Run** (▶️)
3. Grant permissions when prompted (click through the warnings)
4. Check the **Execution log** — it will show the Google Sheet URL

---

### Step 4: Deploy as Web App

1. Click **Deploy** → **New Deployment**
2. Click the gear icon (⚙️) next to "Select type" → Choose **Web App**
3. Configure:
   - **Description**: `NODALxAI Inquiry Pipeline v1`
   - **Execute as**: Me
   - **Who has access**: Anyone
4. Click **Deploy**
5. Copy the **Web App URL** (looks like `https://script.google.com/macros/s/AKfycb.../exec`)

> ⚠️ **Important**: Every time you edit the code, you must **redeploy** (Manage deployments → Edit → New version) for changes to take effect.

---

### Step 5: Update Your Frontend

Add this environment variable to your frontend `.env`:

```bash
VITE_APPSCRIPT_WEBHOOK_URL=https://script.google.com/macros/s/AKfycb.../exec
```

Then update your `InquiryForm.tsx` to call the Apps Script URL (see `frontend-integration.tsx` for the full code).

---

## API Reference

### POST — Submit Inquiry

```bash
curl -X POST "YOUR_APPSCRIPT_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jane Doe",
    "email": "jane@company.com",
    "phone": "+1 555-0000",
    "company": "Acme Corp",
    "industry": "technology",
    "service": "ai-automation",
    "message": "We need help automating our lead qualification."
  }'
```

**Response:**
```json
{
  "success": true,
  "status": "classified",
  "inquiry": {
    "name": "Jane Doe",
    "email": "jane@company.com",
    "company": "Acme Corp"
  },
  "classification": {
    "intent": "purchase",
    "urgency": "high",
    "fit_score": 9,
    "summary": "Tech company seeking lead qualification automation",
    "suggested_action": "Schedule demo within 24 hours",
    "category": "enterprise"
  },
  "stored": true,
  "rowId": "550e8400-e29b-41d4-a716-446655440000"
}
```

---

### GET — List All Inquiries

```bash
curl "YOUR_APPSCRIPT_URL?action=list"
```

**Response:**
```json
{
  "success": true,
  "count": 42,
  "customers": [
    {
      "id": "550e8400-...",
      "name": "Jane Doe",
      "email": "jane@company.com",
      "company": "Acme Corp",
      "intent": "purchase",
      "urgency": "high",
      "fit_score": 9,
      "summary": "...",
      "status": "New",
      "last_active": "2025-01-15T10:30:00.000Z"
    }
  ]
}
```

---

### GET — Statistics

```bash
curl "YOUR_APPSCRIPT_URL?action=stats"
```

**Response:**
```json
{
  "success": true,
  "stats": {
    "total": 42,
    "byIntent": { "purchase": 20, "partnership": 5, "support": 10, "general": 7 },
    "byUrgency": { "high": 15, "medium": 20, "low": 7 },
    "byCategory": { "enterprise": 10, "smb": 25, "individual": 7 },
    "avgFitScore": "7.2"
  }
}
```

---

## Architecture

```
┌─────────────┐     POST inquiry     ┌─────────────────────┐
│   Website   │ ───────────────────→ │  Google Apps Script │
│   Frontend  │                      │  (Webhook + Gemini) │
└─────────────┘                      └──────────┬──────────┘
     ↑                                          │
     │  Classification JSON                     │ Store
     └──────────────────────────────────────────┘
                                                ↓
                                       ┌─────────────────┐
                                       │  Google Sheets  │
                                       │ (Free Storage)  │
                                       └─────────────────┘
```

---

## Alternative: Keep Using Your Node Backend

Since your Node.js backend already has:
- Firebase/Firestore setup
- Vertex AI proxy configured
- `/api/inquiries` and `/api/customers` endpoints

You could instead add the AI classification **directly in your backend** without any external service:

```javascript
// In your backend/server.js, enhance /api/inquiries:
app.post('/api/inquiries', async (req, res) => {
  // 1. Save to Firestore (existing)
  // 2. Call Gemini via your Vertex AI proxy
  // 3. Update the Firestore doc with classification
  // 4. Return classification to frontend
});
```

This would be **zero additional infrastructure** and keep everything in one place.

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Authorization required" when running setup | Click through all permission dialogs. If stuck, go to [myaccount.google.com/permissions](https://myaccount.google.com/permissions) and remove the app, then try again. |
| CORS errors in browser | Make sure `ALLOWED_ORIGIN` matches your frontend URL. Use `'*'` for testing. |
| "Invalid API key" | Double-check your Gemini API key at [aistudio.google.com](https://aistudio.google.com/app/apikey) |
| Changes not reflecting | Redeploy the web app after every code change! |
| Sheet not found | Run `setupSheet()` manually from the editor first. |

---

## Cost Comparison

| Service | Monthly Cost |
|---------|-------------|
| n8n Cloud (Starter) | ~$20-50 |
| Airtable (Pro) | ~$20 |
| **Apps Script + Sheets + Gemini** | **$0** (within free tier) |

Gemini API free tier: 1,500 requests/day  
Apps Script free tier: generous daily limits  
Google Sheets: completely free

---

## Files in This Folder

| File | Description |
|------|-------------|
| `InquiryPipeline.gs` | Main Apps Script code |
| `README.md` | This file — setup instructions |
| `frontend-integration.tsx` | Example React component for your frontend |
