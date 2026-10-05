// Automatic source checks for approved import recipes.
//
// Polling runs server-side and does not depend on an open dashboard. Every
// run is claimed inside one transaction that advances the schedule, records
// the lease, and creates the run document; concurrent invocations cannot
// start duplicate runs or spend the same budget twice. New rows reuse the
// shared job service (startJob/processJob/recover) so quotas and dedupe never
// diverge from manual imports.
//
// This module does nothing unless PROCESSING_AUTOMATION=1 is set; no local
// activation path is a silent production switch. The scheduling surface is
// only wired to the Firestore scheduler behind that flag.
const crypto = require("node:crypto");
const {fail, fingerprint} = require("./plans");
const {budgetDay, schemaFingerprint} = require("./recipes");

const SCAN_LIMIT = 10; // bounded due-recipe selection per scheduler tick
const RUN_LEASE_MS = 2 * 60000;
const MAX_AUTO_RETRIES = 2;
const TERMINAL = new Set(["completed", "partial", "failed", "cancelled"]);
const OPEN_RUN_STATES = new Set(["claimed"]);

const AUTOMATION_ENABLED = process.env.PROCESSING_AUTOMATION === "1";

// --------------------------------------------------------------------------
// Pure helpers (unit-testable without Firestore)

// Normalize rows into stable-ID keyed records using the recipe mapping. Rows
// with missing or duplicate IDs are quarantined: rejected, never written back
// to the source, never substituting name/email as an identifier.
function normalizeRecords(rows, mapping, sourceIdColumn) {
  const seen = new Set();
  const records = [];
  const invalid = [];
  rows.forEach((row, index) => {
    const rowNumber =
      Number.isSafeInteger(row._rowIndex) && row._rowIndex >= 2 ?
        row._rowIndex :
        index + 2;
    const key = String(row[sourceIdColumn] ?? "").trim();
    if (!key) {
      invalid.push({row: rowNumber, kind: "missing_source_id"});
      return;
    }
    if (seen.has(key)) {
      invalid.push({row: rowNumber, kind: "duplicate_source_id"});
      return;
    }
    seen.add(key);
    const record = {
      name: String(row[mapping.name] ?? "").trim(),
      email: String(row[mapping.email] ?? "").toLowerCase().trim(),
      company: String(row[mapping.company] ?? "").trim(),
      message: String(row[mapping.message] ?? "").trim(),
    };
    records.push({
      key,
      rowNumber,
      record: {...record, sourceKey: key, row: rowNumber},
      contentHash: fingerprint(record),
    });
  });
  return {records, invalid};
}

// Diff the snapshot against persisted per-record state. Changed content is an
// exception for review: the original inquiry is never overwritten nor
// reclassed and recharged here.
function diffRecords(records, known) {
  const added = [];
  const changed = [];
  const unchanged = [];
  for (const entry of records) {
    const existing = known.get(entry.key);
    if (!existing) {
      added.push(entry);
    } else if (existing.contentHash === entry.contentHash) {
      unchanged.push({...entry, state: existing.state});
    } else {
      changed.push({...entry, previous: existing});
    }
  }
  return {added, changed, unchanged};
}

// --------------------------------------------------------------------------

