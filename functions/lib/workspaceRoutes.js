const express = require("express");
const crypto = require("node:crypto");
const {workspaceService} = require("./workspace");
const {billingService} = require("./billing");
const {importRecipesService} = require("./importRecipes");
const {automationService} = require("./automation");
const sheets = require("./sheetWorkspace");
const googleSheets = require("./googleSheets");
const {readUpload} = require("./uploadWorkspace");
const {fail, entitlement, fingerprint} = require("./plans");
const {listInquiries} = require("./inquiries");
const {findKeyOwner, keyMetadata, manageKey} = require("./apiKeys");

function workspaceRoutes(db, auth) {
  const router = express.Router();
  const service = workspaceService(db);
  const recipes = importRecipesService(db, service, sheets);
  const automation = automationService(db, service, sheets);
  const billing = billingService(db, service);
  const route = (method, path, handler, authenticated = true) =>
    router[method](path, async (req, res) => {
      try {
        let uid = null;
        if (authenticated) {
          const token = /^Bearer (.+)$/.exec(
              req.headers.authorization || "",
          )?.[1];
          if (!token) throw fail(401, "Sign in to continue.");
          try {
            uid = (await auth.verifyIdToken(token, true)).uid;
          } catch {
            throw fail(401, "Your session has expired. Sign in again.");
          }
          await rateLimit(`workspace:${uid}`, 300);
        }
        const output = await handler(req, uid, res);
        if (!res.headersSent) res.json(output);
      } catch (error) {
        const status =
          Number(error.status) ||
          (Number(error.code) === 403 ?
            403 :
            Number(error.code) === 404 ?
              404 :
              500);
        if (status >= 500) {
          console.error(JSON.stringify({event: "workspace_error", requestId: req.requestId, status}));
        }
        if (!res.headersSent) {
          res
              .status(status >= 400 && status <= 599 ? status : 500)
              .json({
                error: error.status ?
                error.message :
                status === 403 ?
                  "Access denied. Check the spreadsheet sharing permissions." :
                  "The request could not be completed. Retry or check the service connection.",
              });
        }
      }
    });

  async function owned(collection, id, uid) {
    if (typeof id !== "string" || !/^[a-zA-Z0-9_-]{1,150}$/.test(id)) {
      throw fail(400, "Invalid record ID.");
    }
    const snapshot = await db.collection(collection).doc(id).get();
    if (!snapshot.exists || snapshot.data().uid !== uid) {
      throw fail(404, "Record not found.");
    }
    return snapshot;
  }

  async function rateLimit(key, maximum) {
    const reference = db
        .collection("workspaceRateLimits")
        .doc(fingerprint(key));
    await db.runTransaction(async (transaction) => {
      const current = (await transaction.get(reference)).data();
      const count = current?.until > Date.now() ? current.count : 0;
      if (count >= maximum) {
        throw fail(429, "Too many requests. Please wait a minute.");
      }
      transaction.set(reference, {
        count: count + 1,
        until: current?.until > Date.now() ? current.until : Date.now() + 60000,
      });
    });
  }

  route("get", "/api/workspace/usage", (req, uid) => service.usage(uid));
  route("get", "/api/workspace/inquiries", (req, uid) => listInquiries(db, uid, req.query));
  route("post", "/api/onboarding/generate-key", async (req, uid) => {
    if (
      req.body?.businessName !== undefined &&
      (typeof req.body.businessName !== "string" ||
        !req.body.businessName.trim() ||
        req.body.businessName.length > 180)
    ) {
      throw fail(
          400,
          "Business name must be a non-empty string of at most 180 characters.",
      );
    }
    await rateLimit(`key:${uid}`, 10);
    const result = await manageKey(db, uid, req.body?.businessName?.trim());
    return {...result, plan: (await service.usage(uid)).plan};
  });
  route("get", "/api/workspace/key", (req, uid) => keyMetadata(db, uid));
  route("post", "/api/workspace/key/rotate", async (req, uid) => {
    await rateLimit(`key-rotate:${uid}`, 5);
    return manageKey(db, uid, "", "rotate");
  });
  route("delete", "/api/workspace/key", async (req, uid) => {
    await rateLimit(`key-revoke:${uid}`, 5);
    return manageKey(db, uid, "", "revoke");
  });
  route("get", "/api/workspace/plans", () => billing.plans());
  route("post", "/api/workspace/checkout", (req, uid) =>
    billing.checkout(uid, req.body.plan),
  );
  route("post", "/api/workspace/cancel-subscription", (req, uid) =>
    billing.cancel(uid),
  );
  route("get", "/api/workspace/invoices", (req, uid) => billing.invoices(uid));
  route("post", "/api/billing/webhook", (req) => billing.webhook(req), false);

  route("get", "/api/workspace/settings", async (req, uid) => ({
    criteria:
      (await db.collection("workspaceSettings").doc(uid).get()).data()
          ?.criteria || "",
  }));
  route("put", "/api/workspace/settings", async (req, uid) => {
    if (
      typeof req.body.criteria !== "string" ||
      req.body.criteria.length > 4000
    ) {
      throw fail(
          400,
          "Qualification criteria must be 4,000 characters or fewer.",
      );
    }
    await db
        .collection("workspaceSettings")
        .doc(uid)
        .set({criteria: req.body.criteria.trim(), updatedAt: Date.now()});
    return {success: true};
  });

  route("get", "/api/workspace/sheets", async (req, uid) => ({
    connections: (
      await db.collection("workspaceSheets").where("uid", "==", uid).get()
    ).docs.map((doc) => ({id: doc.id, ...doc.data()})),
    serviceAccountEmail: await googleSheets.getServiceAccountEmail(),
  }));
  route("post", "/api/workspace/sheets/challenge", async (req, uid) => {
    await rateLimit(`sheet-challenge:${uid}`, 10);
    const spreadsheetId = googleSheets.extractSpreadsheetId(
        req.body.spreadsheetId,
    );
    const id = fingerprint([uid, spreadsheetId]);
    const token = crypto.randomBytes(16).toString("hex");
    await db
        .collection("sheetChallenges")
        .doc(id)
        .set({uid, spreadsheetId, token, expiresAt: Date.now() + 15 * 60000});
    return {
      id,
      token,
      serviceAccountEmail: await googleSheets.getServiceAccountEmail(),
    };
  });
  route("post", "/api/workspace/sheets/connect", async (req, uid) => {
    await rateLimit(`sheet-connect:${uid}`, 10);
    const challenge = await owned("sheetChallenges", req.body.challengeId, uid);
    const data = challenge.data();
    if (data.expiresAt < Date.now()) {
      throw fail(400, "This verification code expired. Request another code.");
    }
    const metadata = await sheets.proveAccess(data.spreadsheetId, data.token);
    await service.subscription(uid);
    await db.runTransaction(async (transaction) => {
      const sub = (
        await transaction.get(db.collection("subscriptions").doc(uid))
      ).data();
      const access = entitlement(sub);
      if (!access.active) {
        throw fail(402, "An active plan is needed to add connections.");
      }
      const connections = await transaction.get(
          db.collection("workspaceSheets").where("uid", "==", uid),
      );
      const reference = db
          .collection("workspaceSheets")
          .doc(fingerprint([uid, data.spreadsheetId]));
      const claimRef = db.collection("sheetClaims").doc(data.spreadsheetId);
      const claim = await transaction.get(claimRef);
      if (claim.exists && claim.data().uid !== uid) {
        throw fail(
            409,
            "This spreadsheet is already linked to another workspace.",
        );
      }
      if (
        !connections.docs.some((doc) => doc.id === reference.id) &&
        connections.size >= access.limits.sheets
      ) {
        throw fail(
            429,
            "Your plan's spreadsheet connection limit has been reached.",
        );
      }
      transaction.set(claimRef, {uid});
      transaction.set(reference, {
        uid,
        spreadsheetId: data.spreadsheetId,
        title: metadata.title,
        tabs: metadata.tabs,
        verifiedAt: Date.now(),
      });
      transaction.delete(challenge.ref);
    });
    return {success: true, title: metadata.title};
  });
  route("delete", "/api/workspace/sheets/:id", async (req, uid) => {
    const connection = await owned("workspaceSheets", req.params.id, uid);
    const running = await db
        .collection("workspaceJobs")
        .where("uid", "==", uid)
        .where("sheetId", "==", connection.data().spreadsheetId)
        .get();
    if (
      running.docs.some((doc) =>
        ["preparing", "preparing_retry", "running", "queued"].includes(
            doc.data().status,
        ),
      )
    ) {
      throw fail(
          409,
          "Wait for this sheet's jobs to finish before disconnecting.",
      );
    }
    const batch = db.batch();
    batch.delete(connection.ref);
    batch.delete(
        db.collection("sheetClaims").doc(connection.data().spreadsheetId),
    );
    await batch.commit();
    return {success: true};
  });

  route("post", "/api/workspace/uploads", async (req, uid) => {
    await rateLimit(`upload:${uid}`, 5);
    const data = await readUpload(req);
    const document = await db
        .collection("workspaceUploads")
        .add({uid, ...data, expiresAt: Date.now() + 3600000});
    return {uploadId: document.id, title: data.title, headers: data.headers};
  });

  async function sourceData(body, uid) {
    if (body.uploadId) {
      const snapshot = await owned("workspaceUploads", body.uploadId, uid);
      if (snapshot.data().expiresAt < Date.now()) {
        throw fail(400, "The upload preview expired. Upload the file again.");
      }
      return {...snapshot.data(), sheetId: null};
    }
    const connection = await owned("workspaceSheets", body.connectionId, uid);
    const data = await sheets.read(connection.data().spreadsheetId, body.tabId);
    return {...data, sheetId: connection.data().spreadsheetId};
  }

  route("post", "/api/workspace/preview", async (req, uid) => {
    await rateLimit(`preview:${uid}`, 10);
    const data = await sourceData(req.body, uid);
    if (!req.body.mapping?.message) {
      return {
        headers: data.headers,
        title: data.title,
        scanned: data.rows.length,
        hasMore: data.hasMore,
      };
    }
    if (
      !Object.values(req.body.mapping)
          .filter(Boolean)
          .every((header) => data.headers.includes(header))
    ) {
      throw fail(
          400,
          "The mapped columns have changed. Preview the source again.",
      );
    }
    const result = await service.prepare(uid, data, req.body.mapping);
    return {
      headers: data.headers,
      title: data.title,
      scanned: data.rows.length,
      hasMore: data.hasMore,
      snapshot: data.snapshot,
      eligible: result.eligible,
      skipped: result.skipped,
      duplicates: result.duplicates,
      quality: result.quality,
      issues: result.issues,
      issueCount: result.issueCount,
      sample: result.rows.slice(0, 5),
    };
  });
  route("post", "/api/workspace/jobs", async (req, uid) => {
    await rateLimit(`start:${uid}`, 10);
    const data = await sourceData(req.body, uid);
    if (req.body.snapshot !== data.snapshot) {
      throw fail(
          409,
          "The source changed after preview. Review a fresh preview before starting.",
      );
    }
    return service.startJob(
        uid,
        data,
        req.body.mapping,
        req.body.size,
        req.body.requestId,
        data.sheetId,
        req.body.mode,
    );
  });

  // Import recipes: saved, owner-approved mappings for repeated imports.
  // All recipe reads/writes stay server-side; client Firestore access to the
  // importRecipes collection is denied by default and also covered
  // explicitly in firestore.rules.
  route("get", "/api/workspace/recipes", (req, uid) => recipes.list(uid));
  route("post", "/api/workspace/recipes", async (req, uid) => {
    await rateLimit(`recipes-write:${uid}`, 30);
    return recipes.create(uid, req.body || {});
  });
  route("get", "/api/workspace/recipes/:id", (req, uid) =>
    recipes.get(uid, req.params.id),
  );
  route("patch", "/api/workspace/recipes/:id", async (req, uid) => {
    await rateLimit(`recipes-write:${uid}`, 30);
    return recipes.update(uid, req.params.id, req.body || {});
  });
  route("post", "/api/workspace/recipes/:id/preview", async (req, uid) => {
    await rateLimit(`preview:${uid}`, 10);
    return recipes.preview(uid, req.params.id);
  });
  route("post", "/api/workspace/recipes/:id/enable", async (req, uid) => {
    await rateLimit(`recipes-enable:${uid}`, 10);
    return recipes.enable(uid, req.params.id, req.body || {});
  });
  route("post", "/api/workspace/recipes/:id/pause", async (req, uid) => {
    await rateLimit(`recipes-write:${uid}`, 30);
    return recipes.pause(uid, req.params.id, req.body?.reason);
  });
  route("post", "/api/workspace/recipes/:id/apply", (req, uid) =>
    recipes.applyMapping(uid, req.params.id),
  );
  // Owner-triggered run. Shares claim/lease/limit logic with the scheduler;
  // not a public scheduler endpoint.
  route("post", "/api/workspace/recipes/:id/run-now", async (req, uid) => {
    await rateLimit(`recipes-run:${uid}`, 5);
    return automation.runNow(uid, req.params.id);
  });

  // Exception inbox: durable, owner-scoped, paginated review of automation
  // exceptions. Runtime state is never writable by clients.
  route("get", "/api/workspace/exceptions", async (req, uid) => {
    const state = ["open", "acknowledged", "resolved"].includes(req.query.state) ?
      req.query.state :
      "open";
    let query = db
        .collection("importExceptions")
        .where("uid", "==", uid)
        .where("state", "==", state)
        .orderBy("lastSeenAt", "desc")
        .limit(50);
    if (req.query.cursor) {
      const before = Number(req.query.cursor);
      if (Number.isFinite(before)) query = query.startAfter(before);
    }
    const snapshot = await query.get();
    const data = snapshot.docs.map((doc) => ({id: doc.id, ...doc.data()}));
    return {
      exceptions: data,
      nextCursor: data.length === 50 ? String(data[data.length - 1].lastSeenAt) : null,
    };
  });
  route("get", "/api/workspace/exceptions/:id", async (req, uid) => {
    if (typeof req.params.id !== "string" || !/^[a-zA-Z0-9_-]{8,200}$/.test(req.params.id)) {
      throw fail(400, "Invalid exception ID.");
    }
    const snapshot = await db.collection("importExceptions").doc(req.params.id).get();
    if (!snapshot.exists || snapshot.data().uid !== uid) {
      throw fail(404, "Exception not found.");
    }
    return {id: snapshot.id, ...snapshot.data()};
  });
  route("post", "/api/workspace/exceptions/:id/action", async (req, uid) => {
    if (typeof req.params.id !== "string" || !/^[a-zA-Z0-9_-]{8,200}$/.test(req.params.id)) {
      throw fail(400, "Invalid exception ID.");
    }
    const action = req.body?.action;
    if (!["acknowledge", "ignore"].includes(action)) {
      throw fail(400, "Choose acknowledge or ignore.");
    }
    const reference = db.collection("importExceptions").doc(req.params.id);
    return db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists || snapshot.data().uid !== uid) {
        throw fail(404, "Exception not found.");
      }
      if (snapshot.data().state === "resolved") {
        return {id: snapshot.id, state: "resolved"};
      }
      transaction.update(reference, {
        state: action === "acknowledge" ? "acknowledged" : "resolved",
        resolvedAt: action === "ignore" ? Date.now() : null,
        updatedAt: Date.now(),
      });
      return {id: snapshot.id, state: action === "acknowledge" ? "acknowledged" : "resolved"};
    });
  });
  route("get", "/api/workspace/jobs", async (req, uid) => ({
    jobs: (
      await db
          .collection("workspaceJobs")
          .where("uid", "==", uid)
          .orderBy("createdAt", "desc")
          .limit(30)
          .get()
    ).docs.map((doc) => ({id: doc.id, ...doc.data()})),
  }));
  route("get", "/api/workspace/jobs/:id", async (req, uid) => {
    const job = await owned("workspaceJobs", req.params.id, uid);
    const rows = await job.ref.collection("rows").orderBy("row").get();
    return {
      id: job.id,
      ...job.data(),
      rows: rows.docs.map((doc) => ({id: doc.id, ...doc.data()})),
    };
  });
  route("post", "/api/workspace/jobs/:id/retry", (req, uid) =>
    service.retry(uid, req.params.id),
  );
  route("post", "/api/workspace/jobs/:id/export", async (req, uid) => {
    const job = await owned("workspaceJobs", req.params.id, uid);
    if (!["completed", "partial", "failed"].includes(job.data().status)) {
      throw fail(409, "Wait for processing to finish before exporting.");
    }
    if (!job.data().sheetId) {
      throw fail(400, "Download this file import as CSV.");
    }
    await owned("workspaceSheets", fingerprint([uid, job.data().sheetId]), uid);
    const rows = await job.ref.collection("rows").orderBy("row").get();
    try {
      const result = await sheets.exportResults(
          job.data().sheetId,
          job.id,
          rows.docs.map((doc) => doc.data()),
      );
      await job.ref.update({
        exportStatus: "completed",
        exportTitle: result.title,
      });
      return result;
    } catch {
      await job.ref.update({exportStatus: "failed"});
      throw fail(
          502,
          "Export failed. Grant the service account Editor access and retry. Saved results and credits are unchanged.",
      );
    }
  });

  const intake = async (req, uid, res) => {
    await rateLimit(`intake-ip:${req.ip}`, 120);
    const key = req.headers["x-api-key"];
    if (typeof key !== "string" || key.length > 200) {
      throw fail(401, "A valid X-API-Key is required.");
    }
    const owner = await findKeyOwner(db, key);
    if (!owner) throw fail(401, "A valid X-API-Key is required.");
    if (req.params.webhookId && req.params.webhookId !== owner) {
      throw fail(403, "The key does not belong to this webhook.");
    }
    await rateLimit(`intake-owner:${owner}`, 120);
    res.status(202);
    return service.accept(
        owner,
        req.body,
        req.headers["idempotency-key"],
      req.params.webhookId ? "webhook" : "api",
    );
  };
  route("post", "/api/inquiries", intake, false);
  route("post", "/api/webhook/:webhookId", intake, false);
  route(
      "post",
      "/api/contact",
      async (req, uid, res) => {
        await rateLimit(`contact:${req.ip}`, 10);
        const owner = process.env.NODALX_OWNER_UID;
        if (!owner) throw fail(503, "Contact intake is not configured.");
        const {name, email, company, message} = req.body || {};
        if (
          [name, email, company, message].some(
              (value) => typeof value !== "string" || !value.trim(),
          ) ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
        ) {
          throw fail(
              400,
              "Name, valid email, company, and message are required.",
          );
        }
        res.status(202);
        return service.accept(
            owner,
            req.body,
            req.headers["idempotency-key"],
            "site_contact",
        );
      },
      false,
  );

  async function editInquiry(req, uid) {
    const reference = db.collection("inquiries").doc(req.params.id);
    const updates = {};
    if (req.body.status != null) {
      if (
        !["Pending", "Qualified", "Contacted", "Spam", "Won", "Lost"].includes(
            req.body.status,
        )
      ) {
        throw fail(400, "Invalid status.");
      }
      updates.status = req.body.status;
    }
    if (req.body.note != null) {
      if (typeof req.body.note !== "string" || req.body.note.length > 4000) {
        throw fail(400, "Notes must be 4,000 characters or fewer.");
      }
      updates.note = req.body.note;
    }
    if (req.body.followUpAt !== undefined) {
      if (
        req.body.followUpAt !== null &&
        (!Number.isFinite(req.body.followUpAt) || req.body.followUpAt < 0)
      ) {
        throw fail(400, "Invalid follow-up date.");
      }
      updates.followUpAt = req.body.followUpAt;
    }
    if (!Object.keys(updates).length) {
      throw fail(400, "No editable fields supplied.");
    }
    await db.runTransaction(async (transaction) => {
      const current = await transaction.get(reference);
      if (!current.exists || current.data().customerId !== uid) {
        throw fail(404, "Inquiry not found.");
      }
      transaction.update(reference, {...updates, updatedAt: new Date()});
      transaction.create(reference.collection("events").doc(), {
        at: Date.now(),
        changes: updates,
        previousStatus: current.data().status || "Unknown",
        actor: uid,
      });
    });
    return {success: true, ...updates};
  }
  route("patch", "/api/inquiries/:id/status", editInquiry);
  route("patch", "/api/workspace/inquiries/:id", editInquiry);
  route("post", "/api/workspace/inquiries/:id/analyze", (req, uid) =>
    service.analyzeInquiry(uid, req.params.id),
  );
  route("get", "/api/workspace/inquiries/:id/activity", async (req, uid) => {
    const reference = db.collection("inquiries").doc(req.params.id);
    const snapshot = await reference.get();
    if (!snapshot.exists || snapshot.data().customerId !== uid) {
      throw fail(404, "Inquiry not found.");
    }
    return {
      note: snapshot.data().note || "",
      followUpAt: snapshot.data().followUpAt || null,
      events: (
        await reference
            .collection("events")
            .orderBy("at", "desc")
            .limit(20)
            .get()
      ).docs.map((doc) => ({id: doc.id, ...doc.data()})),
    };
  });

  route("get", "/api/workspace/overview", async (req, uid) => {
    const days = [7, 30, 90].includes(Number(req.query.days)) ?
      Number(req.query.days) :
      30;
    const since = new Date(Date.now() - days * 86400000);
    const base = db
        .collection("inquiries")
        .where("customerId", "==", uid)
        .where("createdAt", ">=", since);
    const count = async (query) => (await query.count().get()).data().count;
    const total = await count(base);
    const statuses = {};
    for (const status of [
      "Pending",
      "Qualified",
      "Contacted",
      "Spam",
      "Won",
      "Lost",
    ]) {
      statuses[status] = await count(base.where("status", "==", status));
    }
    const processing = {};
    for (const status of [
      "classified",
      "failed",
      "awaiting_analysis",
      "queued",
      "processing",
    ]) {
      processing[status] = await count(
          base.where("processingStatus", "==", status),
      );
    }
    const sources = {};
    for (const source of [
      "api",
      "webhook",
      "google_sheets",
      "file_import",
      "site_contact",
    ]) {
      sources[source] = await count(base.where("source", "==", source));
    }
    sources.other = Math.max(
        0,
        total - Object.values(sources).reduce((sum, value) => sum + value, 0),
    );
    const overdue = await count(
        db
            .collection("inquiries")
            .where("customerId", "==", uid)
            .where("status", "in", ["Pending", "Qualified", "Contacted"])
            .where("followUpAt", ">", 0)
            .where("followUpAt", "<", Date.now()),
    );
    return {
      days,
      since: since.toISOString(),
      total,
      statuses,
      processing,
      sources,
      overdue,
      generatedAt: Date.now(),
    };
  });

  for (const path of [
    "/api/connectors/google-sheets/verify",
    "/api/connectors/google-sheets/analyze",
    "/api/analyze/upload",
  ]) {
    route("post", path, () => {
      throw fail(
          410,
          "Use Imports & processing to preview rows and start a metered job.",
      );
    });
  }
  route("post", "/api/user/redeem-key", () => {
    throw fail(
        410,
        "Integration API keys cannot activate subscriptions. Manage access in Usage & billing.",
    );
  });
  return {router, service};
}

module.exports = {workspaceRoutes};
