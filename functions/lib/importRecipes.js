// Firestore-backed persistent import recipes (Phase 2).
//
// A recipe is an owner-approved, UID-scoped description of a repeated Google
// Sheets import: which connection and tab, how columns map, the stable record
// identity column, and the automation budget. Customer rows and provider
// credentials are never stored on the recipe. Approvals are tracked
// server-side so a client cannot approve an identity the owner never actually
// previewed, and edits that touch identity invalidate the approval until the
// owner previews and confirms again.
const {fail} = require("./plans");
const {
  SCHEMA_VERSION,
  assertName,
  assertFrequency,
  assertMode,
  assertInitialPolicy,
  assertRowCap,
  assertDailyCreditCap,
  assertMapping,
  assertSourceIdColumn,
  assertTimeZone,
  schemaFingerprint,
  approvalKey,
} = require("./recipes");

const COLLECTION = "importRecipes";
const MAX_RECIPES_PER_WORKSPACE = 25;
const APPROVAL_TTL_MS = 15 * 60000; // preview approval is valid for 15 minutes

function importRecipesService(db, service, sheets) {
  const recipes = db.collection(COLLECTION);

  async function owned(id, uid) {
    if (typeof id !== "string" || !/^[a-zA-Z0-9_-]{1,64}$/.test(id)) {
      throw fail(400, "Invalid recipe ID.");
    }
    const snapshot = await recipes.doc(id).get();
    // Existence is not disclosed across workspaces: a wrong owner gets the
    // same 403 as a missing recipe gets a 404, both before data is read.
    if (!snapshot.exists) throw fail(404, "Recipe not found.");
    if (snapshot.data().uid !== uid) throw fail(403, "Recipe not found.");
    return snapshot;
  }

  // Validate the connection is owned by this workspace and read the sheet
  // through the existing bounded reader. Read/privilege problems surface as
  // actionable errors rather than empty success.
  async function readConnection(uid, connectionId, tabId) {
    const connectionPath = String(connectionId || "");
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(connectionPath)) {
      throw fail(400, "A valid connection ID is required.");
    }
    const connection = await db
        .collection("workspaceSheets")
        .doc(connectionPath)
        .get();
    if (!connection.exists || connection.data().uid !== uid) {
      throw fail(403, "Connect and verify this spreadsheet first.");
    }
    const tab = (connection.data().tabs || []).find(
        (candidate) => candidate.id === Number(tabId),
    );
    if (!tab) throw fail(400, "Select an existing sheet tab.");
    const data = await sheets.read(connection.data().spreadsheetId, tab.id);
    return {connection, tab, data};
  }

  // Mapping and identity always validate against headings read from the sheet
  // just now, never against client-supplied header lists.
  async function buildPayload(uid, body, usage) {
    const {connection, tab, data} = await readConnection(
        uid,
        body.connectionId,
        body.tabId,
    );
    const mapping = assertMapping(body.mapping, data.headers);
    const sourceIdColumn = assertSourceIdColumn(
        body.sourceIdColumn,
        data.headers,
    );
    return {
      uid,
      name: assertName(body.name),
      connectionId: connection.id,
      spreadsheetId: connection.data().spreadsheetId,
      tabId: tab.id,
      tabTitle: tab.title,
      mapping,
      sourceIdColumn,
      mode: assertMode(body.mode || "import"),
      frequencyMinutes: assertFrequency(body.frequencyMinutes ?? 1440),
      rowCap: assertRowCap(body.rowCap ?? 25, usage.limits),
      dailyCreditCap: assertDailyCreditCap(body.dailyCreditCap ?? 0, usage.limits),
      budgetTimezone: assertTimeZone(body.budgetTimezone || "UTC"),
      headers: data.headers.slice(0, 100),
      headersHash: schemaFingerprint(data.headers.slice(0, 100)),
      schemaVersion: SCHEMA_VERSION,
    };
  }

  async function create(uid, body) {
    const usage = await service.usage(uid);
    if (!usage.active) {
      throw fail(402, "An active plan is needed to save recipes.");
    }
    const existing = await recipes.where("uid", "==", uid).count().get();
    if (existing.data().count >= MAX_RECIPES_PER_WORKSPACE) {
      throw fail(
          429,
          `A workspace can keep at most ${MAX_RECIPES_PER_WORKSPACE} saved recipes.`,
      );
    }
    const payload = await buildPayload(uid, body, usage);
    const now = Date.now();
    const reference = recipes.doc();
    const record = {
      ...payload,
      enabled: false,
      status: "draft",
      pauseReason: null,
      initialPolicy: null,
      pendingApproval: null,
      approvedSnapshot: null,
      approvedAt: null,
      lastCheckAt: null,
      lastRunAt: null,
      lastRunJobId: null,
      nextRunAt: null,
      runCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    await reference.create(record);
    return {id: reference.id, ...record};
  }

  // pendingApproval is stripped from reads so a client cannot reuse, forge or
  // replay an approval grant.
  function sanitize(doc) {
    const {pendingApproval, ...rest} = doc.data();
    return {id: doc.id, ...rest};
  }

  async function list(uid) {
    const snapshot = await recipes
        .where("uid", "==", uid)
        .orderBy("updatedAt", "desc")
        .limit(50)
        .get();
    return {recipes: snapshot.docs.map(sanitize)};
  }

  async function get(uid, id) {
    return sanitize(await owned(id, uid));
  }

  // Edits that change identity invalidate approval and pause the recipe until
  // the owner previews and confirms again. Budget-only edits are allowed
  // without pausing so owners can tune cost ceilings safely.
  async function update(uid, id, body) {
    const snapshot = await owned(id, uid);
    const usage = await service.usage(uid);
    const current = snapshot.data();
    const payload = await buildPayload(uid, body, usage);
    const stillApproved =
      approvalKey({...current, ...payload}) === approvalKey(current);
    await db.runTransaction(async (transaction) => {
      const fresh = (await transaction.get(snapshot.ref)).data();
      if (!fresh) throw fail(404, "Recipe not found.");
      transaction.update(snapshot.ref, {
        ...payload,
        updatedAt: Date.now(),
        ...(stillApproved ?
          {} :
          {
            status: "paused",
            pauseReason: "Edited after approval. Preview and confirm to resume.",
            enabled: false,
            nextRunAt: null,
            pendingApproval: null,
            approvedSnapshot: null,
            approvedAt: null,
          }),
      });
    });
    return {id, stillApproved};
  }

  // Count stable-ID quality before any approval. Counts only: no customer
  // content is returned. Missing or duplicate IDs block enabling because
  // identity is load-bearing for change detection.
  function identityStats(rows, sourceIdColumn) {
    const seen = new Map();
    const missing = [];
    const duplicate = [];
    rows.forEach((row, index) => {
      const rowNumber =
        Number.isSafeInteger(row._rowIndex) && row._rowIndex >= 2 ?
          row._rowIndex :
          index + 2;
      const key = String(row[sourceIdColumn] ?? "").trim();
      if (!key) {
        missing.push(rowNumber);
      } else if (seen.has(key)) {
        duplicate.push(rowNumber);
      } else {
        seen.set(key, rowNumber);
      }
    });
    return {
      totalRows: rows.length,
      uniqueIds: seen.size,
      missing: missing.length,
      duplicate: duplicate.length,
      missingRows: missing.slice(0, 25),
      duplicateRows: duplicate.slice(0, 25),
      ready: missing.length === 0 && duplicate.length === 0,
    };
  }

  // Preview: re-read the source, validate identity and mapping, compute honest
  // enable consequences, and stash a short-lived server-side approval grant.
  async function preview(uid, id) {
    const snapshot = await owned(id, uid);
    const recipe = snapshot.data();
    const {data} = await readConnection(uid, recipe.connectionId, recipe.tabId);
    if (data.hasMore) {
      throw Object.assign(
          fail(
              413,
              "This tab has more rows than automated imports currently support. Split the tab before enabling; not every row would be checked.",
          ),
          {code: "source_too_large"},
      );
    }
    const identity = identityStats(data.rows, recipe.sourceIdColumn);
    if (!identity.ready) {
      throw Object.assign(
          fail(
              409,
              `${identity.missing + identity.duplicate} rows have missing or duplicate record IDs. Fix the source, then preview again.`,
          ),
          {code: "identity_invalid", identity},
      );
    }
    // The approval grant is only meaningful against a specific source
    // snapshot. Refuse to write a partial grant rather than persisting an
    // undefined value and failing later with an opaque storage error.
    if (typeof data.snapshot !== "string" || !data.snapshot) {
      throw fail(
          502,
          "The source could not be fingerprinted for approval. Try again in a moment.",
      );
    }
    const prepared = await service.prepare(uid, data, recipe.mapping);
    const grant = {
      approvalKey: approvalKey(recipe),
      snapshot: data.snapshot,
      eligibleCount: prepared.rows.length,
      grantedAt: Date.now(),
      expiresAt: Date.now() + APPROVAL_TTL_MS,
    };
    await snapshot.ref.update({
      pendingApproval: grant,
      lastCheckAt: Date.now(),
      updatedAt: Date.now(),
    });
    return {
      headers: data.headers,
      title: data.title,
      scanned: data.rows.length,
      hasMore: data.hasMore,
      snapshot: data.snapshot,
      eligible: prepared.rows.length,
      skipped: prepared.skipped,
      duplicates: prepared.duplicates,
      quality: prepared.quality,
      issueCount: prepared.issueCount,
      identity,
      // Honest budget statement so the owner can decide what enabling means.
      consequences: {
        eligibleNow: prepared.rows.length,
        perRunCap: recipe.rowCap,
        firstRunCreditEstimate:
          recipe.mode === "analyze" ?
            Math.min(prepared.rows.length, recipe.rowCap, recipe.dailyCreditCap) :
            0,
        dailyCreditCap: recipe.dailyCreditCap,
        frequencyMinutes: recipe.frequencyMinutes,
      },
      approvalExpiresAt: grant.expiresAt,
    };
  }

  function grantIsUsable(freshRecipe) {
    const grant = freshRecipe.pendingApproval;
    return (
      !!grant &&
      grant.expiresAt >= Date.now() &&
      grant.approvalKey === approvalKey(freshRecipe)
    );
  }

  // initialPolicy: the owner's explicit choice for existing rows:
  //  - "backlog": first run imports eligible existing rows, bounded by the
  //    per-run cap and daily credit budget, whichever is smaller.
  //  - "baseline": existing rows are marked seen; only future additions import.
  // Never silently classify the entire backlog.
  async function enable(uid, id, body) {
    const policy = assertInitialPolicy(body.initialPolicy);
    const usage = await service.usage(uid);
    if (!usage.active) {
      throw fail(402, "An active plan is needed to enable automation.");
    }
    const first = await owned(id, uid);
    const recipe = first.data();
    if (!grantIsUsable(recipe)) {
      throw fail(
          409,
          "Preview this recipe within 15 minutes before enabling it.",
      );
    }
    if (recipe.mode === "analyze" && recipe.dailyCreditCap < 1) {
      throw fail(
          400,
          "Analysis recipes need a daily credit budget of at least 1.",
      );
    }
    if (policy === "backlog" && recipe.pendingApproval.eligibleCount < 1) {
      throw fail(
          409,
          "No eligible existing rows to import. Choose future additions only.",
      );
    }
    await db.runTransaction(async (transaction) => {
      const fresh = (await transaction.get(snapshotFrom(first))).data();
      if (!fresh) throw fail(404, "Recipe not found.");
      if (!grantIsUsable(fresh)) {
        throw fail(
            409,
            "This recipe changed since the preview. Preview again before enabling.",
        );
      }
      transaction.update(first.ref, {
        enabled: true,
        status: "active",
        pauseReason: null,
        initialPolicy: policy,
        approvedSnapshot: fresh.pendingApproval.snapshot,
        approvedAt: Date.now(),
        pendingApproval: null,
        nextRunAt: Date.now(), // scheduler picks up on the next poll
        updatedAt: Date.now(),
      });
    });
    return {id, enabled: true, initialPolicy: policy};
  }

  async function pause(uid, id, reason) {
    if (reason !== undefined && reason !== null) {
      if (typeof reason !== "string" || reason.length > 200) {
        throw fail(400, "A pause reason must be 200 characters or fewer.");
      }
    }
    const snapshot = await owned(id, uid);
    await snapshot.ref.update({
      enabled: false,
      status: "paused",
      pauseReason: reason?.trim() || "Paused by owner.",
      nextRunAt: null,
      updatedAt: Date.now(),
    });
    return {id, status: "paused"};
  }

  // Apply a saved mapping for a one-off manual import of the same connection.
  // The manual preview/start pipeline still rechecks quota and dedupe.
  async function applyMapping(uid, id) {
    const recipe = (await owned(id, uid)).data();
    await readConnection(uid, recipe.connectionId, recipe.tabId);
    return {
      connectionId: recipe.connectionId,
      tabId: recipe.tabId,
      mapping: recipe.mapping,
      sourceIdColumn: recipe.sourceIdColumn,
    };
  }

  return {create, list, get, update, preview, enable, pause, applyMapping};
}

function snapshotFrom(snapshot) {
  return snapshot.ref;
}

module.exports = {importRecipesService, MAX_RECIPES_PER_WORKSPACE};
