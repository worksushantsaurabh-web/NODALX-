const {test, before, after, beforeEach} = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const {initializeApp, deleteApp} = require("firebase-admin/app");
const {getFirestore} = require("firebase-admin/firestore");

process.env.PROCESSING_AUTOMATION = "1";
const {automationService, AUTOMATION_ENABLED} = require("./automation");
const {workspaceService} = require("./workspace");
const {importRecipesService} = require("./importRecipes");

const enabled = !!process.env.FIRESTORE_EMULATOR_HOST;
if (process.env.REQUIRE_EMULATORS === "1" && !enabled) {
  throw new Error("Firestore emulator is required.");
}
const integration = (name, callback) =>
  test(name, {skip: !enabled}, callback);

let app;
let db;
let service;
let recipes;
let automation;

const fakeSheets = {
  data: null,
  reads: 0,
  throws: null,
  async read() {
    this.reads += 1;
    if (this.throws) throw this.throws;
    return this.data;
  },
};

const uid = (prefix) => `${prefix}-${crypto.randomUUID()}`;

function sheetData(rows, headers = ["Order ID", "Message", "Email"]) {
  return {
    headers,
    rows: rows.map((row, i) => ({_rowIndex: i + 2, ...row})),
    title: "Leads / Inbox",
    hasMore: false,
    snapshot: require("./plans").fingerprint([headers, rows]),
  };
}

async function makeRecipe(overrides = {}) {
  const owner = uid("owner");
  owners.add(owner);
  const connectionId = crypto.randomUUID();
  await db.collection("workspaceSheets").doc(connectionId).set({
    uid: owner,
    spreadsheetId: "sheet-1",
    title: "Spreadsheet",
    tabs: [{id: 1, title: "Inbox"}],
    verifiedAt: Date.now(),
  });
  fakeSheets.data = sheetData([{"Order ID": "A-1", Message: "Hi", Email: "a@example.com"}]);
  const recipe = await recipes.create(owner, {
    name: "Test",
    connectionId,
    tabId: 1,
    mapping: {message: "Message", email: "Email"},
    sourceIdColumn: "Order ID",
    frequencyMinutes: 15,
    rowCap: 10,
    budgetTimezone: "UTC",
    mode: "import",
    dailyCreditCap: 0,
    ...overrides,
  });
  return {owner, connectionId, recipe};
}

async function approve(owner, recipeId, initialPolicy = "baseline") {
  await recipes.preview(owner, recipeId);
  await recipes.enable(owner, recipeId, {initialPolicy});
}

async function processJob(jobId) {
  return await service.processJob(jobId);
}

async function processAllPendingJobs() {
  for (let guard = 0; guard < 20; guard++) {
    const running = await db
        .collection("workspaceJobs")
        .where("status", "in", ["queued", "running", "preparing", "preparing_retry"])
        .limit(50)
        .get();
    if (running.empty) return;
    for (const snapshot of running.docs) await processJob(snapshot.id);
  }
}

async function getExceptions(uidValue) {
  const snapshot = await db.collection("importExceptions").where("uid", "==", uidValue).get();
  return snapshot.docs.map((doc) => ({id: doc.id, ...doc.data()}));
}

before(async () => {
  if (!enabled) return;
  app = initializeApp({projectId: `demo-nodalx-auto-${crypto.randomUUID().slice(0, 8)}`}, "automation-tests");
  db = getFirestore(app);
  service = workspaceService(db, undefined);
  recipes = importRecipesService(db, service, fakeSheets);
  automation = automationService(db, service, fakeSheets);
});

// scanDue() scans every enabled recipe, so this file must not inherit recipes
// from earlier runs against the shared emulator. Cleanup is scoped to the
// owners this file creates: node --test runs test files concurrently, so
// deleting whole collections would corrupt another file's fixtures.
const owners = new Set();

