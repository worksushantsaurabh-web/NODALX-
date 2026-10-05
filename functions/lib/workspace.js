const crypto = require("node:crypto");
const {
  fail,
  entitlement,
  trial,
  validateReservation,
  fingerprint,
  prepareRows,
  classificationFields,
} = require("./plans");

function workspaceService(db, workflowUrl = process.env.MAKE_WEBHOOK_URL) {
  const subscriptions = db.collection("subscriptions");
  const jobs = db.collection("workspaceJobs");
  const usageRef = (uid, period) =>
    db.collection("workspaceUsage").doc(uid).collection("periods").doc(period);

  async function subscription(uid) {
    const reference = subscriptions.doc(uid);
    return db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      if (snapshot.exists) return snapshot.data();
      const user = await transaction.get(db.collection("users").doc(uid));
      const now = Date.now();
      const initial =
        user.data()?.tier === "full" ?
          {
            plan: "starter",
            status: "legacy",
            periodStart: now,
            periodEnd: now + 30 * 86400000,
          } :
          trial(now);
      transaction.create(reference, {...initial, activeJobs: 0});
      return {...initial, activeJobs: 0};
    });
  }

  async function usage(uid) {
    const current = await subscription(uid);
    const access = entitlement(current);
    const snapshot = await usageRef(uid, access.period).get();
    const counters = {
      inquiries: 0,
      intakeReserved: 0,
      used: 0,
      reserved: 0,
      ...snapshot.data(),
    };
    return {
      plan: access.plan,
      status: access.status,
      active: access.active,
      limits: access.limits,
      periodStart: current.periodStart,
      periodEnd: current.periodEnd,
      cancelAtPeriodEnd: !!current.cancelAtPeriodEnd,
      legacy: current.status === "legacy",
      activeJobs: current.activeJobs || 0,
      ...counters,
      remaining: Math.max(
          0,
          access.limits.credits - counters.used - counters.reserved,
      ),
      workflowConfigured: !!workflowUrl,
    };
  }

  async function prepare(uid, data, mapping) {
    const headers = data.headers || Object.keys(data.rows[0] || {});
    if (!mapping || Object.values(mapping).filter(Boolean)
        .some((header) => !headers.includes(header))) {
      throw fail(400, "The mapped columns have changed. Preview the source again.");
    }
    const mapped = prepareRows(data.rows, mapping);
    const refs = mapped.eligible.map((row) =>
      db.collection("inquiries").doc(fingerprint([uid, row.fingerprint])),
    );
    const existing = new Set();
    for (let offset = 0; offset < refs.length; offset += 200) {
      const snapshots = await db.getAll(...refs.slice(offset, offset + 200));
      snapshots
          .filter((doc) => doc.exists)
          .forEach((doc) => existing.add(doc.id));
    }
    const rows = mapped.eligible.filter(
        (row) => !existing.has(fingerprint([uid, row.fingerprint])),
    );
    const existingIssues = mapped.eligible
        .filter((row) => existing.has(fingerprint([uid, row.fingerprint])))
        .map((row) => ({row: row.row, reason: "already_imported", action: "Already present in this workspace; the existing inquiry is retained."}));
    return {
      ...mapped,
      rows,
      eligible: rows.length,
      duplicates: mapped.duplicates + existing.size,
      issues: [...mapped.issues, ...existingIssues].slice(0, 100),
      issueCount: mapped.issues.length + existingIssues.length,
    };
  }

  async function startJob(uid, data, mapping, size, requestId, sheetId = null, mode = "analyze") {
    if (!["analyze", "import"].includes(mode)) {
      throw fail(400, "Choose import only or import and analyze.");
    }
    const analysis = mode === "analyze";
    if (analysis && !workflowUrl) {
      throw fail(
          503,
          "Analysis is not configured. Your existing inquiries remain available.",
      );
    }
    if (
      typeof requestId !== "string" ||
      !/^[a-zA-Z0-9_-]{8,100}$/.test(requestId)
    ) {
      throw fail(400, "A request ID is required.");
    }
    const reference = jobs.doc(fingerprint([uid, requestId]));
    const identity = [
      data.snapshot,
      mapping,
      Number(size),
      sheetId,
    ];
    if (!analysis) identity.push(mode);
    const inputHash = fingerprint(identity);
    const existingJob = await reference.get();
    if (existingJob.exists) {
      if (existingJob.data().inputHash !== inputHash) {
        throw fail(
            409,
            "This request ID was already used for different input.",
        );
      }
      return {id: reference.id, ...existingJob.data(), duplicate: true};
    }
    const prepared = await prepare(uid, data, mapping);
    const amount = Number(size);
    await subscription(uid);
    if (
      !Number.isInteger(amount) ||
      amount < 1 ||
      amount > prepared.rows.length
    ) {
      throw fail(400, "Select a batch size within the eligible row count.");
    }
    const rows = prepared.rows.slice(0, amount);
    const created = await db.runTransaction(async (transaction) => {
      const existing = await transaction.get(reference);
      if (existing.exists) {
        if (existing.data().inputHash !== inputHash) {
          throw fail(
              409,
              "This request ID was already used for different input.",
          );
        }
        return false;
      }
      const subRef = subscriptions.doc(uid);
      const sub = (await transaction.get(subRef)).data();
      const access = entitlement(sub);
      if (amount > access.limits.batchRows) {
        throw fail(
            400,
            `Your plan allows ${access.limits.batchRows} rows per job.`,
        );
      }
      const meter = usageRef(uid, access.period);
      const current = (await transaction.get(meter)).data() || {};
      validateReservation(
          {
            ...current,
            inquiries: (current.inquiries || 0) + (current.intakeReserved || 0),
            activeJobs: sub.activeJobs || 0,
          },
          access,
          amount,
          analysis ? amount : 0,
          1,
      );
      transaction.set(
          meter,
          {
            ...current,
            reserved: (current.reserved || 0) + (analysis ? amount : 0),
            intakeReserved: (current.intakeReserved || 0) + amount,
          },
          {merge: true},
      );
      transaction.update(subRef, {activeJobs: (sub.activeJobs || 0) + 1});
      transaction.create(reference, {
        uid,
        title: data.title,
        sheetId,
        mode,
        inputHash,
        period: access.period,
        total: amount,
        processed: 0,
        succeeded: 0,
        failed: 0,
        skipped: 0,
        status: "preparing",
        createdAt: Date.now(),
        dueAt: Date.now() + 600000,
        exportStatus: "not_requested",
      });
      return true;
    });
    if (created) {
      for (let offset = 0; offset < rows.length; offset += 200) {
        const batch = db.batch();
        rows
            .slice(offset, offset + 200)
            .forEach((row, index) =>
              batch.set(
                  reference
                      .collection("rows")
                      .doc(String(offset + index).padStart(4, "0")),
                  {...row, status: "queued", captured: false},
              ),
            );
        await batch.commit();
      }
      await reference.update({status: "queued", dueAt: Date.now()});
    }
    return {id: reference.id, ...(await reference.get()).data()};
  }

  async function accept(uid, input, requestId, source = "api") {
    await subscription(uid);
    if (
      !input.message ||
      typeof input.message !== "string" ||
      input.message.trim().length > 12000
    ) {
      throw fail(400, "A message of up to 12,000 characters is required.");
    }
    const fields = {};
    for (const field of [
      "name",
      "email",
      "company",
      "phone",
      "industry",
      "service",
    ]) {
      if (
        input[field] != null &&
        (typeof input[field] !== "string" || input[field].length > 500)
      ) {
        throw fail(400, `Invalid ${field}.`);
      }
      fields[field] = (input[field] || "").trim();
    }
    fields.email = fields.email.toLowerCase();
    fields.message = input.message.trim();
    if (requestId && (typeof requestId !== "string" || requestId.length > 128)) {
      throw fail(400, "Invalid Idempotency-Key.");
    }
    const reference = db
        .collection("inquiries")
        .doc(
        requestId ?
          fingerprint([uid, "intake", requestId]) :
          crypto.randomUUID(),
        );
    return db.runTransaction(async (transaction) => {
      const previous = await transaction.get(reference);
      if (previous.exists) {
        if (previous.data().inputHash !== fingerprint(fields)) {
          throw fail(
              409,
              "This Idempotency-Key belongs to different inquiry data.",
          );
        }
        return {
          accepted: true,
          duplicate: true,
          id: reference.id,
          processingStatus: previous.data().processingStatus,
        };
      }
      const subRef = subscriptions.doc(uid);
      const sub = (await transaction.get(subRef)).data();
      const access = entitlement(sub);
      const meter = usageRef(uid, access.period);
      const current = (await transaction.get(meter)).data() || {};
      validateReservation(
          {
            ...current,
            inquiries: (current.inquiries || 0) + (current.intakeReserved || 0),
          },
          access,
          1,
          0,
      );
      const canAnalyze =
        !!workflowUrl &&
        (current.used || 0) + (current.reserved || 0) < access.limits.credits &&
        (sub.activeJobs || 0) < access.limits.concurrentJobs;
      const status = canAnalyze ? "queued" : "awaiting_analysis";
      const now = Date.now();
      transaction.create(reference, {
        ...fields,
        customerId: uid,
        inputHash: fingerprint(fields),
        status: "Pending",
        processingStatus: status,
        source,
        createdAt: new Date(now),
        last_active: new Date(now).toISOString(),
      });
      transaction.set(
          meter,
          {
            ...current,
            inquiries: (current.inquiries || 0) + 1,
            reserved: (current.reserved || 0) + Number(canAnalyze),
          },
          {merge: true},
      );
      if (canAnalyze) {
        transaction.update(subRef, {activeJobs: (sub.activeJobs || 0) + 1});
        const job = jobs.doc(reference.id);
        transaction.create(job, {
          uid,
          title: `Inquiry from ${fields.name || "sender"}`,
          period: access.period,
          total: 1,
          processed: 0,
          succeeded: 0,
          failed: 0,
          skipped: 0,
          status: "queued",
          createdAt: now,
          dueAt: now,
          exportStatus: "not_requested",
        });
        transaction.create(job.collection("rows").doc("0000"), {
          ...fields,
          inquiryId: reference.id,
          row: 1,
          captured: true,
          status: "queued",
        });
      }
      return {accepted: true, id: reference.id, processingStatus: status};
    });
  }

  async function retry(uid, jobId) {
    const reference = jobs.doc(jobId);
    const snapshot = await reference.get();
    if (!snapshot.exists || snapshot.data().uid !== uid) {
      throw fail(404, "Job not found.");
    }
    if (!["completed", "partial", "failed"].includes(snapshot.data().status)) {
      throw fail(409, "Wait until this job finishes.");
    }
    if (snapshot.data().mode === "import") {
      throw fail(400, "Import-only jobs do not require classification retries. Analyze an imported inquiry separately.");
    }
    const failures = await reference
        .collection("rows")
        .where("status", "==", "failed")
        .get();
    if (!failures.size) throw fail(400, "There are no failed rows to retry.");
    if (!workflowUrl) throw fail(503, "Analysis is not configured.");
    await db.runTransaction(async (transaction) => {
      const job = (await transaction.get(reference)).data();
      if (!["completed", "partial", "failed"].includes(job.status)) {
        throw fail(409, "This job is already running.");
      }
      const subRef = subscriptions.doc(uid);
      const sub = (await transaction.get(subRef)).data();
      const access = entitlement(sub);
      const meter = usageRef(uid, access.period);
      const current = (await transaction.get(meter)).data() || {};
      validateReservation(
          {...current, activeJobs: sub.activeJobs || 0},
          access,
          0,
          failures.size,
          1,
      );
      transaction.set(
          meter,
          {...current, reserved: (current.reserved || 0) + failures.size},
          {merge: true},
      );
      transaction.update(subRef, {activeJobs: (sub.activeJobs || 0) + 1});
      transaction.update(reference, {
        status: "preparing_retry",
        period: access.period,
        dueAt: Date.now() + 600000,
        failed: 0,
        processed: job.processed - failures.size,
        retryCount: failures.size,
      });
    });
    for (let offset = 0; offset < failures.docs.length; offset += 200) {
      const batch = db.batch();
      failures.docs
          .slice(offset, offset + 200)
          .forEach((row) =>
            batch.update(row.ref, {status: "queued", error: ""}),
          );
      await batch.commit();
    }
    await reference.update({status: "queued", dueAt: Date.now()});
    return {id: jobId};
  }

  async function processJob(jobId) {
    const reference = jobs.doc(jobId);
    const lease = crypto.randomUUID();
    const job = await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists) return null;
      const current = snapshot.data();
      if (
        !["queued", "running"].includes(current.status) ||
        current.dueAt > Date.now()
      ) {
        return null;
      }
      transaction.update(reference, {
        status: "running",
        lease,
        dueAt: Date.now() + 180000,
      });
      return current;
    });
    if (!job) return;
    const rows = await reference
        .collection("rows")
        .where("status", "==", "queued")
        .limit(3)
        .get();
    for (const snapshot of rows.docs) {
      const row = snapshot.data();
      const inquiryRef = db
          .collection("inquiries")
          .doc(row.inquiryId || fingerprint([job.uid, row.fingerprint]));
      const capture = await db.runTransaction(async (transaction) => {
        const currentJob = (await transaction.get(reference)).data();
        if (currentJob.lease !== lease) return false;
        const currentRow = (await transaction.get(snapshot.ref)).data();
        if (currentRow.status !== "queued") return false;
        if (currentRow.captured) return true;
        const inquiry = await transaction.get(inquiryRef);
        const meter = usageRef(job.uid, job.period);
        const current = (await transaction.get(meter)).data();
        if (inquiry.exists) {
          transaction.update(meter, {
            intakeReserved: Math.max(0, (current.intakeReserved || 0) - 1),
            reserved: Math.max(0, (current.reserved || 0) - Number(job.mode !== "import")),
          });
          transaction.update(snapshot.ref, {
            status: "skipped",
            error: "Already imported.",
          });
          transaction.update(reference, {
            processed: currentJob.processed + 1,
            skipped: currentJob.skipped + 1,
          });
          return false;
        }
        transaction.create(inquiryRef, {
          customerId: job.uid,
          name: row.name,
          email: row.email,
          company: row.company,
          message: row.message,
          source: job.sheetId ? "google_sheets" : "file_import",
          status: "Pending",
          processingStatus: job.mode === "import" ? "awaiting_analysis" : "processing",
          importJobId: jobId,
          sourceRow: row.row,
          sourceTitle: job.title,
          createdAt: new Date(),
          last_active: new Date().toISOString(),
        });
        transaction.update(meter, {
          intakeReserved: Math.max(0, (current.intakeReserved || 0) - 1),
          inquiries: (current.inquiries || 0) + 1,
        });
        transaction.update(snapshot.ref, {
          captured: true,
          inquiryId: inquiryRef.id,
        });
        return true;
      });
      if (!capture) continue;
      if (job.mode === "import") {
        await db.runTransaction(async (transaction) => {
          const currentJob = (await transaction.get(reference)).data();
          const currentRow = (await transaction.get(snapshot.ref)).data();
          if (currentJob.lease !== lease || currentRow.status !== "queued") return;
          transaction.update(snapshot.ref, {status: "completed", error: ""});
          transaction.update(reference, {
            processed: currentJob.processed + 1,
            succeeded: currentJob.succeeded + 1,
          });
        });
        continue;
      }
      let fields = null;
      let error = "";
      try {
        const settings = await db
            .collection("workspaceSettings")
            .doc(job.uid)
            .get();
        const response = await fetch(workflowUrl, {
          method: "POST",
          signal: AbortSignal.timeout(20000),
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": `${jobId}:${snapshot.id}`,
          },
          body: JSON.stringify({
            name: row.name,
            email: row.email,
            company: row.company,
            message: row.message,
            customerId: job.uid,
            inquiryId: inquiryRef.id,
            jobId,
            criteria: settings.data()?.criteria || "",
            source: "nodalx_workspace",
          }),
        });
        if (!response.ok) {
          throw fail(502, `Workflow returned HTTP ${response.status}.`);
        }
        fields = classificationFields((await response.json()).classification);
      } catch (problem) {
        error =
          problem.name === "TimeoutError" ?
            "The workflow timed out. You can retry this row." :
            "Classification failed. Check the workflow connection and retry.";
      }
      await db.runTransaction(async (transaction) => {
        const currentJob = (await transaction.get(reference)).data();
        const currentRow = (await transaction.get(snapshot.ref)).data();
        const meter = usageRef(job.uid, job.period);
        const current = (await transaction.get(meter)).data();
        if (currentJob.lease !== lease || currentRow.status !== "queued") {
          return;
        }
        transaction.update(meter, {
          reserved: Math.max(0, current.reserved - 1),
          used: (current.used || 0) + Number(!!fields),
        });
        transaction.update(snapshot.ref, {
          ...fields,
          status: fields ? "completed" : "failed",
          error,
          captured: true,
          inquiryId: inquiryRef.id,
        });
        transaction.update(inquiryRef, {
          ...fields,
          processingStatus: fields ? "classified" : "failed",
          updatedAt: new Date(),
        });
        transaction.update(reference, {
          processed: currentJob.processed + 1,
          succeeded: currentJob.succeeded + Number(!!fields),
          failed: currentJob.failed + Number(!fields),
        });
      });
    }
    await db.runTransaction(async (transaction) => {
      const current = (await transaction.get(reference)).data();
      if (current.lease !== lease) return;
      if (current.processed < current.total) {
        transaction.update(reference, {status: "queued", dueAt: Date.now()});
      } else {
        const subRef = subscriptions.doc(job.uid);
        const sub = (await transaction.get(subRef)).data();
        transaction.update(subRef, {
          activeJobs: Math.max(0, (sub.activeJobs || 0) - 1),
        });
        transaction.update(reference, {
          status: current.failed ?
            current.succeeded ?
              "partial" :
              "failed" :
            "completed",
          finishedAt: Date.now(),
          dueAt: Date.now(),
        });
      }
    });
  }

  async function recover() {
    const pending = await jobs
        .where("status", "in", [
          "queued",
          "running",
          "preparing",
          "preparing_retry",
        ])
        .where("dueAt", "<=", Date.now())
        .orderBy("dueAt")
        .limit(20)
        .get();
    for (const snapshot of pending.docs) {
      if (["preparing", "preparing_retry"].includes(snapshot.data().status)) {
        const rows = await snapshot.ref.collection("rows").get();
        const expected = snapshot.data().total;
        if (rows.size === expected) {
          if (snapshot.data().status === "preparing_retry") {
            for (let offset = 0; offset < rows.docs.length; offset += 200) {
              const batch = db.batch();
              rows.docs
                  .slice(offset, offset + 200)
                  .filter((row) => row.data().status === "failed")
                  .forEach((row) =>
                    batch.update(row.ref, {status: "queued", error: ""}),
                  );
              await batch.commit();
            }
          }
          await snapshot.ref.update({status: "queued", dueAt: Date.now()});
        } else {
          await db.runTransaction(async (transaction) => {
            const job = (await transaction.get(snapshot.ref)).data();
            if (job.status !== "preparing") return;
            const meter = usageRef(job.uid, job.period);
            const current = (await transaction.get(meter)).data();
            const subRef = subscriptions.doc(job.uid);
            const sub = (await transaction.get(subRef)).data();
            transaction.update(meter, {
              reserved: Math.max(0, (current.reserved || 0) - (job.mode === "import" ? 0 : job.total)),
              intakeReserved: Math.max(
                  0,
                  (current.intakeReserved || 0) - job.total,
              ),
            });
            transaction.update(subRef, {
              activeJobs: Math.max(0, sub.activeJobs - 1),
            });
            transaction.update(snapshot.ref, {
              status: "cancelled",
              error:
                "The upload was interrupted. No credits were consumed. Preview and submit again.",
            });
          });
        }
      } else {
        await processJob(snapshot.id);
      }
    }
  }

  async function analyzeInquiry(uid, id) {
    if (!workflowUrl) throw fail(503, "Analysis is not configured.");
    await subscription(uid);
    const inquiryRef = db.collection("inquiries").doc(id);
    const jobRef = jobs.doc();
    await db.runTransaction(async (transaction) => {
      const inquiry = await transaction.get(inquiryRef);
      if (!inquiry.exists || inquiry.data().customerId !== uid) {
        throw fail(404, "Inquiry not found.");
      }
      const row = inquiry.data();
      if (
        ![
          "awaiting_analysis",
          "not_configured",
          "not_requested",
          "failed",
          "no_classification",
        ].includes(row.processingStatus)
      ) {
        throw fail(
            409,
            "This inquiry is already processed or has an active job.",
        );
      }
      const subRef = subscriptions.doc(uid);
      const sub = (await transaction.get(subRef)).data();
      const access = entitlement(sub);
      const meter = usageRef(uid, access.period);
      const current = (await transaction.get(meter)).data() || {};
      validateReservation(
          {...current, activeJobs: sub.activeJobs || 0},
          access,
          0,
          1,
          1,
      );
      transaction.set(
          meter,
          {...current, reserved: (current.reserved || 0) + 1},
          {merge: true},
      );
      transaction.update(subRef, {activeJobs: (sub.activeJobs || 0) + 1});
      transaction.update(inquiryRef, {processingStatus: "queued"});
      transaction.create(jobRef, {
        uid,
        title: `Inquiry from ${row.name || "sender"}`,
        period: access.period,
        total: 1,
        processed: 0,
        succeeded: 0,
        failed: 0,
        skipped: 0,
        status: "queued",
        createdAt: Date.now(),
        dueAt: Date.now(),
        exportStatus: "not_requested",
      });
      transaction.create(jobRef.collection("rows").doc("0000"), {
        name: row.name || "",
        email: row.email || "",
        company: row.company || "",
        message: row.message || "",
        row: 1,
        captured: true,
        inquiryId: id,
        status: "queued",
      });
    });
    return {id: jobRef.id, processingStatus: "queued"};
  }

  return {
    subscription,
    usage,
    prepare,
    startJob,
    accept,
    retry,
    processJob,
    recover,
    analyzeInquiry,
  };
}

module.exports = {workspaceService};
