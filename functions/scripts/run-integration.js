const {spawnSync} = require("node:child_process");
const {readdirSync} = require("node:fs");
const path = require("node:path");

const integrationFiles = (directory = path.join(__dirname, "..", "lib")) =>
  readdirSync(directory, {withFileTypes: true})
      .filter((entry) => entry.isFile() && /\.(integration|rules)\.test\.js$/.test(entry.name))
      .map((entry) => path.join("lib", entry.name))
      .sort();

if (require.main === module) {
  if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    console.error("Start both Firebase Auth and Firestore emulators before running integration tests.");
    process.exit(1);
  }
  const files = integrationFiles();
  if (!files.length) {
    console.error("No integration or security-rule tests were found.");
    process.exit(1);
  }
  const result = spawnSync(process.execPath, ["--test", ...files], {
    cwd: path.join(__dirname, ".."), stdio: "inherit", env: {...process.env, REQUIRE_EMULATORS: "1"},
  });
  process.exit(result.status === null ? 1 : result.status);
}

module.exports = {integrationFiles};
