const {test, before, after} = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const crypto = require("node:crypto");
const {initializeApp, deleteApp} = require("firebase-admin/app");
const {getFirestore} = require("firebase-admin/firestore");
const {workspaceService} = require("./workspace");
const {workspaceRoutes} = require("./workspaceRoutes");
const {billingService} = require("./billing");
const {fingerprint} = require("./plans");

const enabled = !!process.env.FIRESTORE_EMULATOR_HOST;
if (process.env.REQUIRE_EMULATORS === "1" && !enabled) throw new Error("Firestore emulator is required.");
const integration = (name, callback) =>
  test(name, {skip: !enabled}, callback);
let app;
let db;
let workflow;
let server;
let service;
let apiOrigin;
let workflowOrigin;
let shouldFail = true;
const uid = (prefix) => `${prefix}-${crypto.randomUUID()}`;

before(async () => {
  if (!enabled) return;
  app = initializeApp({projectId: `demo-nodalx-workspace-${crypto.randomUUID().slice(0, 8)}`}, "workspace-tests");
  db = getFirestore(app);
  workflow = http.createServer(async (req, res) => {
    let text = "";
    for await (const chunk of req) text += chunk;
    const data = JSON.parse(text);
    if (shouldFail && data.message === "fail") {
      res.writeHead(500);
      res.end("failure");
      return;
    }
    res.setHeader("Content-Type", "application/json");
    res.end(
        JSON.stringify({
          classification: {summary: data.message, intent: "high", fit_score: 0},
        }),
    );
  });
  await new Promise((resolve) => workflow.listen(0, "127.0.0.1", resolve));
  workflowOrigin = `http://127.0.0.1:${workflow.address().port}`;
  process.env.MAKE_WEBHOOK_URL = workflowOrigin;
  service = workspaceService(db, workflowOrigin);
  const express = require("express");
  const web = express();
  web.use(
      express.json({
        verify: (req, res, raw) => {
          req.rawBody = raw;
        },
      }),
  );
  web.use(
      workspaceRoutes(db, {verifyIdToken: async (token) => ({uid: token})})
          .router,
  );
  server = await new Promise((resolve) => {
    const listener = web.listen(0, "127.0.0.1", () => resolve(listener));
  });
  apiOrigin = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (!enabled) return;
  await Promise.all([
    new Promise((resolve) => server.close(resolve)),
    new Promise((resolve) => workflow.close(resolve)),
  ]);
  await deleteApp(app);
});

integration(
    "concurrent intake with the same idempotency key consumes one inquiry and one reservation",
    async () => {
      const owner = uid("intake");
      const input = {
        name: "Test",
        email: "test@example.com",
        company: "Example",
        message: "Hello",
      };
      const results = await Promise.all([
        service.accept(owner, input, "same-request"),
        service.accept(owner, input, "same-request"),
      ]);
      assert.equal(results[0].id, results[1].id);
      let usage = await service.usage(owner);
      assert.equal(usage.inquiries, 1);
      assert.equal(usage.reserved, 1);
      assert.equal(usage.activeJobs, 1);
      await Promise.all([
        service.processJob(results[0].id),
        service.processJob(results[0].id),
      ]);
      usage = await service.usage(owner);
      assert.equal(usage.used, 1);
      assert.equal(usage.reserved, 0);
      assert.equal(usage.activeJobs, 0);
      await assert.rejects(
          service.accept(owner, {...input, message: "different"}, "same-request"),
          {status: 409},
      );
    },
);

integration(
    "credit exhaustion retains raw inquiries but blocks additional processing",
    async () => {
      const owner = uid("quota");
      await service.subscription(owner);
      await db
          .doc(`workspaceUsage/${owner}/periods/trial`)
          .set({used: 50, reserved: 0, inquiries: 99});
      const results = await Promise.allSettled([
        service.accept(owner, {message: "First"}, "one"),
        service.accept(owner, {message: "Second"}, "two"),
      ]);
      assert.equal(
          results.filter((result) => result.status === "fulfilled").length,
          1,
      );
      const result = results.find(
          (result) => result.status === "fulfilled",
      ).value;
      assert.equal(result.processingStatus, "awaiting_analysis");
      await assert.rejects(service.analyzeInquiry(owner, result.id), {
        status: 429,
      });
      assert.equal((await service.usage(owner)).inquiries, 100);
    },
);

