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
idempotency, reservation concurrency, partial import, signed billing events,
import recipes, automation and recipe security rules. It discovers every
`lib/*.integration.test.js` and `lib/*.rules.test.js` file automatically and
works regardless of the caller's working directory. The unit command includes
recipe/automation helpers and regression tests for suite discovery and the
missing-emulator guard.

Firestore-only suites use fresh, suite-specific `demo-` project IDs on each
run. Clearing the rules fixture cannot delete another suite's connections,
recipes or inquiries; automation scans cannot see another suite's work. Auth
tests keep `demo-nodalx-tests` to match the Authentication emulator's project.
All names and accounts are synthetic. Multiple demo-project warnings from the
emulator are expected with its default single-project warning mode.

Run the complete suite twice against the same local emulators to check parallel
execution and isolation between runs:

```sh
firebase emulators:exec --only auth,firestore --project demo-nodalx-tests 'REQUIRE_EMULATORS=1 npm --prefix functions test && REQUIRE_EMULATORS=1 npm --prefix functions test && npm --prefix functions run test:integration'
```

The suites retain parallel execution; serializing them is not the repair.
The rules suite contains a regression that clears its own namespace and checks
that a connection in another namespace survives. Security-rule
`PERMISSION_DENIED` logs are expected when a denial assertion succeeds.

In a restricted desktop sandbox, Firebase CLI can separately fail on exit while
updating `~/.config/configstore/firebase-tools.json` via a temporary file. This
can happen after the test child reports success. Do not change assertions or
hide that CLI exit code; resolve the local permission separately. It is not a
backend syntax error and does not require deployment or billing changes.

Reference: [Firebase demo projects and emulator project IDs](https://firebase.google.com/docs/emulator-suite/connect_firestore#choose_a_firebase_project).
Emulators do not validate production composite-index deployment or credentials.

Verified on 5 October 2026: 38 unit checks pass; two consecutive parallel full
runs each pass all 78 checks with no skips; the complete integration runner
passes all 40 checks. The database-clear regression passes. After allowing the
CLI's normal local metadata write, a final integration run invoked from outside
the repository also exits successfully at both the test and Firebase CLI
levels. Lint, syntax and secret checks pass. No production application code,
Firestore rules, credentials, billing or deployment was changed.

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
