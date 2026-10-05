const {test, before, after} = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const {initializeApp, deleteApp} = require("firebase-admin/app");
const {getFirestore} = require("firebase-admin/firestore");
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

// Fake Sheets module. The Google provider is mocked here, per the repo's
// contract that local tests never prove provider access. Tests mutate
// fakeSheets.data per scenario.
const fakeSheets = {
  data: null,
  reads: 0,
  async read() {
    this.reads += 1;
    return this.data;
  },
};

const uid = (prefix) => `${prefix}-${crypto.randomUUID()}`;

function sheetData(rows, headers = ["Order ID", "Message", "Email", "Name"]) {
  return {
    headers,
    rows: rows.map((row, i) => ({_rowIndex: i + 2, ...row})),
    title: "Leads / Inbox",
    hasMore: false,
    snapshot: require("./plans").fingerprint([headers, rows]),
  };
}

async function connectConnection(owner, spreadsheetId = "sheet-1", tabId = 1) {
  const connectionId = crypto.randomUUID();
  await db.collection("workspaceSheets").doc(connectionId).set({
    uid: owner,
    spreadsheetId,
    title: `Spreadsheet ${spreadsheetId}`,
    tabs: [{id: tabId, title: "Inbox"}],
    verifiedAt: Date.now(),
  });
  return connectionId;
}

function defaultBody(overrides) {
  return {
    name: "Weekly import",
    mapping: {message: "Message", email: "Email"},
    sourceIdColumn: "Order ID",
    mode: "import",
    frequencyMinutes: 15,
    rowCap: 10,
    dailyCreditCap: 0,
    budgetTimezone: "UTC",
    ...overrides,
  };
}

before(async () => {
  if (!enabled) return;
  app = initializeApp({projectId: `demo-nodalx-recipes-${crypto.randomUUID().slice(0, 8)}`}, "recipes-tests");
  db = getFirestore(app);
  // No workflow URL: this suite only exercises import-mode behavior.
  service = workspaceService(db, undefined);
  recipes = importRecipesService(db, service, fakeSheets);
});

after(async () => {
  if (!enabled) return;
  await deleteApp(app);
});

integration("creating a recipe validates input, defaults to draft, and disables automation", async () => {
  const owner = uid("owner");
  const connectionId = await connectConnection(owner);
  fakeSheets.data = sheetData([{"Order ID": "A-1", Message: "Hi"}]);
  const recipe = await recipes.create(owner, defaultBody({connectionId, tabId: 1}));
  assert.ok(recipe.id);
  assert.equal(recipe.uid, owner);
  assert.equal(recipe.enabled, false);
  assert.equal(recipe.status, "draft");
  assert.equal(recipe.mode, "import");
  assert.equal(recipe.dailyCreditCap, 0);
  assert.equal(recipe.pendingApproval, null);
  assert.ok(recipe.headersHash);
  assert.deepEqual(recipe.headers, ["Order ID", "Message", "Email", "Name"]);
});

integration("creation rejects unowned connections, bad enums and over-plan caps", async () => {
  const owner = uid("owner");
  const other = uid("other");
  const connectionId = await connectConnection(owner);
  await assert.rejects(
      recipes.create(other, defaultBody({connectionId, tabId: 1})),
      {status: 403},
  );
  await assert.rejects(
      recipes.create(owner, defaultBody({connectionId, tabId: 99})),
      {status: 400},
  );
  const trials = [
    {connectionId, tabId: 1, frequencyMinutes: 7, status: 400},
    {connectionId, tabId: 1, rowCap: 26, status: 400}, // trial batchRows = 25
    {connectionId, tabId: 1, dailyCreditCap: 51, status: 400}, // trial credits = 50
    {connectionId, tabId: 1, mode: "delete", status: 400},
    {connectionId, tabId: 1, budgetTimezone: "Mars/Olympus_Mons", status: 400},
    {connectionId, tabId: 1, mapping: {message: "Missing"} , status: 400},
    {connectionId, tabId: 1, sourceIdColumn: "Nope", status: 400},
  ];
  for (const body of trials) {
    await assert.rejects(recipes.create(owner, defaultBody(body)), {status: body.status});
  }
});

