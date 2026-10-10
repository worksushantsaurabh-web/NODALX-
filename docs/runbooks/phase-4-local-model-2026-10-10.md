# Phase 4 local model checkpoint

Status: offline candidate only. No application adapter, worker host, provider
secret, processing gate or production deployment was activated.

## Artifact and runtime verified on 10 October 2026

- Owner-supplied file: `/Users/sushantsaurabh/Documents/Codex/2026-10-07/i-am-working-on-my-project/outputs/nodalx-v3.Q4_K_M.gguf`
- Format/size: GGUF, 2,019,377,440 bytes. SHA-256 matched the saved artifact
  manifest: `bfb12fd83e389740def4713b27d29a9abbacb68c7a2c3b160588eb3dcc09c490`.
- Saved training record identifies the base as
  `unsloth/Llama-3.2-3B-Instruct` and 838 fictional training examples plus
  202 validation examples. This is provenance from the local training handoff,
  not independent confirmation of every training claim.
- Existing `outputs/nodalx-v3/start-local.sh` launches llama.cpp `llama-server`
  on loopback port 8081, CPU. The trained GGUF is not in the active Ollama model
  inventory. Two listed Ollama entries were remote-backed and were not used.
- The existing `classify.mjs` wrapper supplies a separate policy, JSON schema,
  field/evidence checks and deterministic safety rules. Its nine-field output
  differs from the app worker's five-field contract. The saved
  `app-output-adapter.mjs` maps a reviewed result, but it is not integrated in
  this repository.

## Fresh synthetic check

The checksum was recalculated locally. The existing llama.cpp server was started
only on `127.0.0.1`, one example request succeeded, and all eight saved
`fresh-smoke-tests.json` cases were rerun without rewriting prior result files.
Six matched their expected fields. `fresh_history` was rejected because model
evidence was not present in the source text; `fresh_suppression` was rejected
for an inbound/outbound classification mismatch. Both failed closed. The local
server was stopped afterward. No customer inquiry or external model service was
used. The earlier saved report said 7/8 on these cases, so the fresh 6/8 result
must be treated as a regression or run-to-run variance until investigated.

## Integration gate

1. Preserve the current manual Analyze action and disabled operator gate. Never
   wire the browser or Vercel request directly to the Mac's loopback server.
2. Decide supervised production hosting for the exact GGUF, policy and wrapper.
   Reproduce its input/output contract in the worker adapter; do not substitute
   the raw model response or silently import it into a different runtime.
3. Pin model checksum, runtime build, policy hash, schema version and adapter
   version with each result. Keep the original message immutable and preserve
   human corrections when reprocessing.
4. Build an untouched, reviewer-labelled holdout covering urgent requests,
   opt-outs, mixed Hindi/English, ambiguous fit, prompt injection and failures.
   The current synthetic cases were used during prompt development and are
   regression checks, not a blind quality estimate.
5. Require schema validity, grounded evidence, tenant isolation, lease/retry and
   quota tests; run a real staged RDS worker rehearsal with synthetic records.
   Set a measured quality and latency gate before any customer-data pilot.

The Phase 4 exit gate is not met. Failed model output leaves the original
inquiry available for manual handling; no automatic outreach is permitted.

## Wrapper improvement and retry, 10 October

The owner asked to improve the model. The saved v3 wrapper and system prompt in
the separate model workspace were updated without changing GGUF weights. The
wrapper now bypasses inference for verified prospect do-not-contact state,
accepts exact prior customer-message evidence, rejects blank/assistant evidence,
and keeps website-only prospects at unknown fit. Four focused wrapper tests pass.
The first eight-case retry passed 7/8; the remaining thin-prospect failure was
reproduced and corrected by a deterministic insufficient-facts rule. A second
eight-case retry passed 8/8. The llama.cpp server was stopped. This measures the
whole model-plus-policy recipe on authored regression cases, not unseen-case
accuracy. See `outputs/nodalx-v3/wrapper-retry-2026-10-10.md` in the separate
training workspace for recipe hashes and the next data/evaluation gate.

