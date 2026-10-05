# NODALxAI API conventions

## URL and ownership

- JSON REST endpoints are under `/api/`.
- Singular resources use `/api/workspace/<resource>/:id`.
- Public intake uses `/api/contact`, `/api/inquiries` with `X-API-Key`, or
  `/api/webhook/:ownerId` with the same server-held key.
- Authenticated workspace routes use `Authorization: Bearer <Firebase ID token>`.
- The server derives UID from the verified token and scopes every query.

## Response format

Success responses are JSON. Mutation responses should identify the resulting
resource or `{success: true}`. Errors use:

```json
{ "error": "Human-readable safe message", "code": "INVALID_REQUEST", "requestId": "server-generated UUID" }
```

Never return stack traces, provider response bodies, credentials, or another
customer's data. Responses include `X-Request-ID` and `Cache-Control: private,
no-store`. The request ID is suitable for support correlation, not authorization.
Limit responses include `Retry-After: 60`. Logs omit request bodies, tokens,
query values and provider response bodies.

## Status codes

| Status | Use |
|---:|---|
| 200 | Successful read or mutation |
| 202 | Inquiry accepted for storage/processing |
| 400 | Invalid input |
| 401 | Missing or invalid authentication/key |
| 402 | Processing requires an active plan |
| 403 | Authenticated but forbidden action |
| 404 | Missing or differently-owned resource |
| 409 | Idempotency or state conflict |
| 413 | Upload too large |
| 429 | Rate limit or plan limit |
| 500 | Unexpected server failure |
| 502/503 | Upstream or runtime unavailable |

## Validation and idempotency

- Validate type, length, enum and ownership at the boundary.
- Preserve original inquiry text but cap request and parsed upload sizes.
- Callers should send `Idempotency-Key` for retryable inquiry and job creation
  paths; legacy intake accepts requests without it and cannot deduplicate those.
- A reused key with different input returns `409`; a reused key with the same
  input returns the original result.
- List endpoints must have an explicit limit and a documented pagination plan.

## Async work

Slow provider calls and classification are represented by a stored processing
status/job. The original record remains readable when processing fails.

## Health and pagination

- `GET /api/health/live`: process liveness without a database call.
- `GET /api/health/ready` (alias `/api/health`): bounded database check;
  returns 503 on failure. Do not treat this as a complete provider health check.
- `GET /api/workspace/inquiries?limit=100&cursor=<nextCursor>`: authenticated,
  owner-scoped creation-date descending pages with a document-ID tie breaker.
  Limits are 1–100, default 50. Returns `{records, nextCursor}`. Pass the cursor
  unchanged; an invalid, deleted or differently-owned cursor returns 400.
- `POST /api/onboarding/generate-key`: returns the raw key only when newly
  created. Repeated calls return masked metadata, not the existing secret.
- `GET /api/workspace/key`, `POST /api/workspace/key/rotate`, and
  `DELETE /api/workspace/key`: authenticated metadata, rotation and revocation.
  Rotation invalidates previous workspace callers immediately. Newly created
  keys are hashed. Legacy plaintext keys remain compatible until migration or
  rotation; rotate them before release and update trusted callers.
# Import job mode and quality preview (1 October 2026)

`POST /api/workspace/jobs` accepts `mode: "import" | "analyze"`; omission keeps
the existing analysis behavior. Import-only reserves inquiry allowance and a job
slot but zero credits; worker completion saves raw inquiries as
`awaiting_analysis`. Unknown modes and missing/ambiguous mapped columns fail
with 400. Idempotency binds the mode as well as the existing input snapshot.

`POST /api/workspace/preview` with a mapping also returns `quality`, `issues`
(up to 100 row-number/reason/action entries) and `issueCount`. Format warnings
are advisory, not email deliverability checks. Existing exact duplicate policy
is unchanged; no records are merged or overwritten. Job rows and imported
inquiries retain source references. Real provider and worker checks remain
release gates; local preview is not proof of production availability.