integration(
    "partial import saves successes, releases failures and retries only failed rows",
    async () => {
      const owner = uid("batch");
      const data = {
        title: "Example.csv",
        snapshot: "snapshot",
        rows: [
          {Message: "success"},
          {Message: "fail"},
          {Message: "success"},
          {Message: ""},
        ],
      };
      const preview = await service.prepare(owner, data, {message: "Message"});
      assert.equal(preview.eligible, 2);
      assert.equal(preview.duplicates, 1);
      assert.equal(preview.skipped, 1);
      const job = await service.startJob(
          owner,
          data,
          {message: "Message"},
          2,
          "batch-request",
      );
      assert.equal(
          (
            await service.startJob(
                owner,
                data,
                {message: "Message"},
                2,
                "batch-request",
            )
          ).id,
          job.id,
      );
      await assert.rejects(
          service.startJob(owner, data, {message: "Message"}, 1, "batch-request"),
          {status: 409},
      );
      await service.processJob(job.id);
      let current = (await db.doc(`workspaceJobs/${job.id}`).get()).data();
      assert.equal(current.status, "partial");
      assert.equal(current.succeeded, 1);
      assert.equal(current.failed, 1);
      let usage = await service.usage(owner);
      assert.equal(usage.used, 1);
      assert.equal(usage.reserved, 0);
      assert.equal(usage.inquiries, 2);
      shouldFail = false;
      await service.retry(owner, job.id);
      await service.processJob(job.id);
      current = (await db.doc(`workspaceJobs/${job.id}`).get()).data();
      assert.equal(current.status, "completed");
      assert.equal(current.succeeded, 2);
      usage = await service.usage(owner);
      assert.equal(usage.used, 2);
      assert.equal(usage.reserved, 0);
      assert.equal(usage.inquiries, 2);
      assert.equal(
          (await service.prepare(owner, data, {message: "Message"})).eligible,
          0,
      );
    },
);

integration("import-only works without a workflow or credits and supports later analysis", async () => {
  const owner = uid("import-only");
  const importer = workspaceService(db, "");
  await importer.subscription(owner);
  const meter = db.doc(`workspaceUsage/${owner}/periods/trial`);
  await meter.set({used: 50, reserved: 0, inquiries: 0});
  const data = {title: "Manual inquiries.csv", snapshot: "import-snapshot", rows: [{Message: "Original inquiry"}]};
  const job = await importer.startJob(owner, data, {message: "Message"}, 1, "import-request", null, "import");
  let usage = await importer.usage(owner);
  assert.equal(usage.reserved, 0);
  assert.equal(usage.intakeReserved, 1);
  assert.equal(usage.activeJobs, 1);
  assert.equal((await importer.startJob(owner, data, {message: "Message"}, 1, "import-request", null, "import")).id, job.id);
  await assert.rejects(service.startJob(owner, data, {message: "Message"}, 1, "import-request"), {status: 409});
  await Promise.all([importer.processJob(job.id), importer.processJob(job.id)]);
  usage = await importer.usage(owner);
  assert.equal(usage.used, 50);
  assert.equal(usage.reserved, 0);
  assert.equal(usage.intakeReserved, 0);
  assert.equal(usage.inquiries, 1);
  assert.equal(usage.activeJobs, 0);
  const stored = await db.collection("inquiries").where("customerId", "==", owner).get();
  assert.equal(stored.size, 1);
  assert.equal(stored.docs[0].data().message, "Original inquiry");
  assert.equal(stored.docs[0].data().processingStatus, "awaiting_analysis");
  assert.equal(stored.docs[0].data().importJobId, job.id);
  assert.equal(stored.docs[0].data().sourceRow, 2);
  assert.equal((await db.doc(`workspaceJobs/${job.id}`).get()).data().status, "completed");
  const preview = await importer.prepare(owner, data, {message: "Message"});
  assert.equal(preview.duplicates, 1);
  assert.equal(preview.eligible, 0);
  assert.equal(preview.issues.at(-1).reason, "already_imported");
  await assert.rejects(importer.retry(owner, job.id), {status: 400});
  await meter.update({used: 0});
  const analysis = await service.analyzeInquiry(owner, stored.docs[0].id);
  await service.processJob(analysis.id);
  assert.equal((await service.usage(owner)).used, 1);
  assert.equal((await stored.docs[0].ref.get()).data().processingStatus, "classified");
});

