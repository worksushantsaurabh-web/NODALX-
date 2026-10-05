const {test, before, after} = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const express = require("express");
const {initializeApp, deleteApp} = require("firebase-admin/app");
const {getAuth} = require("firebase-admin/auth");
const {getFirestore} = require("firebase-admin/firestore");
const {workspaceRoutes} = require("./workspaceRoutes");
const {requestContext, errorHandler, notFound} = require("./http");

const enabled = !!(process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST);
if (process.env.REQUIRE_EMULATORS === "1" && !enabled) throw new Error("Auth and Firestore emulators are required.");
const integration = (name, run) => test(name, {skip: !enabled}, run);
let app;
let db;
let server;
let origin;
let owner;
let other;

const account = async () => {
  const uid = `auth-${crypto.randomUUID()}`;
  const token = await getAuth(app).createCustomToken(uid);
  const response = await fetch(
      `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/` +
        "accounts:signInWithCustomToken?key=emulator-only",
      {
        method: "POST", headers: {"Content-Type": "application/json"},
        body: JSON.stringify({token, returnSecureToken: true}),
      },
  );
  assert.equal(response.status, 200);
  return {uid, token: (await response.json()).idToken};
};

before(async () => {
  if (!enabled) return;
  app = initializeApp({projectId: "demo-nodalx-tests"}, "auth-integration");
  db = getFirestore(app);
  owner = await account();
  other = await account();
  const web = express();
  web.use(requestContext);
  web.use(express.json());
  web.use(workspaceRoutes(db, getAuth(app)).router);
  web.use(notFound);
  web.use(errorHandler);
  server = await new Promise((resolve) => {
    const listener = web.listen(0, "127.0.0.1", () => resolve(listener));
  });
  origin = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (!enabled) return;
  await new Promise((resolve) => server.close(resolve));
  await deleteApp(app);
});

const request = (path, token, options = {}) => fetch(`${origin}${path}`, {
  ...options,
  headers: {"Content-Type": "application/json", ...(token ? {Authorization: `Bearer ${token}`} : {})},
});

integration("real Firebase tokens are required and disabled accounts lose access", async () => {
  assert.equal((await request("/api/workspace/usage")).status, 401);
  assert.equal((await request("/api/workspace/usage", "forged-token")).status, 401);
  assert.equal((await request("/api/workspace/usage", owner.token)).status, 200);
  const blocked = await account();
  await getAuth(app).updateUser(blocked.uid, {disabled: true});
  assert.equal((await request("/api/workspace/usage", blocked.token)).status, 401);
});

integration("pagination crosses 100 records without losing ties or leaking another owner", async () => {
  const batch = db.batch();
  const createdAt = new Date();
  for (let index = 0; index < 105; index++) {
    batch.set(db.doc(`inquiries/${owner.uid}-${String(index).padStart(3, "0")}`), {
      customerId: owner.uid, createdAt, message: `Inquiry ${index}`, status: "Pending",
    });
  }
  const otherId = `${other.uid}-record`;
  batch.set(db.doc(`inquiries/${otherId}`), {customerId: other.uid, createdAt, message: "Private"});
  await batch.commit();
  const first = await request("/api/workspace/inquiries?limit=100", owner.token);
  assert.equal(first.status, 200);
  assert.equal(first.headers.get("cache-control"), "private, no-store");
  const page = await first.json();
  assert.equal(page.records.length, 100);
  const nextResponse = await request(`/api/workspace/inquiries?limit=100&cursor=${page.nextCursor}`, owner.token);
  const next = await nextResponse.json();
  assert.equal(next.records.length, 5);
  assert.equal(next.nextCursor, null);
  assert.equal(new Set([...page.records, ...next.records].map((record) => record.id)).size, 105);
  assert.equal((await request(`/api/workspace/inquiries?cursor=${page.nextCursor}`, other.token)).status, 400);
  assert.equal((await request("/api/workspace/inquiries?limit=101", owner.token)).status, 400);
  assert.equal((await request("/api/workspace/inquiries?cursor=invalid", owner.token)).status, 400);
  const changed = await request(`/api/workspace/inquiries/${otherId}`, owner.token, {
    method: "PATCH", body: JSON.stringify({status: "Won"}),
  });
  assert.equal(changed.status, 404);
  assert.equal((await db.doc(`inquiries/${otherId}`).get()).data().status, undefined);
});

integration("workspace keys are shown once, hashed at rest, and rotation and revocation stop old callers", async () => {
  const customer = await account();
  const create = await request("/api/onboarding/generate-key", customer.token, {method: "POST", body: "{}"});
  assert.equal(create.status, 200);
  const initial = await create.json();
  assert.equal(typeof initial.apiKey, "string");
  const again = await request("/api/onboarding/generate-key", customer.token, {method: "POST", body: "{}"});
  assert.equal((await again.json()).apiKey, undefined);
  const record = (await db.doc(`apiKeys/${customer.uid}`).get()).data();
  assert.equal(record.key, undefined);
  assert.equal(typeof record.keyHash, "string");
  const profile = (await db.doc(`users/${customer.uid}/profile/main`).get()).data();
  assert.equal(JSON.stringify(profile).includes(initial.apiKey), false);
  const intake = (key) => fetch(`${origin}/api/inquiries`, {
    method: "POST", headers: {"X-API-Key": key, "Content-Type": "application/json"},
    body: JSON.stringify({message: "Test inquiry"}),
  });
  assert.equal((await intake(initial.apiKey)).status, 202);
  const rotated = await request("/api/workspace/key/rotate", customer.token, {method: "POST", body: "{}"});
  const replacement = await rotated.json();
  assert.notEqual(replacement.apiKey, initial.apiKey);
  assert.equal((await intake(initial.apiKey)).status, 401);
  assert.equal((await intake(replacement.apiKey)).status, 202);
  assert.equal((await request("/api/workspace/key", customer.token, {method: "DELETE"})).status, 200);
  assert.equal((await intake(replacement.apiKey)).status, 401);
});
