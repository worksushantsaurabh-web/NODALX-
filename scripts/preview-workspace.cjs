const {createRequire} = require("node:module");
const path = require("node:path");
const dependency = createRequire(path.join(__dirname, "../functions/package.json"));
const express = dependency("express");
const {initializeApp} = dependency("firebase-admin/app");
const {getAuth} = dependency("firebase-admin/auth");
const {getFirestore} = dependency("firebase-admin/firestore");
const {workspaceRoutes} = require("../functions/lib/workspaceRoutes");
const {requestContext, healthRoutes, notFound, errorHandler} = require("../functions/lib/http");

async function start() {
  if (process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8080" ||
      process.env.FIREBASE_AUTH_EMULATOR_HOST !== "127.0.0.1:9099") {
    throw new Error("Start the loopback Auth and Firestore emulators first.");
  }
  process.env.MAKE_WEBHOOK_URL = "";
  const project = initializeApp({projectId: "demo-nodalx-tests"});
  const auth = getAuth(project);
  const db = getFirestore(project);
  const uid = "preview-workspace";
  const user = {email: "preview@example.test", password: "LocalPreview-Only123!", displayName: "Preview workspace", emailVerified: true};
  try { await auth.createUser({uid, ...user}); } catch (error) {
    if (error.code !== "auth/uid-already-exists") throw error;
    await auth.updateUser(uid, user);
  }
  const batch = db.batch();
  for (let index = 0; index < 105; index++) {
    batch.set(db.doc(`inquiries/preview-${String(index).padStart(3, "0")}`), {
      customerId: uid, name: `Example customer ${index + 1}`, email: `customer${index}@example.test`,
      message: "Synthetic preview inquiry about connecting a website form and reviewing follow-up work.",
      status: index % 3 === 0 ? "Won" : "Pending", processingStatus: "awaiting_analysis",
      createdAt: new Date(Date.now() - index * 3600000), source: "preview", classification: null,
    });
  }
  await batch.commit();
  const app = express();
  app.use(requestContext);
  healthRoutes(app, db);
  app.use(express.json({limit: "7mb"}));
  app.use(workspaceRoutes(db, auth).router);
  app.use(notFound);
  app.use(errorHandler);
  app.listen(5052, "127.0.0.1", () => console.log("Synthetic workspace API: http://127.0.0.1:5052"));
}

start().catch(() => { console.error("Emulator preview initialization failed."); process.exitCode = 1; });
