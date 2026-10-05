const {spawnSync} = require("node:child_process");

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.error("Start both Firebase Auth and Firestore emulators before running integration tests.");
  process.exit(1);
}
const result = spawnSync(process.execPath, [
  "--test", "lib/workspace.integration.test.js", "lib/auth.integration.test.js",
], {stdio: "inherit", env: {...process.env, REQUIRE_EMULATORS: "1"}});
process.exit(result.status === null ? 1 : result.status);
