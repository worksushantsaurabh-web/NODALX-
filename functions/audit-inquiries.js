const {initializeApp, applicationDefault} = require("firebase-admin/app");
const {getFirestore} = require("firebase-admin/firestore");

initializeApp({
  credential: applicationDefault(),
  projectId: process.env.FIREBASE_PROJECT_ID || "nodalxai-b9eb5",
});

const db = getFirestore();

/**
 * Report inquiry ownership so tenant leaks are visible before they ship.
 * @return {Promise<void>} Resolves after the summary is printed.
 */
async function main() {
  const snapshot = await db.collection("inquiries").get();
  const missingCustomerId = [];
  const customerCounts = new Map();

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const customerId = typeof data.customerId === "string" ? data.customerId.trim() : "";
    if (!customerId || customerId === "direct") {
      missingCustomerId.push({id: doc.id, customerId: customerId || null, name: data.name || ""});
      continue;
    }
    customerCounts.set(customerId, (customerCounts.get(customerId) || 0) + 1);
  }

  console.log(JSON.stringify({
    mode: "dry-run",
    total: snapshot.size,
    assigned: snapshot.size - missingCustomerId.length,
    missingCustomerId: missingCustomerId.length,
    customerCounts: Object.fromEntries(customerCounts),
    recordsNeedingReview: missingCustomerId,
  }, null, 2));

  console.log("No records were changed. Assign records manually only after confirming their customer owner.");
}

main().catch((error) => {
  console.error("Inquiry audit failed:", error.message);
  process.exitCode = 1;
});