## Deep evaluation and contract staging, 10 October

The local raw/wrapper/app audit ran 41 authored synthetic cases once and nine
critical cases three times. Raw asserted-field matches were 32/41 and 9/27;
wrapped matches were 39/41 and 27/27. A separate ten-case challenge produced
7/10 raw and 10/10 wrapped asserted-field matches, but found a privacy draft
that implied deletion could be confirmed before completion. The wrapper now
keeps typed product-knowledge evidence with source IDs, drops unsupported
evidence when a valid source remains, and withholds suspect drafts for review.
Replay of the 41 raw outputs scored 40/41 asserted fields, with eight review
flags and no errors; the ten challenge outputs passed simple quality assertions
with **six drafts withheld**. This is a safe regression result, not evidence of
a useful customer-facing draft rate. Model weights are unchanged. See the
separate model-workspace `outputs/nodalx-v3/audits/stage-progress-2026-10-10.md`
and `outputs/nodalx-v3/evaluation-rubric.md`.

`server/nodalx-v3-input.mjs` is a staged app boundary. It maps the current job
snapshot to a `task:'inbound'` input, excludes separate name/email/company,
validates the 4,000-character total recipe limit, and accepts product knowledge,
customer history, and verified state only from trusted server arguments. It is
not called by the worker yet. A future versioned result must preserve the
model/prompt/policy checksums, typed evidence sources, structured action and
priority, proposed draft, review reasons, and human decision separately from
the existing flat five-field result. Database migration and dashboard review
flow require a reviewed design before activation. The current app contract
cannot store those fields safely; processing remains disabled.

## Frozen synthetic benchmark and owner choices

Owner has no real examples yet and selected synthetic evaluation first; hosting
will be decided afterward. The 16-case `locked-synthetic-v1.json` was
checksummed before a single local inference run. Raw asserted fields matched
9/16 and wrapped fields matched 11/16. All outputs passed the existing app
shape validator, including wrong safety and privacy routing. See the separate
model-workspace `outputs/nodalx-v3/audits/locked-synthetic-v1-report.md` for
case details and limitations. Electrical-panel smoke missed high urgency and
human escalation; personal-data deletion missed escalation; a wrapper draft
used the old day in a reschedule; fit and repaired-explanation errors remain.
The fixture and recipe were not changed after this run. This is synthetic and
agent-labelled, not representative real-world accuracy. It blocks pilot
activation. Prepare new development cases, fix the policy/model on those,
then freeze a new benchmark with independent business review. The local
server was stopped and no live service was changed.

After preserving that first-run result, a separate development pass changed
the wrapper to route physical hazards and personal-data deletion to human
review, ask about the target reschedule day, and clear stale prose after
correcting a route. Eight focused tests pass. Replaying saved v1 raw outputs
gives 14/16 asserted-field matches and five review flags. Because these fixes
followed inspection of v1 failures, that replay is only a regression check;
the next independent benchmark must be newly frozen.

## Subsequent frozen evaluations

The separately frozen v2 synthetic set scored 12/20 raw and 17/20 wrapped
asserted-field matches on its first run. Development fixes based on those
failures scored 20/20 when replaying the saved raw outputs; that is a tuned
regression result. The next separately frozen v3 set scored 8/12 raw and
11/12 wrapped asserted-field matches on its first run. Its report also records
an unscored draft defect: it asks for banner size and material already supplied.
These sets are agent-authored and lack independent human labels or real traffic.
The model workspace contains the frozen fixtures, checksums, raw results,
reports, and regression replay.

The staged `nodalx-v3` result packet has a strict structural validator in
`server/nodalx-v3-result.mjs` and a model-side adapter. It has not been wired
into worker persistence or dashboard review. Keep the processing gate off.