integration("recipe list is bounded, owner-scoped, and strips approval grants", async () => {
  const owner = uid("owner");
  const other = uid("other");
  const connectionId = await connectConnection(owner);
  fakeSheets.data = sheetData([{"Order ID": "A-1", Message: "Hi"}]);
  await recipes.create(owner, defaultBody({connectionId, tabId: 1, name: "One"}));
  await recipes.create(owner, defaultBody({connectionId, tabId: 1, name: "Two"}));
  const list = await recipes.list(owner);
  assert.equal(list.recipes.length, 2);
  assert.ok(list.recipes.every((recipe) => !("pendingApproval" in recipe)));
  const empty = await recipes.list(other);
  assert.equal(empty.recipes.length, 0);
  const recipe = list.recipes[0];
  await assert.rejects(recipes.get(other, recipe.id), {status: 403});
  await assert.rejects(recipes.get(other, crypto.randomUUID()), {status: 404});
});

integration("preview blocks on missing and duplicate source record IDs", async () => {
  const owner = uid("owner");
  const connectionId = await connectConnection(owner);
  fakeSheets.data = sheetData([{"Order ID": "A-1", Message: "Hi"}]);
  const recipe = await recipes.create(owner, defaultBody({connectionId, tabId: 1}));
  fakeSheets.data = sheetData([
    {"Order ID": "A-1", Message: "One"},
    {"Order ID": "", Message: "Missing ID"},
    {"Order ID": "A-1", Message: "Duplicate ID"},
  ]);
  fakeSheets.reads = 0;
  const error = await recipes.preview(owner, recipe.id).then(
      () => null,
      (problem) => problem,
  );
  assert.equal(error.status, 409);
  assert.equal(error.code, "identity_invalid");
  assert.equal(error.identity.missing, 1);
  assert.equal(error.identity.duplicate, 1);
  assert.equal(fakeSheets.reads, 1);
});

integration("enable requires a fresh owner approval preview matching recipe identity", async () => {
  const owner = uid("owner");
  const connectionId = await connectConnection(owner);
  fakeSheets.data = sheetData([
    {"Order ID": "A-1", Message: "One"},
    {"Order ID": "A-2", Message: "Two"},
  ]);
  const recipe = await recipes.create(owner, defaultBody({connectionId, tabId: 1}));
  await assert.rejects(
      recipes.enable(owner, recipe.id, {initialPolicy: "backlog"}),
      {status: 409},
      "enable without preview must be rejected",
  );
  const preview = await recipes.preview(owner, recipe.id);
  assert.equal(preview.eligible, 2);
  assert.equal(preview.identity.ready, true);
  assert.equal(preview.consequences.perRunCap, 10);
  const enabled = await recipes.enable(owner, recipe.id, {initialPolicy: "backlog"});
  assert.equal(enabled.enabled, true);
  assert.equal(enabled.initialPolicy, "backlog");
  const after = await recipes.get(owner, recipe.id);
  assert.equal(after.status, "active");
  assert.equal(after.enabled, true);
  assert.equal(typeof after.approvedAt, "number");
  assert.ok(!after.nextRunAt || after.nextRunAt <= Date.now());
});

integration("analysis recipes cannot enable with a zero daily credit budget", async () => {
  const owner = uid("owner");
  const connectionId = await connectConnection(owner);
  fakeSheets.data = sheetData([{"Order ID": "A-1", Message: "Hello"}]);
  const recipe = await recipes.create(
      owner,
      defaultBody({connectionId, tabId: 1, mode: "analyze", dailyCreditCap: 0}),
  );
  await recipes.preview(owner, recipe.id);
  await assert.rejects(
      recipes.enable(owner, recipe.id, {initialPolicy: "baseline"}),
      {status: 400},
  );
});