integration("import-only enforces limits, source mapping and validated modes", async () => {
  const owner = uid("import-limits");
  const importer = workspaceService(db, "");
  const data = {title: "limits.csv", snapshot: "limits", rows: [{Message: "Hello"}]};
  await assert.rejects(importer.startJob(owner, data, {message: "Message"}, 1, "bad-mode", null, "invoice"), {status: 400});
  await assert.rejects(importer.startJob(owner, data, {message: "Message"}, 1, "no-workflow"), {status: 503});
  await assert.rejects(importer.startJob(owner, data, {message: "Missing"}, 1, "bad-mapping", null, "import"), {status: 400});
  await importer.subscription(owner);
  await db.doc(`workspaceUsage/${owner}/periods/trial`).set({inquiries: 99, intakeReserved: 1});
  await assert.rejects(importer.startJob(owner, data, {message: "Message"}, 1, "full-inquiries", null, "import"), {status: 429});
  await db.doc(`workspaceUsage/${owner}/periods/trial`).set({inquiries: 0});
  await db.doc(`subscriptions/${owner}`).update({activeJobs: 1});
  await assert.rejects(importer.startJob(owner, data, {message: "Message"}, 1, "busy-import", null, "import"), {status: 409});
  await db.doc(`subscriptions/${owner}`).update({activeJobs: 0, periodEnd: Date.now() - 1});
  await assert.rejects(importer.startJob(owner, data, {message: "Message"}, 1, "expired-import", null, "import"), {status: 402});
});

integration("preview issues and import-only API enforce ownership and snapshot freshness", async () => {
  const owner = uid("import-api");
  const data = {uid: owner, title: "example.csv", headers: ["Message", "Email"], rows: [{Message: "Hello", Email: "bad"}], snapshot: "fresh", expiresAt: Date.now() + 60000};
  const upload = await db.collection("workspaceUploads").add(data);
  const call = (path, body, token = owner) => fetch(`${apiOrigin}/api/workspace/${path}`, {
    method: "POST", headers: {"Authorization": `Bearer ${token}`, "Content-Type": "application/json"}, body: JSON.stringify(body),
  });
  const body = {uploadId: upload.id, mapping: {message: "Message", email: "Email"}, snapshot: "fresh", size: 1, mode: "import", requestId: "import-api-request"};
  const preview = await call("preview", body);
  assert.equal(preview.status, 200);
  assert.equal((await preview.json()).quality.invalidEmails, 1);
  assert.equal((await call("jobs", body, uid("another-owner"))).status, 404);
  assert.equal((await call("jobs", {...body, snapshot: "stale"})).status, 409);
  assert.equal((await call("jobs", {...body, mapping: {message: "Missing"}})).status, 400);
  const result = await call("jobs", body);
  assert.equal(result.status, 200);
  const job = await result.json();
  assert.equal(job.mode, "import");
  await service.processJob(job.id);
  assert.equal((await service.usage(owner)).used, 0);
});

integration("duplicate import-only jobs do not release another job's analysis credits", async () => {
  const owner = uid("mixed-duplicates");
  await service.subscription(owner);
  await db.doc(`subscriptions/${owner}`).update({plan: "growth"});
  const data = {title: "same.csv", snapshot: "same", rows: [{Message: "Shared inquiry"}]};
  const imported = await service.startJob(owner, data, {message: "Message"}, 1, "mixed-import", null, "import");
  const analyzed = await service.startJob(owner, data, {message: "Message"}, 1, "mixed-analysis");
  const usageBefore = await service.usage(owner);
  assert.equal(usageBefore.reserved, 1);
  await service.processJob(analyzed.id);
  const unrelated = await service.accept(owner, {message: "Unrelated inquiry"}, "unrelated-request");
  assert.equal((await service.usage(owner)).reserved, 1);
  await service.processJob(imported.id);
  assert.equal((await service.usage(owner)).reserved, 1);
  await service.processJob(unrelated.id);
  const usage = await service.usage(owner);
  assert.equal(usage.inquiries, 2);
  assert.equal(usage.used, 2);
  assert.equal(usage.reserved, 0);
  assert.equal(usage.intakeReserved, 0);
  assert.equal(usage.activeJobs, 0);
  const result = (await db.doc(`workspaceJobs/${imported.id}`).get()).data();
  assert.equal(result.skipped, 1);
  assert.equal(result.status, "completed");
});

