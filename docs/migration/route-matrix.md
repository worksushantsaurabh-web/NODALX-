# Route Matrix: Firebase Functions to Vercel/Supabase

This document maps the existing Express endpoints (from `functions/index.js` and `functions/lib/workspaceRoutes.js`) to their proposed Supabase replacements, noting authentication, callers, and datastore interactions.

## Pilot contract audit (7 October 2026)

Current pilot entry points are `App.tsx` → `Dashboard.tsx`, the website inquiry
form, profile and feedback. Old component files are not proof of reachable support.
The dashboard no longer mounts ImportWorkspace, AutomationWorkspace,
WorkspacePipeline, WorkspaceConnections, WorkspaceBilling or the legacy API-key
onboarding wizard. Existing tab URLs resolve to explicit deferred notices or
read-only job/usage views. No endpoints were enabled by hiding their controls.

| Contract | Current caller | Pilot decision |
|---|---|---|
| POST `/api/contact` | InquiryForm | Direct Supabase supported in source with `INTAKE_PROVIDER=supabase-direct`; source and network gate required. Cloud activation not verified. Apps Script remains a selectable legacy provider. |
| GET `/api/workspace/jobs`, GET `/api/workspace/jobs/:id` | PilotJobs (list); backend detail available | Authenticated owned reads supported; list is capped at latest 50, not an all-time total. |
| POST `/api/workspace/inquiries/:id/analyze` | Dashboard | Supported but disabled by backend processing availability and quota; no worker activated. |
| GET invoices; POST checkout/cancel-subscription | Legacy WorkspaceBilling | Deferred; pilot uses GET usage only. |
| Sheet connect/sync, import preview/upload, POST jobs, retry/export | Legacy ImportWorkspace | Deferred; no pilot mutation controls. |
| Recipes, exceptions | Legacy AutomationWorkspace | Deferred; notice only. |
| Key generate/read/rotate/delete, onboarding business/status | Legacy wizard/pipeline | Deferred; operator source provisioning only, verified identity required. |
| Flows, notifications, connector APIs | Legacy services/components | No active Dashboard imports; unimplemented routes remain fail-closed. |
| GET/PUT profile, POST feedback | Account and feedback consumers | Native verified Supabase auth; owned data only. |

Public process health does not establish database, source, worker or email readiness.
No direct-intake confirmation or owner email is implemented; email is a later phase.

## Implemented local routes

The table below this section is the original replacement plan, not a completion claim.
The current dispatcher is `api/migration.mjs` → `server/supabase-workspace.mjs`;
account routes use `server/supabase-account.mjs`. All workspace reads/writes require
a verified Supabase identity and a server-owned binding.

| Method | Implemented route | Current result |
|---|---|---|
| GET/PUT | `/api/user/profile` | Owned profile and allowed-field updates |
| POST | `/api/feedback` | Authenticated feedback persistence |
| GET | `/api/workspace/inquiries` | Owned, cursor-paginated original records |
| PATCH | `/api/inquiries/:id/status`, `/api/workspace/inquiries/:id` | Atomic owned status/note/follow-up update and activity |
| GET | `/api/workspace/inquiries/:id/activity` | Owned notes/follow-up and recent events |
| GET/PUT | `/api/workspace/settings` | Owned qualification criteria |
| GET | `/api/workspace/overview` | Owned period aggregates, no invented insights |
| GET | `/api/workspace/usage`, `/api/user/tier`, `/api/workspace/plans` | Actual local subscription; processing/checkout disabled |
| GET | `/api/health/live` | Public process liveness only |
| GET | `/api/health/ready`, `/api/health` | Authenticated partial service readiness |

Other routes currently return authenticated `503 MIGRATION_PENDING`; `/api/contact`
uses the explicitly configured intake provider. No existing Sheet/customer data
has been migrated and no production deployment is verified.

## Original replacement plan