integration("identity edits pause and require re-approval; budget edits do not", async () => {
  const owner = uid("owner");
  const connectionId = await connectConnection(owner);
  fakeSheets.data = sheetData([{"Order ID": "A-1", Message: "Hi"}]);
  const recipe = await recipes.create(owner, defaultBody({connectionId, tabId: 1}));
  await recipes.preview(owner, recipe.id);
  await recipes.enable(owner, recipe.id, {initialPolicy: "baseline"});
  // Budget-only edit keeps approval.
  let result = await recipes.update(
      owner,
      recipe.id,
      defaultBody({connectionId, tabId: 1, dailyCreditCap: 5, name: "Renamed"}),
  );
  assert.equal(result.stillApproved, true);
  let after = await recipes.get(owner, recipe.id);
  assert.equal(after.status, "active");
  assert.equal(after.enabled, true);
  // Identity edit invalidates approval and pauses.
  result = await recipes.update(
      owner,
      recipe.id,
      defaultBody({connectionId, tabId: 1, sourceIdColumn: "Order ID", mapping: {message: "Message"}}),
  );
  assert.equal(result.stillApproved, false);
  after = await recipes.get(owner, recipe.id);
  assert.equal(after.status, "paused");
  assert.equal(after.enabled, false);
  assert.equal(after.pauseReason, "Edited after approval. Preview and confirm to resume.");
  // Enabling without a fresh preview fails.
  await assert.rejects(
      recipes.enable(owner, recipe.id, {initialPolicy: "baseline"}),
      {status: 409},
  );
  // Re-preview and enable works again.
  await recipes.preview(owner, recipe.id);
  await recipes.enable(owner, recipe.id, {initialPolicy: "baseline"});
  assert.equal((await recipes.get(owner, recipe.id)).status, "active");
});

integration("pause records a reason and clears scheduling; cross-owner writes are denied", async () => {
  const owner = uid("owner");
  const other = uid("other");
  const connectionId = await connectConnection(owner);
  fakeSheets.data = sheetData([{"Order ID": "A-1", Message: "Hi"}]);
  const recipe = await recipes.create(owner, defaultBody({connectionId, tabId: 1}));
  await recipes.preview(owner, recipe.id);
  await recipes.enable(owner, recipe.id, {initialPolicy: "baseline"});
  const paused = await recipes.pause(owner, recipe.id, "Testing pause.");
  assert.equal(paused.status, "paused");
  const after = await recipes.get(owner, recipe.id);
  assert.equal(after.enabled, false);
  assert.equal(after.nextRunAt, null);
  assert.equal(after.pauseReason, "Testing pause.");
  await assert.rejects(recipes.pause(other, recipe.id), {status: 403});
  await assert.rejects(
      recipes.enable(other, recipe.id, {initialPolicy: "backlog"}),
      {status: 403},
  );
  await assert.rejects(recipes.applyMapping(other, recipe.id), {status: 403});
});

integration("applyMapping returns the mapping for manual use and breaks when disconnected", async () => {
  const owner = uid("owner");
  const connectionId = await connectConnection(owner);
  fakeSheets.data = sheetData([{"Order ID": "A-1", Message: "Hi"}]);
  const recipe = await recipes.create(owner, defaultBody({connectionId, tabId: 1}));
  const applied = await recipes.applyMapping(owner, recipe.id);
  assert.deepEqual(applied.mapping, {message: "Message", email: "Email"});
  assert.equal(applied.sourceIdColumn, "Order ID");
  await db.collection("workspaceSheets").doc(connectionId).delete();
  await assert.rejects(recipes.applyMapping(owner, recipe.id), {status: 403});
});

integration("the per-workspace recipe cap is enforced", async () => {
  const owner = uid("cap");
  const connectionId = await connectConnection(owner);
  const batch = db.batch();
  for (let i = 0; i < 25; i++) {
    batch.set(db.collection("importRecipes").doc(), {
      uid: owner,
      name: `Existing ${i}`,
      updatedAt: Date.now(),
    });
  }
  await batch.commit();
  fakeSheets.data = sheetData([{"Order ID": "A-1", Message: "Hi"}]);
  await assert.rejects(
      recipes.create(owner, defaultBody({connectionId, tabId: 1})),
      {status: 429},
  );
});

integration("preview refuses oversized tabs instead of checking a subset", async () => {
  const owner = uid("owner");
  const connectionId = await connectConnection(owner);
  fakeSheets.data = {...sheetData([{"Order ID": "A-1", Message: "Hi"}]), hasMore: true};
  const recipe = await recipes.create(owner, defaultBody({connectionId, tabId: 1}));
  const error = await recipes.preview(owner, recipe.id).then(
      () => null,
      (problem) => problem,
  );
  assert.equal(error.status, 413);
  assert.equal(error.code, "source_too_large");
});
