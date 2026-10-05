const {test} = require("node:test");
const assert = require("node:assert/strict");
const {mkdtempSync, mkdirSync, writeFileSync, rmSync} = require("node:fs");
const {tmpdir} = require("node:os");
const path = require("node:path");
const {spawnSync} = require("node:child_process");
const {integrationFiles} = require("../scripts/run-integration");

test("integration runner includes authentication, workspace, recipes, automation and security rules", () => {
  const files = integrationFiles();
  for (const filename of ["auth.integration.test.js", "workspace.integration.test.js",
    "importRecipes.integration.test.js", "automation.integration.test.js", "importRecipes.rules.test.js"]) {
    assert.ok(files.includes(path.join("lib", filename)), filename);
  }
  assert.ok(files.every((filename) => /\.(integration|rules)\.test\.js$/.test(filename)));
});

test("integration discovery includes future suites but excludes unit tests, unrelated files and directories", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "nodalx-suite-discovery-"));
  try {
    for (const filename of ["future.integration.test.js", "future.rules.test.js", "unit.test.js", "notes.md"]) {
      writeFileSync(path.join(directory, filename), "");
    }
    mkdirSync(path.join(directory, "directory.integration.test.js"));
    assert.deepEqual(integrationFiles(directory), [
      path.join("lib", "future.integration.test.js"), path.join("lib", "future.rules.test.js"),
    ]);
  } finally {
    rmSync(directory, {recursive: true, force: true});
  }
});

test("integration runner fails closed when either emulator is missing, regardless of caller directory", () => {
  const environment = {...process.env};
  delete environment.FIRESTORE_EMULATOR_HOST;
  delete environment.FIREBASE_AUTH_EMULATOR_HOST;
  for (const configured of [{}, {FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080"},
    {FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099"}]) {
    const result = spawnSync(process.execPath, [path.join(__dirname, "..", "scripts", "run-integration.js")], {
      cwd: tmpdir(), encoding: "utf8", env: {...environment, ...configured},
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Start both Firebase Auth and Firestore emulators/);
  }
});
