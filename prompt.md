# NODALxAI — Apps Script Fix + AWS Migration Prompt

Paste this entire prompt into a new ChatGPT session when you're ready to execute.

---

## CONTEXT

NODALxAI is a small-business inquiry intake desk. The current stack:
- Frontend: React + TypeScript + Vite + Tailwind (`frontend/`)
- Auth: Firebase Auth
- DB: Cloud Firestore
- Functions: Firebase Functions (`functions/`)
- Intake connector: Vercel edge route `api/contact.mjs` → Google Apps Script web app
- Firebase project `nodalxai-b9eb5` — **billing suspended**, Functions returns 503

The user wants to:
1. Fix the broken inquiry intake (Apps Script not receiving data)
2. Migrate off Firebase entirely to AWS

---

## PART 1 — FIX INQUIRY INTAKE (Apps Script)

### What's broken
`api/contact.mjs` returns 503 because `APPS_SCRIPT_WEB_APP_URL` and `APPS_SCRIPT_INTAKE_SECRET` are not set in the Vercel/Firebase environment.

### What to verify in Apps Script editor
1. Project Settings → Script Properties:
   - `INTAKE_SECRET` — a random string (e.g., `openssl rand -hex 32`)
   - `SHEET_ID` — the 44-char Google Sheet ID
2. Deploy → New Deployment → Web App:
   - Execute as: Me
   - Who has access: Anyone
   - Copy the `/macros/s/.../exec` URL
3. Run `healthCheck()` from the editor — should show both secrets set and sheet accessible

### What to set in Vercel environment
```
APPS_SCRIPT_WEB_APP_URL=https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec
APPS_SCRIPT_INTAKE_SECRET=<the_same_secret_from_step_1>
```

Then redeploy Vercel. The `api/contact.mjs` route will proxy POST requests to Apps Script with the secret in the query string. No Firebase Functions needed.

### Test after deploy
```bash
curl -X POST "https://YOUR_WEB_APP_URL?secret=YOUR_INTAKE_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@test.com","company":"Test","message":"hello"}'
```
Expected: `{"success":true,"message":"Inquiry received and classified!","rowId":"..."}`

---

## PART 2 — AWS MIGRATION PLAN

Replace Firebase entirely with AWS services. Here's the target architecture:

### Auth → Amazon Cognito
- User pool for email/password + Google OAuth sign-in
- Frontend uses Amplify Auth or direct Cognito JWT
- Replaces Firebase Auth

### Database → DynamoDB
- `inquiries` table with `id` (PK), `customerId` (SK), GSI on `createdAt`
- Replace all Firestore reads/writes in `functions/index.js` with AWS SDK v3 DynamoDB calls
- Replace `functions/lib/inquiries.js` Firestore serialization with DynamoDB marshalling

### Hosting → Vercel (stays) or S3 + CloudFront
- Frontend stays on Vercel (already working)
- Or move to S3 + CloudFront if desired

### Serverless API → AWS Lambda + API Gateway
- Replace Firebase Functions with Lambda functions
- `api/contact.mjs` becomes a Lambda handler
- `functions/index.js` routes split into individual Lambda handlers

### Apps Script stays
- Google Sheets storage and classification logic unchanged
- Lambda calls Apps Script web app the same way `contact.mjs` does today

### Files that need rewriting
| File | Change |
|---|---|
| `frontend/lib/firebase.ts` | Replace with Cognito auth client |
| `frontend/contexts/AuthContext.tsx` | Use Cognito user pool |
| `frontend/components/SignInModal.tsx` | Email/password + Google Cognito OAuth |
| `frontend/components/OnboardingModal.tsx` | Cognito sign-in |
| `frontend/components/ProtectedRoute.tsx` | Cognito auth check |
| `frontend/components/GoogleSheetsModal.tsx` | Keep, but auth via Cognito |
| `frontend/src/services/api.ts` | Use Cognito ID token instead of Firebase token |
| `frontend/components/NotificationSettings.tsx` | Auth via Cognito |
| `frontend/components/workspace/ImportWorkspace.tsx` | Auth via Cognito |
| `functions/index.js` | Replace firebase-admin with AWS SDK v3 DynamoDB |
| `functions/lib/inquiries.js` | Replace Firestore queries with DynamoDB queries |
| `functions/package.json` | Remove firebase-admin, firebase-functions; add @aws-sdk/client-dynamodb |
| `api/contact.mjs` | Keep as-is, add env vars |
| `firebase.json` | Remove (no longer needed) |
| `frontend/firebase.ts` | Delete |
| `.env.local` | Replace Firebase config with AWS Cognito + DynamoDB config |

### AWS services needed
1. **Cognito User Pool** — authentication
2. **Cognito Identity Pool** (optional) — for unauthenticated guest access if needed
3. **DynamoDB table** — inquiries, users, apiKeys, flows
4. **Lambda** — API handlers (contact, inquiries CRUD, auth proxy)
5. **API Gateway** — REST API in front of Lambda
6. **S3** — static frontend hosting (optional, if leaving Vercel)
7. **IAM roles** — Lambda execution role with DynamoDB access

### Migration steps (do in order)
1. Set up Cognito user pool, configure app client
2. Create DynamoDB tables (inquiries, users, apiKeys, flows)
3. Deploy Lambda functions for contact intake and inquiry CRUD
4. Set up API Gateway with routes matching current Firebase Functions endpoints
5. Update frontend auth to use Cognito (sign in, token refresh)
6. Update frontend API calls to hit API Gateway instead of Firebase
7. Test inquiry flow end-to-end
8. Cut over DNS / hosting
9. Decommission Firebase project

---

## PART 3 — CURRENT FIREBASE DEPENDENCIES TO REMOVE

Frontend packages to uninstall:
- `firebase`

Frontend imports to remove:
- `frontend/lib/firebase.ts` (entire file)
- All `from 'firebase/auth'` and `from 'firebase/firestore'` imports

Functions packages to uninstall:
- `firebase-admin`
- `firebase-functions`

Config files to remove:
- `firebase.json`
- `.firebaserc`
- `firestore.rules`
- `firestore.indexes.json`
- `firestore-debug.log`
- `firebase-debug.log`

---

## QUICK START (do this first)

1. In Apps Script: set `INTAKE_SECRET` and `SHEET_ID` in Script Properties, deploy web app
2. In Vercel: set `APPS_SCRIPT_WEB_APP_URL` and `APPS_SCRIPT_INTAKE_SECRET` env vars
3. Redeploy Vercel
4. Test inquiry submission
5. Then plan the AWS migration
