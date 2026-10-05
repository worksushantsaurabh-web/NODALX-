# Local validation and synthetic preview

No production credentials, billing changes or deployments are required.

## Automated checks

```sh
npm --prefix frontend run build
(cd frontend && node --test pages/*.test.ts lib/analyticsConsent.test.ts)
npm --prefix functions run lint
npm --prefix functions run test:unit
firebase emulators:exec --only auth,firestore --project demo-nodalx-tests 'npm --prefix functions run test:integration && node scripts/test-firestore-rules.mjs'
node --test tests/*.test.mjs
node scripts/scan-secrets.mjs --working-tree
git diff --check
```

The integration runner deliberately fails if either emulator environment is
missing. Tests include real Firebase token verification, disabled accounts,
cross-owner isolation, 105-record pagination, key rotation/revocation,
idempotency, reservation concurrency, partial import and signed billing events.
Emulators do not validate production composite-index deployment or credentials.

## Manual dashboard preview

1. Start Auth and Firestore emulators for `demo-nodalx-tests`.
2. Start the isolated API with:

```sh
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 node scripts/preview-workspace.cjs
```

3. Start the frontend from `frontend/`:

```sh
API_BACKEND_PORT=5052 VITE_USE_FIREBASE_EMULATORS=true VITE_FIREBASE_PROJECT_ID=demo-nodalx-tests VITE_FIREBASE_API_KEY=emulator-only VITE_FIREBASE_AUTH_DOMAIN=demo-nodalx-tests.firebaseapp.com VITE_ANALYTICS_ENABLED=false npm run dev -- --host 127.0.0.1 --port 5174 --strictPort
```

4. Sign in at `http://127.0.0.1:5174/` with `preview@example.test` and
   `LocalPreview-Only123!`. These are synthetic local-only credentials, not a
   production account. The script resets its own 105 synthetic records when
   restarted and disables external processing. Do not point it at real data.
5. Verify overview counts, inquiry selection, older pages, status persistence,
   sources, imports, usage and settings at desktop and 375px width. Verify both
   themes and keyboard navigation. Stop the three processes when finished.

Preview only mounts shared workspace routes. Legacy profile routes and live
provider workflows are not simulated. Staging smoke tests are still required.