integration("interrupted import-only preparation releases intake but not unrelated credits", async () => {
  const owner = uid("import-recovery");
  await service.subscription(owner);
  await db.doc(`subscriptions/${owner}`).update({activeJobs: 1});
  await db.doc(`workspaceUsage/${owner}/periods/trial`).set({inquiries: 0, intakeReserved: 2, used: 3, reserved: 5});
  const job = await db.collection("workspaceJobs").add({
    uid: owner, mode: "import", period: "trial", total: 2, processed: 0,
    status: "preparing", dueAt: Date.now() - 1,
  });
  await service.recover();
  const usage = await service.usage(owner);
  assert.equal(usage.intakeReserved, 0);
  assert.equal(usage.reserved, 5);
  assert.equal(usage.used, 3);
  assert.equal(usage.activeJobs, 0);
  assert.equal((await job.get()).data().status, "cancelled");
});

integration(
    "concurrent duplicate batches release duplicate reservations without consuming credits",
    async () => {
      const owner = uid("race");
      const now = Date.now();
      await db
          .doc(`subscriptions/${owner}`)
          .set({
            plan: "growth",
            status: "active",
            periodStart: now,
            periodEnd: now + 86400000,
            activeJobs: 0,
          });
      const data = {
        title: "duplicate.csv",
        snapshot: "same",
        rows: [{Message: "one unique inquiry"}],
      };
      const jobs = await Promise.all([
        service.startJob(owner, data, {message: "Message"}, 1, "request-one"),
        service.startJob(owner, data, {message: "Message"}, 1, "request-two"),
      ]);
      await Promise.all(jobs.map((job) => service.processJob(job.id)));
      const usage = await service.usage(owner);
      assert.equal(usage.inquiries, 1);
      assert.equal(usage.used, 1);
      assert.equal(usage.reserved, 0);
      assert.equal(usage.intakeReserved, 0);
      assert.equal(usage.activeJobs, 0);
    },
);

integration(
    "HTTP ownership, disabled redemption, history and aggregate reports",
    async () => {
      const owner = uid("routes");
      const inquiry = await service.accept(
          owner,
          {message: "Follow up"},
          "record",
      );
      const request = (path, method = "GET", body, token = owner) =>
        fetch(`${apiOrigin}${path}`, {
          method,
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: body ? JSON.stringify(body) : undefined,
        });
      assert.equal(
          (
            await request(
                `/api/workspace/jobs/${inquiry.id}`,
                "GET",
                null,
                "another-user",
            )
          ).status,
          404,
      );
      assert.equal(
          (await request("/api/user/redeem-key", "POST", {key: "any-key"}))
              .status,
          410,
      );
      assert.equal(
          (
            await request(`/api/workspace/inquiries/${inquiry.id}`, "PATCH", {
              note: "Call tomorrow",
              followUpAt: Date.now() - 1000,
              status: "Qualified",
            })
          ).status,
          200,
      );
      const activity = await (
        await request(`/api/workspace/inquiries/${inquiry.id}/activity`)
      ).json();
      assert.equal(activity.events.length, 1);
      assert.equal(activity.note, "Call tomorrow");
      const report = await (await request("/api/workspace/overview")).json();
      assert.equal(report.total, 1);
      assert.equal(report.statuses.Qualified, 1);
      assert.equal(report.overdue, 1);
    },
);

