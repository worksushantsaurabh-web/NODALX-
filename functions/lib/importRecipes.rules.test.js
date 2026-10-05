// Security rules test for the import-recipe surface. Verifies the default
// deny contract explicitly for the new collections: a client must not read
// recipe contents and must never write recipes, records, budgets, run state
// or exceptions, even as the owning signed-in user.
const {test, before, after} = require("node:test");
const assert = require("node:assert/strict");
const {readFileSync} = require("node:fs");
const path = require("node:path");
const {randomUUID} = require("node:crypto");
const {initializeApp, deleteApp} = require("firebase-admin/app");
const {getFirestore} = require("firebase-admin/firestore");

const enabled = !!process.env.FIRESTORE_EMULATOR_HOST;
if (process.env.REQUIRE_EMULATORS === "1" && !enabled) {
  throw new Error("Firestore emulator is required.");
}
const integration = (name, callback) =>
  test(name, {skip: !enabled}, callback);

let testEnv;
let initializeTestEnvironment;
let assertFails;

before(async () => {
  if (!enabled) return;
  ({initializeTestEnvironment, assertFails} = require(
      "@firebase/rules-unit-testing",
  ));
  testEnv = await initializeTestEnvironment({
    projectId: `demo-nodalx-rules-${randomUUID().slice(0, 8)}`,
    firestore: {
      rules: readFileSync(path.join(__dirname, "..", "..", "firestore.rules"), "utf8"),
    },
  });
  await testEnv.clearFirestore();
});

after(async () => {
  if (!enabled) return;
  await testEnv.cleanup();
});

integration("clients cannot read importRecipes documents even when signed in as owner", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().collection("importRecipes").doc("recipe-1").set({
      uid: "owner-1",
      name: "Weekly import",
      enabled: true,
      nextRunAt: Date.now(),
    });
  });
  const authed = testEnv.authenticatedContext("owner-1").firestore();
  await assertFails(authed.collection("importRecipes").doc("recipe-1").get());
  await assertFails(authed.collection("importRecipes").get());
});

integration("clients cannot write importRecipes, subcollections or exceptions", async () => {
  const authed = testEnv.authenticatedContext("owner-1").firestore();
  await assertFails(
      authed.collection("importRecipes").doc("recipe-1").set({uid: "owner-1", enabled: true}),
  );
  await assertFails(
      authed.collection("importRecipes").doc("recipe-1").update({nextRunAt: Date.now()}),
  );
  await assertFails(
      authed.doc("importRecipes/recipe-1/records/A-1").set({state: "seen"}),
  );
  await assertFails(
      authed.doc("importRecipes/recipe-1/budget/2026-10-01").set({used: 1}),
  );
  await assertFails(
      authed.collection("importExceptions").doc("e-1").set({uid: "owner-1"}),
  );
});

integration("server-side access remains allowed through the Admin SDK context", async () => {
  const server = testEnv.withSecurityRulesDisabled;
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const firestore = context.firestore();
    await firestore.doc("importRecipes/recipe-1").set({uid: "owner-1"});
    assert.equal((await firestore.doc("importRecipes/recipe-1").get()).exists, true);
  });
  assert.ok(server);
});

integration("clearing the rules fixture leaves other emulator suites intact", async () => {
  const app = initializeApp({projectId: "demo-nodalx-tests"}, `rules-isolation-${randomUUID()}`);
  const reference = getFirestore(app).collection("workspaceSheets").doc(`isolation-${randomUUID()}`);
  try {
    await reference.set({uid: "isolated-test-owner"});
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc("importRecipes/isolation-probe").set({uid: "owner-1"});
    });
    await testEnv.clearFirestore();
    assert.equal((await reference.get()).exists, true);
    await testEnv.withSecurityRulesDisabled(async (context) => {
      assert.equal((await context.firestore().doc("importRecipes/isolation-probe").get()).exists, false);
    });
  } finally {
    await reference.delete();
    await deleteApp(app);
  }
});
