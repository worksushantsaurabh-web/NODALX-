const fs = require("node:fs/promises");
const path = require("node:path");
const {initializeApp, applicationDefault} = require("firebase-admin/app");
const {getFirestore} = require("firebase-admin/firestore");

const CUSTOMER_ID = "aDF2c1vlEFRuzZDX47pvMMkLNPq1";
const TEST_NAMES = new Set(["test", "test lead", "test user"]);
const apply = process.argv.includes("--apply");

initializeApp({
  credential: applicationDefault(),
  projectId: process.env.FIREBASE_PROJECT_ID || "nodalxai-b9eb5",
});

const db = getFirestore();

/**
 * Back up every inquiry, then delete seeded test rows and assign the
 * remaining legacy rows to the configured owner.
 * @return {Promise<void>} Resolves once Firestore is updated.
 */
async function main() {
  const snapshot = await db.collection("inquiries").get();
  const backup = snapshot.docs.map((doc) => ({id: doc.id, data: doc.data()}));
  const stamp = new Date().toISOString().replaceAll(":", "-");
  const backupPath = path.resolve(process.cwd(), `inquiries-backup-${stamp}.json`);
  await fs.writeFile(backupPath, JSON.stringify(backup, null, 2));

  const testDocs = snapshot.docs.filter((doc) => {
    const name = String(doc.data().name || "").trim().toLowerCase();
    return TEST_NAMES.has(name);
  });
  const realLegacyDocs = snapshot.docs.filter((doc) => {
    const data = doc.data();
    const customerId = typeof data.customerId === "string" ? data.customerId.trim() : "";
    return (!customerId || customerId === "direct") && !TEST_NAMES.has(String(data.name || "").trim().toLowerCase());
  });

  console.log(JSON.stringify({
    mode: apply ? "apply" : "dry-run",
    backupPath,
    total: snapshot.size,
    testRecordsToDelete: testDocs.map((doc) => ({id: doc.id, name: doc.data().name})),
    legacyRecordsToAssign: realLegacyDocs.map((doc) => ({id: doc.id, name: doc.data().name})),
  }, null, 2));

  if (!apply) {
    console.log("Dry run only. No records were changed. Re-run with --apply to perform this exact cleanup.");
    return;
  }

  const batch = db.batch();
  testDocs.forEach((doc) => batch.delete(doc.ref));
  realLegacyDocs.forEach((doc) => batch.update(doc.ref, {
    customerId: CUSTOMER_ID,
    updatedAt: new Date().toISOString(),
  }));
  await batch.commit();

  console.log(
      `Applied cleanup: deleted ${testDocs.length} test records ` +
    `and assigned ${realLegacyDocs.length} legacy records.`,
  );
  console.log(`Backup saved to ${backupPath}`);
}

main().catch((error) => {
  console.error("Legacy inquiry cleanup failed:", error.message);
  process.exitCode = 1;
});