| Method | Path | Caller | Auth | Datastore/Side Effect | Replacement Plan |
|---|---|---|---|---|---|
| **Intake & Webhooks** | | | | | |
| POST | `/api/contact` | Website Form | Unauth | Apps Script | Retain as Vercel Node function (`api/contact.mjs`). No change. |
| POST | `/api/inquiries` | Public API | Unauth/Key | Firestore `inquiries` | `api/inquiries.ts` (Supabase DB insert). |
| POST | `/api/webhook/:webhookId`| Providers | Unauth/Sig | Queue/Firestore | `api/webhook/[webhookId].ts` (Supabase DB insert). |
| POST | `/api/billing/webhook` | Razorpay | Unauth/Sig | Billing update | Planned signed, replay-safe atomic Supabase billing update. Not implemented. |
| **Workspace Data** | | | | | |
| GET | `/api/workspace/usage` | `WorkspaceViews.tsx` | Bearer | Firestore `rateLimits`/tier | `api/workspace/usage.ts` (Supabase `usage_reservations`). |
| GET | `/api/workspace/inquiries` | `Dashboard.tsx` | Bearer | Firestore `inquiries` | `api/workspace/inquiries.ts` (Supabase `inquiries` select). |
| GET | `/api/workspace/settings` | `WorkspaceViews.tsx` | Bearer | Firestore | `api/workspace/settings.ts` |
| PUT | `/api/workspace/settings` | `WorkspaceViews.tsx` | Bearer | Firestore | `api/workspace/settings.ts` |
| GET | `/api/workspace/plans` | `WorkspaceViews.tsx` | Bearer | Firestore | `api/workspace/plans.ts` |
| GET | `/api/workspace/invoices` | `WorkspaceViews.tsx` | Bearer | Razorpay API | `api/workspace/invoices.ts` |
| POST | `/api/workspace/checkout` | `WorkspaceViews.tsx` | Bearer | Razorpay checkout | `api/workspace/checkout.ts` |
| POST | `/api/workspace/cancel-subscription`| `WorkspaceViews.tsx` | Bearer | Razorpay API | `api/workspace/cancel-subscription.ts` |
| **User & Keys** | | | | | |
| GET | `/api/user/profile` | `user.ts` | Bearer | Firestore `users` | `api/user/profile.ts` (Supabase `profiles`). |
| PUT | `/api/user/profile` | `user.ts` | Bearer | Firestore `users` | `api/user/profile.ts` (Supabase `profiles`). |
| GET | `/api/user/tier` | `useUserTier.ts` | Bearer | Firestore `users` | `api/user/tier.ts` |
| POST | `/api/user/redeem-key` | | Bearer | Firestore | `api/user/redeem-key.ts` |
| POST | `/api/onboarding/generate-key`| `CustomerOnboarding.tsx`| Bearer | Firestore `apiKeys` | `api/onboarding/generate-key.ts` |
| GET | `/api/onboarding/status` | `CustomerOnboarding.tsx`| Bearer | Firestore | `api/onboarding/status.ts` |
| PUT | `/api/onboarding/business-name`| `CustomerOnboarding.tsx`| Bearer | Firestore | `api/onboarding/business-name.ts` |
| GET | `/api/workspace/key` | `WorkspacePipeline.tsx`| Bearer | Firestore `apiKeys` | `api/workspace/key/index.ts` |
| POST | `/api/workspace/key/rotate` | `WorkspacePipeline.tsx`| Bearer | Firestore `apiKeys` | `api/workspace/key/rotate.ts` |
| DELETE| `/api/workspace/key` | `WorkspacePipeline.tsx`| Bearer | Firestore `apiKeys` | `api/workspace/key/index.ts` |
| **Connectors & Integrations**| | | | | |
| GET | `/api/connectors` | | Bearer | Firestore | `api/connectors/index.ts` |
| PUT | `/api/connectors/:id` | | Bearer | Firestore | `api/connectors/[id].ts` |
| GET | `/api/integrations/notifications`| | Bearer | Firestore | Planned Supabase route. |
| PUT | `/api/integrations/notifications`| | Bearer | Firestore | Planned Supabase route. |
| POST | `/api/integrations/notifications/test`| | Bearer | External Request | Planned Supabase route. |
| **Google Sheets & Uploads** | | | | | |
| GET | `/api/workspace/sheets` | `ImportWorkspace.tsx` | Bearer | Firestore | `api/workspace/sheets/index.ts` |
| POST | `/api/workspace/sheets/challenge`| `ImportWorkspace.tsx` | Bearer | Google API | `api/workspace/sheets/challenge.ts` |
| POST | `/api/workspace/sheets/connect`| `ImportWorkspace.tsx` | Bearer | Google API/Firestore| `api/workspace/sheets/connect.ts` |
| DELETE| `/api/workspace/sheets/:id` | `ImportWorkspace.tsx` | Bearer | Firestore | `api/workspace/sheets/[id].ts` |
| POST | `/api/workspace/uploads` | `ImportWorkspace.tsx` | Bearer | Storage | `api/workspace/uploads.ts` (Supabase Storage). |
| POST | `/api/workspace/preview` | `ImportWorkspace.tsx` | Bearer | File processing | `api/workspace/preview.ts` |
| POST | `/api/workspace/jobs` | `ImportWorkspace.tsx` | Bearer | Firestore/Queue | `api/workspace/jobs/index.ts` |
| **Jobs & Recipes** | | | | | |
| GET | `/api/workspace/jobs` | | Bearer | Firestore | `api/workspace/jobs/index.ts` |
| GET | `/api/workspace/jobs/:id` | `ImportWorkspace.tsx` | Bearer | Firestore | `api/workspace/jobs/[id].ts` |
| POST | `/api/workspace/jobs/:id/retry`| `ImportWorkspace.tsx` | Bearer | Queue | `api/workspace/jobs/[id]/retry.ts` |
| POST | `/api/workspace/jobs/:id/export`| `ImportWorkspace.tsx` | Bearer | Google API | `api/workspace/jobs/[id]/export.ts` |
| GET | `/api/workspace/recipes` | `AutomationWorkspace.tsx`| Bearer | Firestore | `api/workspace/recipes/index.ts` |
| POST | `/api/workspace/recipes` | `AutomationWorkspace.tsx`| Bearer | Firestore | `api/workspace/recipes/index.ts` |
| GET | `/api/workspace/recipes/:id` | | Bearer | Firestore | `api/workspace/recipes/[id].ts` |
| PATCH | `/api/workspace/recipes/:id` | | Bearer | Firestore | `api/workspace/recipes/[id].ts` |
| POST | `/api/workspace/recipes/:id/preview`| `AutomationWorkspace.tsx`| Bearer| Processing | `api/workspace/recipes/[id]/preview.ts` |
| POST | `/api/workspace/recipes/:id/enable`| `AutomationWorkspace.tsx`| Bearer | Firestore | `api/workspace/recipes/[id]/enable.ts` |
| POST | `/api/workspace/recipes/:id/pause`| `AutomationWorkspace.tsx`| Bearer | Firestore | `api/workspace/recipes/[id]/pause.ts` |
| POST | `/api/workspace/recipes/:id/apply`| | Bearer | Queue | `api/workspace/recipes/[id]/apply.ts` |
| POST | `/api/workspace/recipes/:id/run-now`| `AutomationWorkspace.tsx`| Bearer| Queue | `api/workspace/recipes/[id]/run-now.ts` |
| GET | `/api/workspace/exceptions` | `AutomationWorkspace.tsx`| Bearer | Firestore | `api/workspace/exceptions/index.ts` |
| GET | `/api/workspace/exceptions/:id`| `AutomationWorkspace.tsx`| Bearer | Firestore | `api/workspace/exceptions/[id].ts` |
| POST | `/api/workspace/exceptions/:id/action`| `AutomationWorkspace.tsx`| Bearer| Firestore | `api/workspace/exceptions/[id]/action.ts` |
| **Flows** | | | | | |
| GET | `/api/flows` | `flows.ts` | Bearer | Firestore | `api/flows/index.ts` |
| POST | `/api/flows` | `flows.ts` | Bearer | Firestore | `api/flows/index.ts` |
| PUT | `/api/flows/:id` | `flows.ts` | Bearer | Firestore | `api/flows/[id].ts` |
| DELETE| `/api/flows/:id` | `flows.ts` | Bearer | Firestore | `api/flows/[id].ts` |