function automationService(db, service, sheets) {
  const recipes = db.collection("importRecipes");
  const exceptions = db.collection("importExceptions");

  function recordRef(recipeId, key) {
    return recipes
        .doc(recipeId)
        .collection("records")
        .doc(fingerprint([recipeId, key]));
  }

  function budgetRef(recipeId, day) {
    return recipes.doc(recipeId).collection("budget").doc(day);
  }

  function exceptionRef(recipeId, type, scope) {
    return exceptions.doc(fingerprint([recipeId, type, scope]));
  }

  async function writeException(recipe, type, scope, message, action, extra = {}) {
    const reference = exceptionRef(recipe.id, type, scope);
    const now = Date.now();
    await db.runTransaction(async (transaction) => {
      const current = (await transaction.get(reference)).data();
      if (current && current.state === "resolved") return; // stay silent after review
      if (current) {
        transaction.update(reference, {
          count: (current.count || 0) + 1,
          lastSeenAt: now,
          state: current.state === "acknowledged" ? "acknowledged" : "open",
          runId: extra.runId || current.runId,
          detail: message,
          hint: action,
        });
        return;
      }
      transaction.create(reference, {
        uid: recipe.uid,
        recipeId: recipe.id,
        recipeName: recipe.name,
        type,
        scope,
        detail: message,
        hint: action,
        recordKey: extra.recordKey || null,
        runId: extra.runId || null,
        jobId: extra.jobId || null,
        count: 1,
        state: "open",
        firstSeenAt: now,
        lastSeenAt: now,
      });
    });
  }

  // ---------------------------------------------------------------------
  // Claim: one transaction advances the schedule and creates the run doc.
  // Concurrent scheduler ticks lose the race deterministically.
  async function claim(recipeSnapshot, now) {
    return db.runTransaction(async (transaction) => {
      const fresh = (await transaction.get(recipeSnapshot.ref)).data();
      if (!fresh || !fresh.enabled || fresh.status !== "active") return null;
      // Nullish check, not a falsy check: 0 is a legitimate past timestamp and
      // must remain claimable rather than being read as "never scheduled".
      if (fresh.nextRunAt == null || fresh.nextRunAt > now) return null;
      if (fresh.currentRunLease) return null;
      const lease = crypto.randomUUID();
      const runReference = recipeSnapshot.ref.collection("runs").doc();
      transaction.update(recipeSnapshot.ref, {
        nextRunAt: now + fresh.frequencyMinutes * 60000,
        lastCheckAt: now,
        currentRunId: runReference.id,
        currentRunLease: lease,
        currentDueAt: now + RUN_LEASE_MS,
        runCount: (fresh.runCount || 0) + 1,
        updatedAt: now,
      });
      transaction.create(runReference, {
        uid: fresh.uid,
        recipeId: recipeSnapshot.id,
        lease,
        status: "claimed",
        startedAt: now,
        dueAt: now + RUN_LEASE_MS,
        counters: {},
        jobId: null,
      });
      return {
        recipeRef: recipeSnapshot.ref,
        recipeId: recipeSnapshot.id,
        lease,
        runReference,
      };
    });
  }

  async function scanDue(now = Date.now()) {
    if (!AUTOMATION_ENABLED) return {claimed: 0, completed: 0};
    const due = await recipes
        .where("enabled", "==", true)
        .where("nextRunAt", "<=", now)
        .orderBy("nextRunAt", "asc")
        .limit(SCAN_LIMIT)
        .get();
    let completed = 0;
    for (const snapshot of due.docs) {
      const plan = await claim(snapshot, now);
      if (!plan) continue;
      try {
        await executeRun(plan, now);
        completed++;
      } catch (error) {
        console.error(
            JSON.stringify({
              event: "automation_run_failed",
              recipeId: plan.recipeId,
              message: String(error && error.message).slice(0, 200),
            }),
        );
        await abortRun(plan, "run_failed");
      }
    }
    return {claimed: due.size, completed};
  }

  // Finish a run with lease-checked terminal state.
  async function closeRun(plan, status, counters = {}) {
    await db.runTransaction(async (transaction) => {
      const run = (await transaction.get(plan.runReference)).data();
      if (!run || run.lease !== plan.lease) return;
      if (!OPEN_RUN_STATES.has(run.status)) return;
      transaction.update(plan.runReference, {
        status,
        counters,
        finishedAt: Date.now(),
      });
      transaction.update(plan.recipeRef, {
        currentRunId: null,
        currentRunLease: null,
        currentDueAt: null,
        updatedAt: Date.now(),
      });
    });
  }

  async function abortRun(plan, reason) {
    await db.runTransaction(async (transaction) => {
      const run = (await transaction.get(plan.runReference)).data();
      if (!run || run.lease !== plan.lease || !OPEN_RUN_STATES.has(run.status)) return;
      transaction.update(plan.runReference, {
        status: "failed",
        error: reason,
        finishedAt: Date.now(),
      });
      transaction.update(plan.recipeRef, {
        currentRunId: null,
        currentRunLease: null,
        currentDueAt: null,
        updatedAt: Date.now(),
      });
    });
  }

  // Pause and surface a durable exception; leaves the claimed run terminal.
  async function pauseRecipe(plan, {message, action, type, scope}) {
    const recipeSnapshot = await plan.recipeRef.get();
    if (recipeSnapshot.exists) {
      await writeException(
          {id: plan.recipeId, ...recipeSnapshot.data()},
          type,
          scope,
          message,
          action,
          {runId: plan.runReference.id},
      );
    }
    await db.runTransaction(async (transaction) => {
      const fresh = (await transaction.get(plan.recipeRef)).data();
      if (!fresh) return;
      transaction.update(plan.recipeRef, {
        enabled: false,
        status: "paused",
        pauseReason: message,
        nextRunAt: null,
        currentRunId: null,
        currentRunLease: null,
        currentDueAt: null,
        updatedAt: Date.now(),
      });
    });
    await closeRun(plan, "paused", {});
  }

  async function executeRun(plan, now) {
    const recipe = (await plan.recipeRef.get()).data();
    const recipeHandle = {id: plan.recipeId, ...recipe};

    // Boundary: stable source availability.
    const connection = await db
        .collection("workspaceSheets")
        .doc(recipe.connectionId)
        .get();
    if (!connection.exists || connection.data().uid !== recipe.uid) {
      await pauseRecipe(plan, {
        type: "source_disconnected",
        scope: recipe.connectionId,
        message: "The spreadsheet connection was removed. Reconnect and re-approve to resume automation.",
        action: "Reconnect in Sources & connections, then preview and enable the recipe again.",
      });
      return;
    }

    let data;
    try {
      data = await sheets.read(connection.data().spreadsheetId, recipe.tabId);
    } catch (error) {
      await pauseRecipe(plan, {
        type: "source_disconnected",
        scope: recipe.connectionId,
        message: "The source could not be read. Check that the service account still has Viewer access.",
        action: "Restore access, then preview and re-enable the recipe.",
      });
      return;
    }

    // Schema mismatch means identity columns may no longer be trustworthy.
    if (schemaFingerprint(data.headers.slice(0, 100)) !== recipe.headersHash) {
      await pauseRecipe(plan, {
        type: "schema_drift",
        scope: recipe.headersHash,
        message: "The source headings changed after approval. The mapping can no longer be trusted.",
        action: "Preview the recipe again and confirm the new structure.",
      });
      return;
    }
    if (data.hasMore) {
      await pauseRecipe(plan, {
        type: "source_too_large",
        scope: "bounds",
        message: "The tab exceeds the bounded automation reader. Only a subset would be checked, so cooking was declined.",
        action: "Split the tab into smaller ranges before enabling automation.",
      });
      return;
    }

    const {records, invalid} = normalizeRecords(
        data.rows,
        recipe.mapping,
        recipe.sourceIdColumn,
    );
    for (const issue of invalid) {
      await writeException(recipeHandle, issue.kind, `row-${issue.row}`,
          issue.kind === "missing_source_id" ?
            "A source row has no value in the record-ID column. The row was skipped; nothing was imported." :
            "Two or more rows share the same record ID. Only the first was considered; the rest were skipped.",
          "Add a unique value in the record-ID column, then the next source check will revisit that row.",
          {runId: plan.runReference.id});
    }

    const known = new Map();
    for (let offset = 0; offset < records.length; offset += 200) {
      const refs = records
          .slice(offset, offset + 200)
          .map((entry) => recordRef(plan.recipeId, entry.key));
      const snapshots = await db.getAll(...refs);
      snapshots.forEach((snapshot, index) => {
        if (snapshot.exists) known.set(records[offset + index].key, snapshot.data());
      });
    }
    const {added, changed} = diffRecords(records, known);

    for (const entry of changed) {
      await db.runTransaction(async (transaction) => {
        const current = (await transaction.get(recordRef(plan.recipeId, entry.key))).data();
        if (!current || current.contentHash === entry.contentHash) return;
        transaction.update(recordRef(plan.recipeId, entry.key), {
          state: "changed",
          latestContentHash: entry.contentHash,
          lastSeenAt: Date.now(),
          lastRunId: plan.runReference.id,
        });
      });
      await writeException(
          recipeHandle,
          "record_edited",
          entry.key,
          "A source record changed after approval. The saved inquiry keeps the original content; nothing was overwritten or re-charged.",
          // No retry action exists, so the hint must describe only what the owner can
          // actually do: acknowledge the record or ignore it. The saved inquiry
          // is never overwritten, so there is no data-loss urgency here.
          "Review this record in the exception inbox. The saved inquiry keeps its original content. Acknowledge it once reviewed, or ignore it to stop it being raised again.",
          {runId: plan.runReference.id, recordKey: entry.key},
      );
    }

    // Baseline policy: mark pre-existing rows seen once, then only future
    // additions import. Never silently classify an existing backlog.
    if (recipe.initialPolicy === "baseline" && !recipe.baselineAppliedAt) {
      for (let offset = 0; offset < records.length; offset += 400) {
        const batch = db.batch();
        records.slice(offset, offset + 400).forEach((entry) => {
          batch.set(
              recordRef(plan.recipeId, entry.key),
              {
                recipeId: plan.recipeId,
                sourceKey: entry.key,
                contentHash: entry.contentHash,
                latestContentHash: entry.contentHash,
                state: "baseline",
                inquiryId: null,
                firstSeenAt: now,
                lastSeenAt: now,
                lastRunId: plan.runReference.id,
              },
              {merge: true},
          );
        });
        await batch.commit();
      }
      await plan.recipeRef.update({
        baselineAppliedAt: now,
        lastRunAt: now,
        lastSuccessfulRunAt: now,
        updatedAt: now,
      });
      await closeRun(plan, "baseline_done", {
        scanned: records.length,
        added: 0,
        changed: changed.length,
        invalid: invalid.length,
        dispatched: 0,
      });
      return;
    }

    if (!added.length) {
      await plan.recipeRef.update({
        lastRunAt: now,
        lastSuccessfulRunAt: now,
        updatedAt: now,
      });
      await closeRun(plan, "no_changes", {
        scanned: records.length,
        added: 0,
        changed: changed.length,
        invalid: invalid.length,
        dispatched: 0,
      });
      return;
    }

    // Import-only reuse of the shared service: dedupe against the workspace
    // and respect plan/quotas through the existing startJob transaction.
    const candidates = data.rows.filter((row) =>
      added.some(
          (entry) => entry.key === String(row[recipe.sourceIdColumn] ?? "").trim(),
      ),
    );
    const prepared = await service.prepare(
        recipe.uid,
        {...data, rows: candidates},
        recipe.mapping,
    );
    if (!prepared.rows.length) {
      // Every added key was already captured in the workspace; remember that
      // so the next run does not surface them as new again.
      for (let offset = 0; offset < added.length; offset += 400) {
        const batch = db.batch();
        added.slice(offset, offset + 400).forEach((entry) => {
          batch.set(recordRef(plan.recipeId, entry.key), {
            recipeId: plan.recipeId,
            sourceKey: entry.key,
            contentHash: entry.contentHash,
            latestContentHash: entry.contentHash,
            state: "already_imported",
            inquiryId: null,
            firstSeenAt: now,
            lastSeenAt: now,
            lastRunId: plan.runReference.id,
          }, {merge: true});
        });
        await batch.commit();
      }
      await plan.recipeRef.update({lastRunAt: now, lastSuccessfulRunAt: now, updatedAt: now});
      await closeRun(plan, "no_changes", {
        scanned: records.length,
        added: added.length,
        changed: changed.length,
        invalid: invalid.length,
        dispatched: 0,
      });
      return;
    }

    // Re-check the claim before spending. A mid-run pause or disconnect must
    // stop new dispatch.
    const liveRecipe = (await plan.recipeRef.get()).data();
    if (!liveRecipe.enabled || liveRecipe.currentRunLease !== plan.lease) {
      await abortRun(plan, "run_interrupted");
      return;
    }

    const day = budgetDay(now, recipe.budgetTimezone);
    const analysisPlanned = recipe.mode === "analyze";
    const budgetGate = await db.runTransaction(async (transaction) => {
      const budget = (await transaction.get(budgetRef(plan.recipeId, day))).data() || {
        day, reserved: 0, settled: 0,
      };
      const remaining = recipe.dailyCreditCap - (budget.reserved || 0) - (budget.settled || 0);
      if (analysisPlanned && remaining <= 0) return {allowed: 0, budget};
      const allowed = Math.min(
          prepared.rows.length,
          recipe.rowCap,
          analysisPlanned ? remaining : Number.MAX_SAFE_INTEGER,
      );
      if (analysisPlanned && allowed > 0) {
        transaction.set(
            budgetRef(plan.recipeId, day),
            {...budget, reserved: (budget.reserved || 0) + allowed, updatedAt: now},
            {merge: true},
        );
      }
      return {allowed, budget};
    });
    if (analysisPlanned && budgetGate.allowed === 0) {
      const scope = `${recipe.id}:${day}`;
      await writeException(
          recipeHandle,
          "budget_exhausted",
          scope,
          "The daily automation budget is used up. New source rows stay queued in the source; nothing was imported or charged.",
          "Raise the recipe's daily credit budget or wait for the next budget day.",
          {runId: plan.runReference.id},
      );
      await plan.recipeRef.update({lastRunAt: now, updatedAt: now});
      await closeRun(plan, "budget_blocked", {
        scanned: records.length,
        added: added.length,
        changed: changed.length,
        invalid: invalid.length,
        dispatched: 0,
      });
      return;
    }

    let jobId = null;
    try {
      const result = await service.startJob(
          recipe.uid,
          {
            // startJob re-validates the mapping and maps the rows itself, so
            // it needs the original source headers and raw source rows, not
            // the already-mapped rows prepared above.
            headers: data.headers,
            rows: candidates,
            title: `${recipe.name} (auto)`,
            snapshot: data.snapshot,
          },
          recipe.mapping,
          budgetGate.allowed,
          `auto-${plan.recipeId.slice(0, 12)}-${plan.runReference.id}`,
          recipe.spreadsheetId,
          recipe.mode,
      );
      jobId = result.id;
    } catch (error) {
      // Plan/quota exhaustion must not silently continue or upgrade the plan.
      if (error?.status === 429 || error?.status === 402) {
        const dayScope = `${plan.recipeId}:${day}`;
        await writeException(
            recipeHandle,
            "budget_exhausted",
            dayScope,
            error.status === 402 ?
              "The plan has expired. New automatic imports pause until it is reactivated." :
              "The plan's inquiry or credit allowance is exhausted for this period. Automatic imports pause until capacity frees.",
            "Adjust the plan or the recipe, or wait for the next billing period.",
            {runId: plan.runReference.id},
        );
        if (error.status === 402) {
          await db.runTransaction(async (transaction) => {
            const fresh = (await transaction.get(plan.recipeRef)).data();
            if (!fresh) return;
            transaction.update(plan.recipeRef, {
              enabled: false,
              status: "paused",
              pauseReason: "Plan expired.",
              nextRunAt: null,
              updatedAt: Date.now(),
            });
          });
        }
        await abortRun(plan, "quota_exhausted");
        return;
      }
      if (error?.status === 503) {
        await writeException(
            recipeHandle,
            "workflow_unavailable",
            plan.recipeId,
            "Analysis is not configured for this recipe's provider. New rows were not dispatched.",
            "Configure the analysis workflow or switch the recipe to import-only.",
            {runId: plan.runReference.id},
        );
        await abortRun(plan, "workflow_unavailable");
        return;
      }
      throw error;
    }

    // Persist record checkpoints only after the job durably accepted them, so
    // interrupted runs cannot silently lose rows. The run document records the
    // source key to row-number mapping so settlement can attach inquiry IDs
    // without storing customer content.
    const jobRowsDispatched = prepared.rows.slice(0, budgetGate.allowed).map((row) => ({
      key: added.find((entry) => entry.rowNumber === row.row)?.key || "",
      row: row.row,
    }));
    for (let offset = 0; offset < jobRowsDispatched.length; offset += 400) {
      const batch = db.batch();
      jobRowsDispatched.slice(offset, offset + 400).forEach(({key, row}) => {
        if (!key) return;
        batch.set(
            recordRef(plan.recipeId, key),
            {
              recipeId: plan.recipeId,
              sourceKey: key,
              contentHash: added.find((entry) => entry.key === key).contentHash,
              latestContentHash: added.find((entry) => entry.key === key).contentHash,
              state: "queued",
              inquiryId: null,
              jobId,
              rowNumber: row,
              firstSeenAt: now,
              lastSeenAt: now,
              lastRunId: plan.runReference.id,
            },
            {merge: true},
        );
      });
      await batch.commit();
    }

    await plan.runReference.update({jobId, dispatchedKeys: jobRowsDispatched});
    await plan.recipeRef.update({
      lastRunAt: now,
      lastRunJobId: jobId,
      lastRunId: plan.runReference.id,
      updatedAt: now,
    });
    await closeRun(plan, "dispatched", {
      scanned: records.length,
      added: added.length,
      changed: changed.length,
      invalid: invalid.length,
      dispatched: budgetGate.allowed,
    });
  }

  // Reconcile terminal jobs. Order matters: decide about a bounded retry
  // first; only settle the budget when the job is truly done. A job is
  // banked at most once via its settledJobs marker, so a retry loop can
  // never double-release or double-settle it.
  async function settle(pass = Date.now()) {
    if (!AUTOMATION_ENABLED) return {settled: 0};
    const pending = await recipes
        .where("enabled", "==", true)
        .where("lastRunJobId", ">", "")
        .limit(50)
        .get();
    let settled = 0;
    for (const snapshot of pending.docs) {
      const recipe = {id: snapshot.id, ...snapshot.data()};
      const jobId = recipe.lastRunJobId;
      const jobSnapshot = await db.collection("workspaceJobs").doc(jobId).get();
      if (!jobSnapshot.exists) {
        await snapshot.ref.update({lastRunJobId: null, lastRunId: null, updatedAt: Date.now()});
        continue;
      }
      const job = jobSnapshot.data();
      if (!TERMINAL.has(job.status)) continue;

      const runDoc = await lastRunDoc(snapshot.ref, recipe);
      const dayKey = budgetDay(job.finishedAt || pass, recipe.budgetTimezone);
      const budgetReference = budgetRef(snapshot.id, dayKey);
      const alreadySettled = await budgetReference.get().then((s) => (s.data()?.settledJobs || {})[jobId] === true);

      const canRetry =
        job.mode === "analyze" &&
        (job.failed || 0) > 0 &&
        !!process.env.MAKE_WEBHOOK_URL;

      if (canRetry && !alreadySettled) {
        const attempts = await db.runTransaction(async (transaction) => {
          const fresh = (await transaction.get(snapshot.ref)).data();
          const byJob = fresh.jobAttempts || {};
          const count = byJob[jobId] || 0;
          if (count >= MAX_AUTO_RETRIES) return -1;
          transaction.update(snapshot.ref, {
            jobAttempts: {...byJob, [jobId]: count + 1},
            updatedAt: Date.now(),
          });
          return count + 1;
        });
        if (attempts > 0) {
          try {
            await service.retry(recipe.uid, jobId);
            continue; // job is non-terminal again; settle it on the next pass
          } catch (error) {
            if (error?.status === 503) {
              await writeException(
                  recipe,
                  "workflow_unavailable",
                  jobId,
                  "Analysis is not configured, so the scheduled retry could not run. Nothing was charged.",
                  "Configure the analysis workflow and retry the failed rows manually.",
                  {jobId},
              );
            }
            // Fall through and settle: the job is not retrying.
          }
        } else {
          await writeException(
              recipe,
              "workflow_failure",
              jobId,
              `${job.failed} rows could not be classified after ${MAX_AUTO_RETRIES} automatic retries. No additional credits were consumed.`,
              "Retry the failed rows from the job details, or acknowledge the failure.",
              {jobId},
          );
        }
      }

      if (!alreadySettled) {
        await db.runTransaction(async (transaction) => {
          const budget = (await transaction.get(budgetReference)).data() || {
            day: dayKey,
            reserved: 0,
            settled: 0,
          };
          const settledJobs = budget.settledJobs || {};
          if (settledJobs[jobId]) return;
          const used = job.mode === "analyze" ? job.succeeded || 0 : 0;
          transaction.set(
              budgetReference,
              {
                ...budget,
                reserved: Math.max(0, (budget.reserved || 0) - (job.total || 0)),
                settled: (budget.settled || 0) + used,
                settledJobs: {...settledJobs, [jobId]: true},
                updatedAt: Date.now(),
              },
              {merge: true},
          );
        });
      }
      await reconcileRecords(snapshot.id, recipe, job, runDoc);
      await snapshot.ref.update({
        lastRunJobId: null,
        lastRunId: null,
        lastSuccessfulRunAt: job.finishedAt || Date.now(),
        updatedAt: Date.now(),
      });
      settled++;
    }
    return {settled};
  }

  async function lastRunDoc(recipeReference, recipe) {
    if (!recipe.lastRunId) return null;
    const snapshot = await recipeReference.collection("runs").doc(recipe.lastRunId).get();
    return snapshot.exists ? snapshot : null;
  }

  // Attach row outcomes to durable per-record state using the run's recorded
  // sourceKey map; only this run's dispatched rows are touched.
  async function reconcileRecords(recipeId, recipe, job, runDoc) {
    if (!runDoc) return;
    const dispatched = runDoc.data().dispatchedKeys || [];
    if (!dispatched.length) return;
    const rowToKey = new Map(dispatched.map((entry) => [entry.row, entry.key]));
    const rows = await db
        .collection("workspaceJobs")
        .doc(recipe.lastRunJobId)
        .collection("rows")
        .get();
    for (const snapshot of rows.docs) {
      const key = rowToKey.get(snapshot.data().row);
      if (!key) continue;
      const reference = recordRef(recipeId, key);
      await db.runTransaction(async (transaction) => {
        const current = (await transaction.get(reference)).data();
        if (!current || current.jobId !== recipe.lastRunJobId) return;
        transaction.update(reference, {
          state:
            snapshot.data().status === "completed" ? "imported" :
            snapshot.data().status === "skipped" ? "already_imported" :
            "failed",
          inquiryId: snapshot.data().inquiryId || null,
          lastSeenAt: Date.now(),
        });
      });
    }
  }

  // Recover runs that were claimed by a crashed worker: lease expired (the
  // recipe's nextRunAt was already advanced, so no duplicate run exists), the
  // run doc is still open, and any in-flight job the run dispatched will be
  // recovered by workspace.recover() releasing only its own reservations.
  async function recoverStaleRuns(now = Date.now()) {
    if (!AUTOMATION_ENABLED) return {recovered: 0};
    const stuck = await recipes
        .where("enabled", "==", true)
        .where("currentDueAt", "<=", now)
        .limit(25)
        .get();
    let recovered = 0;
    for (const snapshot of stuck.docs) {
      const recipe = {id: snapshot.id, ...snapshot.data()};
      if (!recipe.currentRunId || !recipe.currentRunLease) continue;
      // Only recover leases that have survived less than the cap + buffer, so
      // we do not marketuary double-hire during normal slow runs.
      const plan = {
        recipeRef: snapshot.ref,
        recipeId: snapshot.id,
        lease: recipe.currentRunLease,
        runReference: snapshot.ref.collection("runs").doc(recipe.currentRunId),
      };
      const run = await plan.runReference.get();
      if (run.exists && OPEN_RUN_STATES.has(run.data().status)) {
        await abortRun(plan, "lease_expired_resume_scheduled_next_poll");
        recovered++;
      } else if (!run.exists) {
        await plan.recipeRef.update({
          currentRunId: null,
          currentRunLease: null,
          currentDueAt: null,
          updatedAt: Date.now(),
        });
        recovered++;
      }
    }
    return {recovered};
  }

  // Owner-triggered run: authenticated, rate-limited upstream, sharing the
  // same lease and limits as the scheduler. Not a public scheduler endpoint.
  async function runNow(uid, recipeId) {
    const snapshot = await recipes.doc(recipeId).get();
    if (!snapshot.exists || snapshot.data().uid !== uid) {
      throw fail(404, "Recipe not found.");
    }
    const recipe = snapshot.data();
    if (!recipe.enabled || recipe.status !== "active") {
      throw fail(409, "This recipe is paused. Enable it before running now.");
    }
    if (recipe.currentRunLease) {
      throw fail(409, "A run is already in progress.");
    }
    const now = Date.now();
    await snapshot.ref.update({nextRunAt: now});
    const claimResult = await claim(snapshot, now);
    if (!claimResult) throw fail(409, "A run is already in progress.");
    try {
      await executeRun(claimResult, now);
      const run = (await claimResult.runReference.get()).data();
      return {
        id: claimResult.runReference.id,
        status: run.status,
        counters: run.counters || {},
        jobId: run.jobId || null,
      };
    } catch (error) {
      await abortRun(claimResult, "run_failed");
      throw error;
    }
  }

  return {
    scanDue,
    settle,
    recoverStaleRuns,
    runNow,
  };
}

module.exports = {
  automationService,
  AUTOMATION_ENABLED,
  MAX_AUTO_RETRIES,
  normalizeRecords,
  diffRecords,
};
