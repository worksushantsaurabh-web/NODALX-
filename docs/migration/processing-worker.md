# Local processing queue and worker

Implemented locally on 5–6 October 2026. Not cloud-deployed or live-provider verified.

## What works

- `POST /api/workspace/inquiries/:id/analyze` queues an existing owned inquiry.
  Body is `{}` or `{ "requestKey": "unique-request-key" }`. Keys must contain
  8–128 letters, numbers, underscores or hyphens. Workspace IDs are never accepted.
- Original name/email/company/message and saved qualification criteria are captured
  as a job snapshot. Processing never overwrites original text or contact fields.
- Enqueue, usage reservation and row persistence are one transaction. Duplicate keys
  with identical snapshots return the same job; changed input returns 409. Concurrent
  requests for the same active inquiry cannot create extra jobs or credit charges.
- Trial/starter/growth retain 50/500/2000 analysis credits and 1/1/2 processing slots.
  Slots count active jobs across subscription periods, not just the current counter.
- Worker claims use `FOR UPDATE SKIP LOCKED`, a 120-second lease and a fresh fencing
  token. Expired work can be reclaimed. Three processing attempts are allowed; the
  next claim releases a repeatedly abandoned job rather than calling the provider.
- Result persistence and credit settlement are atomic. Successful processing uses
  one credit; failures release the reservation. Settlement replays cannot charge twice.
  A crash during settlement leaves the lease recoverable, not a claimed success.
- `GET /api/workspace/jobs` returns up to 50 owned jobs. `GET /api/workspace/jobs/:id`
  returns owned row details; foreign or missing jobs return 404. No provider errors,
  credentials or raw technical responses are included in these records.

## Tests without external processing

From the repository root with Docker Desktop and local Supabase running:

```sh
npm run test:supabase
node --test tests/processing-worker.test.mjs
TEST_LOCAL_PROCESSING=true node --test tests/processing-queue.local.test.mjs
npm run test:supabase:account
```

The processing integration test requires the local worker to be disabled and the
local queue idle. It creates synthetic accounts/inquiries, briefly enables processing,
and disables it in `finally`. Run it alone, not alongside other local integration tests
or while using local analysis. It leaves synthetic records; do not reset wanted data.
Provider output in tests is explicitly synthetic. No real email or external processor
request is sent. PostgreSQL input fingerprints use
[SHA-256 binary-string hashing](https://www.postgresql.org/docs/16/functions-binarystring.html).

## Activation is deliberately not performed

`private.processing_configuration.enabled` defaults to false. Only an operator with
privileged database access may change it. Browsers cannot enable processing, claim
jobs or settle reservations. The dashboard remains disabled until this gate is enabled.
This flag is operator configuration, not proof of a running worker or a live integration.

Migration 009 additionally requires a ready worker heartbeat within 60 seconds. The
operator flag alone no longer enables queueing. A prepared cloud daemon and Gemini
adapter are described in `docs/migration/live-processing-rollout.md`; they are not deployed.

Before enabling it, obtain approval for the exact processor, customer data transmission,
costs and worker runtime. Configure a supervised consumer and monitoring; the current
CLI is a **one-shot local runner**, not a deployed scheduler. Provider outages must
disable new enqueue requests and preserve outstanding work for lease recovery.

The one-shot local command is `node scripts/run-processing-worker.mjs`. It requires
private environment variables `PROCESSING_ENDPOINT`, `PROCESSING_ALLOWED_HOST`,
`PROCESSING_TOKEN` and the explicit opt-in `ALLOW_PROCESSING_NETWORK=true`.
Do not put these in `VITE_*`, source control, URL queries or browser configuration.
The runner accepts only the local Supabase URL, obtains its privileged key privately,
and sends the inquiry snapshot only to the exact approved HTTPS host. Redirects are
rejected, responses are limited to 32 KiB, and provider calls time out within 90 seconds.

The processor must return a synchronous JSON object with some of these fields:

```json
{"intent":"sales inquiry","urgency":"normal","fit_score":50,"category":"services","summary":"Actual provider-generated summary","suggested_action":"Review the request"}
```

This is a contract example, not a result for any real inquiry. Strings are limited to
4000 characters; scores must be finite numbers from 0 to 100. Unsupported fields and
malformed responses fail rather than overwrite ownership, originals or subscription state.
Asynchronous webhook acknowledgements do not satisfy this contract; they need a
separate signed callback/replay-safe adapter before activation.

The same job ID is sent as `Idempotency-Key` on retries. The provider must honor it
to prevent duplicate external work/cost after a crash. Database fencing and accounting
protect NodalX's records; they cannot guarantee a third party charges only once.

## Still to implement

- Private uploads, parsing, reviewed previews and batch job submission.
- API/UI retry of failed jobs, cancellation and durable export handling.
- Ownership-verified Sheets sync, recipes and scheduled automation.
- Supervised production worker, heartbeat/readiness, alerting and provider-specific
  integration tests. Do not deploy this local CLI as a Vercel request handler.
- Production processing configuration, existing-user continuity and release approval.
