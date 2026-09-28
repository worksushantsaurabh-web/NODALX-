---
title: Frontend
type: subsystem
tags: [frontend, vite, react, vercel, spa]
path: frontend/
deploys_to: Vercel
---

# Frontend

> Vite + React SPA deployed on Vercel. Handles all user-facing UI including landing page, dashboard, onboarding, and integrations.

---

## Tech

| Tool | Purpose |
|------|---------|
| Vite | Build tool + dev server |
| React 19 | UI framework |
| React Router 7 | Client-side routing |
| Tailwind CSS 3 | Styling |
| Firebase SDK | Auth + Firestore client |
| Lucide React | Icon library |

---

## File Map

```
frontend/
├── index.html          # HTML entry point
├── index.tsx           # React root mount
├── index.css           # Tailwind imports + global styles
├── App.tsx             # Router + layout
├── env.d.ts            # TypeScript env declarations
├── vite.config.ts      # Build config + proxy + aliases
├── tailwind.config.js  # Tailwind theme
├── postcss.config.js   # PostCSS pipeline
├── package.json        # Dependencies
│
├── pages/              # Route-level components
│   ├── Home.tsx        # Landing page
│   ├── Dashboard.tsx   # Main app (protected)
│   ├── Integrations.tsx
│   ├── Changelog.tsx
│   ├── PrivacyPolicy.tsx
│   ├── Terms.tsx
│   └── NotFound.tsx
│
├── components/         # Shared components
│   ├── Navbar.tsx
│   ├── Hero.tsx
│   ├── Features.tsx
│   ├── SignInModal.tsx
│   ├── ProtectedRoute.tsx
│   ├── InquiryForm.tsx     # → Posts to [[Appscript]]
│   ├── GoogleSheetsModal.tsx
│   ├── OnboardingWizard.tsx
│   ├── DashboardPreview.tsx
│   ├── FeedbackWidget.tsx
│   └── ... (30+ components)
│
├── contexts/           # React Context providers
│   ├── AuthContext.tsx     # Firebase Auth state
│   ├── ThemeContext.tsx    # Dark/light mode
│   └── FeedbackContext.tsx # In-app feedback
│
├── hooks/              # Custom hooks
│   └── useUserTier.ts  # Check user subscription tier
│
├── lib/                # Utility modules
│   ├── firebase.ts     # Firebase app init + exports
│   └── analytics.ts    # Event tracking
│
├── src/services/       # API service layer
│   ├── api.ts          # HTTP client for [[Backend]]
│   ├── flows.ts        # Workflow/flow CRUD
│   └── user.ts         # User profile operations
│
├── ui/                 # Design system primitives
│   ├── Button.tsx
│   ├── Card.tsx
│   ├── Input.tsx
│   ├── Badge.tsx
│   ├── Panel.tsx
│   ├── Section.tsx
│   ├── StatCard.tsx
│   └── index.ts       # Barrel export
│
├── data/               # Static data
│   ├── changelog.ts
│   └── useCases.ts
│
└── public/             # Static assets (copied to dist/)
    ├── og-image.png
    ├── robots.txt
    └── widget.js       # Embeddable widget
```

---

## Key Patterns

### Path alias
`@` resolves to `frontend/` root (set in `vite.config.ts`):
```ts
import { Button } from '@/ui';
import { useAuth } from '@/contexts/AuthContext';
```

### Env vars
All prefixed with `VITE_` (required for Vite to bundle them):
```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_API_BASE_URL
VITE_APPSCRIPT_WEBHOOK_URL
```
See [[Environment]] for full list.

### Dev proxy
`vite.config.ts` proxies `/api` and `/api-proxy` to `localhost:5001` ([[Backend]]) during dev.

---

## Deployment

- Deploys to **Vercel** on push to `main`
- Config: `vercel.json` (root level, points to `frontend/`)
- Build: `npm run build` → outputs to `frontend/dist/`
- SPA fallback: `/(.*) → /index.html`

See [[Deployment]] for full steps.

---

## Related

- [[Backend]] — API that frontend calls
- [[Appscript]] — Webhook that InquiryForm posts to
- [[Environment]] — All VITE_* vars
- [[Architecture]] — Where frontend fits in the system
