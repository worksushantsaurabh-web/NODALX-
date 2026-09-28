---
title: Vercel Migration
type: guide
tags: [deployment, vercel, godaddy, firebase]
---

# Move the NodalX frontend to Vercel

Firebase Hosting currently serves `nodalx.in`. Do not change GoDaddy DNS until the Vercel deployment has been tested. The migration changes frontend hosting only: Firebase Auth and Firestore remain, and `/api/**` is proxied to the existing Firebase Hosting API. That API currently responds with HTTP 503 because the Firebase function reports disabled billing. Moving the frontend does **not** restore the dashboard or inquiry pipeline. Resolve backend billing or migrate the API separately before launch.

## Preview first

1. Sign in to Vercel: `vercel login`.
2. From `frontend/`, run `vercel link` and select or create the NodalX project. Set the Vercel project Root Directory to `frontend` if importing from Git. The `frontend/vercel.json` file configures Vite, SPA fallback, and the `/api` proxy.
3. Run `vercel` from `frontend/` to create a preview deployment. Check the page, assets, and deep links at its preview URL. An API request returning 503 is the known Firebase backend issue, not a Vercel build failure.
4. Set the exact Vercel preview or production hostname as an authorized domain in Firebase Authentication before testing Google sign-in there. Do not remove the existing Firebase or `nodalx.in` authorized domains.

If the Vercel project instead uses the repository root, the root `vercel.json` builds `frontend/` and applies the same rewrites. Use only one project root for a given Vercel project.

## Move `nodalx.in`

1. Add `nodalx.in` and `www.nodalx.in` to the Vercel project. Choose `nodalx.in` as canonical and redirect `www` to it.
2. In Vercel Domains, inspect the **exact** DNS records assigned to this project. In GoDaddy, replace the Firebase A record for `@` (`199.36.158.100`) with Vercel's specified apex A record. Change `www` from its current CNAME target `nodalx.in` to Vercel's specified CNAME target if the Vercel setup requires it. Keep TXT verification and unrelated email/NS records unless Vercel explicitly requires a change.
3. Wait for Vercel to show valid configuration and SSL. Check `https://nodalx.in`, `https://www.nodalx.in`, sign-in, dashboard, inquiry submission, and `/api` responses. Do not remove the Firebase Hosting site until the replacement is healthy.

Official references: [Vercel Vite guide](https://vercel.com/docs/frameworks/frontend/vite), [Vercel custom-domain setup](https://vercel.com/docs/domains/set-up-custom-domain), and [Vercel external rewrites](https://vercel.com/docs/routing/rewrites).