async function deleteWhere(collection, field, value) {
  const snapshot = await db.collection(collection).where(field, "==", value).get();
  if (snapshot.empty) return;
  const batch = db.batch();
  snapshot.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
}

async function resetAutomationState() {
  for (const owner of owners) {
    // Removing the recipe document also removes its records, runs and budget.
    await deleteWhere("importRecipes", "uid", owner);
    await deleteWhere("importExceptions", "uid", owner);
    await deleteWhere("workspaceSheets", "uid", owner);
    await deleteWhere("workspaceJobs", "uid", owner);
    await deleteWhere("inquiries", "customerId", owner);
    await db.doc(`workspaceUsage/${owner}`).delete().catch(() => {});
  }
}

beforeEach(async () => {
  fakeSheets.reads = 0;
  fakeSheets.throws = null;
  if (enabled) await resetAutomationState();
});

after(async () => {
  if (!enabled) return;
  await deleteApp(app);
});

integration("flag is on for this test suite (deployment gate)", () => {
  assert.equal(AUTOMATION_ENABLED, true);
});

integration("baseline policy: first scan sees existing rows, zero imports, state baseline", async () => {
  const {owner, recipe} = await makeRecipe();
  fakeSheets.data = sheetData([
    {"Order ID": "A-1", Message: "Row one"},
    {"Order ID": "A-2", Message: "Row two"},
  ]);
  await approve(owner, recipe.id, "baseline");
  const result = await automation.scanDue();
  assert.equal(result.completed, 1, "scan completes");
  const after = await recipes.get(owner, recipe.id);
  assert.notEqual(after.baselineAppliedAt, null);
  assert.equal(after.enabled, true);
  assert.equal(
      (await db.collection("inquiries").where("customerId", "==", owner).get()).size,
      0,
  );
  const records = await db
      .collection("importRecipes")
      .doc(recipe.id)
      .collection("records")
      .get();
  assert.equal(records.size, 2);
  records.docs.forEach((doc) => assert.equal(doc.data().state, "baseline"));
  const runs = await db.collection("importRecipes").doc(recipe.id).collection("runs").get();
  assert.equal(runs.docs[0].data().status, "baseline_done");
});

integration("new rows after baseline without reprocessing also import", async () => {
  const {owner, recipe} = await makeRecipe({rowCap: 1});
  await approve(owner, recipe.id, "baseline");
  await automation.scanDue();
  // Reset nextRunAt so a subsequent claim can fire in the same test.
  await db.collection("importRecipes").doc(recipe.id).update({nextRunAt: Date.now() - 1000});
  fakeSheets.data = sheetData([
    {"Order ID": "A-1", Message: "Existing"},
    {"Order ID": "A-3", Message: "New inquiry"},
  ]);
  await automation.scanDue();
  await processAllPendingJobs();
  const inquiries = await db.collection("inquiries").where("customerId", "==", owner).get();
  assert.equal(inquiries.size, 1);
  assert.equal(inquiries.docs[0].data().message, "New inquiry");
  assert.equal(inquiries.docs[0].data().processingStatus, "awaiting_analysis");
});

integration("backlog policy drains a capped backlog over successive runs", async () => {
  const {owner, recipe} = await makeRecipe({rowCap: 1});
  fakeSheets.data = sheetData([
    {"Order ID": "A-1", Message: "First"},
    {"Order ID": "A-2", Message: "Second"},
    {"Order ID": "A-3", Message: "Third"},
  ]);
  await approve(owner, recipe.id, "backlog");
  const countInquiries = async () =>
    (await db.collection("inquiries").where("customerId", "==", owner).get()).size;
  // rowCap=1 means each run imports at most one row, never the whole backlog.
  await automation.scanDue();
  await processAllPendingJobs();
  assert.equal(await countInquiries(), 1, "first run imports only the capped row");
  await db.collection("importRecipes").doc(recipe.id).update({nextRunAt: Date.now() - 1000});
  await automation.scanDue();
  await processAllPendingJobs();
  assert.equal(await countInquiries(), 2, "second run takes the next capped row");
  await db.collection("importRecipes").doc(recipe.id).update({nextRunAt: Date.now() - 1000});
  await automation.scanDue();
  await processAllPendingJobs();
  assert.equal(await countInquiries(), 3, "third run finishes the backlog");
  // Nothing is re-imported once the backlog is drained.
  await db.collection("importRecipes").doc(recipe.id).update({nextRunAt: Date.now() - 1000});
  await automation.scanDue();
  await processAllPendingJobs();
  assert.equal(await countInquiries(), 3, "drained backlog imports nothing further");
});

