const admin = require("firebase-admin");
const crypto = require("crypto");

admin.initializeApp({
  projectId: "nodalxai-b9eb5",
});

const db = admin.firestore();

/** Generate test API key in Firestore. */
async function run() {
  const newApiKey = "nxk_live_" + crypto.randomBytes(24).toString("hex");

  const newKeyDoc = {
    key: newApiKey,
    customerId: "test_customer_123",
    businessName: "Acme Corp (Test)",
    plan: "pro",
    active: true,
    totalInquiries: 0,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    lastUsedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await db.collection("apiKeys").add(newKeyDoc);
  console.log(newApiKey);
}

run().catch(console.error);