integration(
    "workspace key from either legacy profile or new endpoint can accept inquiries",
    async () => {
      const owner = uid("key");
      const legacyKey = `nxk_live_${crypto.randomBytes(24).toString("hex")}`;
      await db
          .doc(`users/${owner}/profile/main`)
          .set({
            apiKeys: [
              {key: legacyKey, businessName: "Existing business", active: true},
            ],
          });
      const headers = {
        "Authorization": `Bearer ${owner}`,
        "Content-Type": "application/json",
      };
      const first = await fetch(`${apiOrigin}/api/onboarding/generate-key`, {
        method: "POST",
        headers,
        body: "{}",
      });
      assert.equal(first.status, 200);
      assert.equal((await first.json()).apiKey, undefined);
      assert.equal((await db.doc(`apiKeys/${owner}`).get()).data().key, undefined);
      const second = await fetch(`${apiOrigin}/api/onboarding/generate-key`, {
        method: "POST",
        headers,
        body: "{}",
      });
      assert.equal((await second.json()).apiKey, undefined);
      const intake = await fetch(`${apiOrigin}/api/inquiries`, {
        method: "POST",
        headers: {"X-API-Key": legacyKey, "Content-Type": "application/json"},
        body: JSON.stringify({message: "Request a consultation"}),
      });
      assert.equal(intake.status, 202);
      assert.equal((await service.usage(owner)).inquiries, 1);
    },
);

integration(
    "public inquiry form stores all submitted fields once and requires an owner",
    async () => {
      const previousOwner = process.env.NODALX_OWNER_UID;
      const payload = {
        name: "Mira",
        email: "MIRA@example.com",
        company: "Acme",
        phone: "+91 12345",
        industry: "technology",
        service: "consulting",
        message: "Help with inquiries",
      };
      const submit = () =>
        fetch(`${apiOrigin}/api/contact`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": "public-form-request",
          },
          body: JSON.stringify(payload),
        });
      try {
        delete process.env.NODALX_OWNER_UID;
        assert.equal((await submit()).status, 503);
        const owner = uid("contact");
        process.env.NODALX_OWNER_UID = owner;
        assert.equal(
            (
              await fetch(`${apiOrigin}/api/contact`, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: "{}",
              })
            ).status,
            400,
        );
        const first = await submit();
        assert.equal(first.status, 202);
        const id = (await first.json()).id;
        const second = await submit();
        assert.equal(second.status, 202);
        assert.equal((await second.json()).duplicate, true);
        const saved = (await db.doc(`inquiries/${id}`).get()).data();
        assert.equal(saved.customerId, owner);
        assert.equal(saved.email, "mira@example.com");
        assert.equal(saved.phone, "+91 12345");
        assert.equal(saved.industry, "technology");
        assert.equal(saved.service, "consulting");
        assert.equal((await service.usage(owner)).inquiries, 1);
      } finally {
        if (previousOwner === undefined) delete process.env.NODALX_OWNER_UID;
        else process.env.NODALX_OWNER_UID = previousOwner;
      }
    },
);

integration(
    "verified duplicate billing events activate only the bound workspace once",
    async () => {
      const owner = uid("billing");
      await service.subscription(owner);
      process.env.RAZORPAY_KEY_ID = "test-id";
      process.env.RAZORPAY_KEY_SECRET = "test-key";
      process.env.RAZORPAY_WEBHOOK_SECRET = "test-webhook";
      const providerId = `sub_${crypto.randomUUID()}`;
      await db
          .doc(`billingSubscriptions/${providerId}`)
          .set({uid: owner, plan: "starter"});
      const payload = {
        event: "subscription.charged",
        created_at: 100,
        payload: {subscription: {entity: {id: providerId}}},
      };
      const rawBody = Buffer.from(JSON.stringify(payload));
      const signature = crypto
          .createHmac("sha256", "test-webhook")
          .update(rawBody)
          .digest("hex");
      const request = {
        rawBody,
        headers: {
          "x-razorpay-signature": signature,
          "x-razorpay-event-id": `evt_${providerId}`,
        },
      };
      const originalFetch = global.fetch;
      global.fetch = async () => ({
        ok: true,
        json: async () => ({
          status: "active",
          current_start: Math.floor(Date.now() / 1000) - 10,
          current_end: Math.floor(Date.now() / 1000) + 86400,
        }),
      });
      try {
        const billing = billingService(db, service);
        await billing.webhook(request);
        assert.equal((await billing.webhook(request)).duplicate, true);
        assert.equal((await service.usage(owner)).plan, "starter");
        assert.equal(
            (
              await db
                  .doc(`billingEvents/${fingerprint(`evt_${providerId}`)}`)
                  .get()
            ).exists,
            true,
        );
        await assert.rejects(
            billing.webhook({...request, rawBody: Buffer.from("tampered")}),
            {status: 401},
        );
      } finally {
        global.fetch = originalFetch;
      }
    },
);