integration("schema drift pauses recipe and records exception", async () => {
  const {owner, recipe} = await makeRecipe();
  await approve(owner, recipe.id, "baseline");
  fakeSheets.data = sheetData(
      [{ID: "A-1", Text: "renamed headers"}],
      ["ID", "Text"],
  );
  await automation.scanDue();
  const recipeAfter = await recipes.get(owner, recipe.id);
  assert.equal(recipeAfter.status, "paused");
  assert.equal(recipeAfter.enabled, false);
  const exceptions = await getExceptions(owner);
  const drift = exceptions.find((entry) => entry.type === "schema_drift");
  assert.ok(drift, "schema_drift exception recorded");
  assert.match(drift.detail, /headings changed/i);
});

integration("source disconnection pauses recipe and records exception", async () => {
  const {owner, connectionId, recipe} = await makeRecipe();
  await approve(owner, recipe.id, "baseline");
  await db.collection("workspaceSheets").doc(connectionId).delete();
  await automation.scanDue();
  const recipeAfter = await recipes.get(owner, recipe.id);
  assert.equal(recipeAfter.status, "paused");
  assert.match(recipeAfter.pauseReason, /removed/i);
  const exceptions = await getExceptions(owner);
  assert.ok(exceptions.some((entry) => entry.type === "source_disconnected"));
});

integration("run-now on draft/disabled → 409; cross-owner → 404", async () => {
  const {owner, recipe} = await makeRecipe();
  await recipes.preview(owner, recipe.id);
  await assert.rejects(automation.runNow(owner, recipe.id), {status: 409});
  const other = uid("other");
  await assert.rejects(automation.runNow(other, recipe.id), {status: 404});
  await approve(owner, recipe.id, "baseline");
  const outcome = await automation.runNow(owner, recipe.id);
  assert.ok(["baseline_done", "no_changes"].includes(outcome.status));
});

integration("stale run lease recovery", async () => {
  const {owner, recipe} = await makeRecipe();
  await approve(owner, recipe.id, "baseline");
  await db.collection("importRecipes").doc(recipe.id).update({
    currentRunLease: "dead-lease",
    currentRunId: "dead-run",
    currentDueAt: Date.now() - 1000,
  });
  await db.collection("importRecipes").doc(recipe.id).collection("runs").doc("dead-run").set({
    uid: owner,
    recipeId: recipe.id,
    lease: "dead-lease",
    status: "claimed",
    dueAt: Date.now() - 1000,
    startedAt: Date.now() - 1000,
  });
  const result = await automation.recoverStaleRuns();
  assert.equal(result.recovered, 1);
  await automation.scanDue();
  const runs = await db.collection("importRecipes").doc(recipe.id).collection("runs").get();
  const statuses = runs.docs.map((doc) => doc.data().status);
  assert.ok(statuses.every((s) => s !== "claimed"));
});

integration("runNow after baseline with enabled true succeeds", async () => {
  const {owner, recipe} = await makeRecipe();
  await approve(owner, recipe.id, "baseline");
  const outcome = await automation.runNow(owner, recipe.id);
  assert.ok(["baseline_done", "no_changes"].includes(outcome.status));
  const after = await recipes.get(owner, recipe.id);
  assert.notEqual(after.nextRunAt, null);
});
