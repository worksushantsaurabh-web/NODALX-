const crypto = require("node:crypto");
const {FieldValue} = require("firebase-admin/firestore");
const {fail} = require("./plans");

const hashKey = (key) => crypto.createHash("sha256").update(key).digest("hex");
const previewKey = (key) => `${key.slice(0, 8)}…${key.slice(-4)}`;

const findKeyOwner = async (db, key) => {
  if (typeof key !== "string" || !key || key.length > 200) throw fail(401, "A valid X-API-Key is required.");
  const collection = db.collection("apiKeys");
  let result = await collection.where("keyHash", "==", hashKey(key)).where("active", "==", true).limit(1).get();
  if (result.empty) result = await collection.where("key", "==", key).where("active", "==", true).limit(1).get();
  return result.docs[0]?.data().customerId || null;
};

const keyMetadata = async (db, uid) => {
  const keys = await db.collection("apiKeys").where("customerId", "==", uid).where("active", "==", true).limit(1).get();
  const value = keys.docs[0]?.data();
  return {active: !!value, keyPreview: value?.keyPreview || (value?.key ? previewKey(value.key) : null)};
};

const manageKey = async (db, uid, businessName = "", operation = "create") => {
  const reference = db.collection("apiKeys").doc(uid);
  const profile = db.collection("users").doc(uid).collection("profile").doc("main");
  const rawKey = `nxk_live_${crypto.randomBytes(24).toString("hex")}`;
  return db.runTransaction(async (transaction) => {
    const active = await transaction.get(db.collection("apiKeys")
        .where("customerId", "==", uid).where("active", "==", true));
    const canonical = await transaction.get(reference);
    const previousProfile = (await transaction.get(profile)).data() || {};
    const existing = active.docs[0];
    const legacy = (previousProfile.apiKeys || []).find((key) => key.active && typeof key.key === "string");
    if (operation === "revoke") {
      active.docs.forEach((snapshot) => transaction.update(snapshot.ref, {
        active: false, revokedAt: Date.now(), key: FieldValue.delete(),
      }));
      transaction.set(profile, {apiKeys: []}, {merge: true});
      return {active: false, keyPreview: null};
    }
    if (existing && operation === "create") {
      const value = existing.data();
      const keyPreview = value.keyPreview || previewKey(value.key);
      if (value.key) {
        transaction.update(existing.ref, {keyHash: hashKey(value.key), keyPreview, key: FieldValue.delete()});
      }
      transaction.set(profile, {
        apiKeys: [{id: existing.id, active: true, keyPreview, businessName: value.businessName || ""}],
      }, {merge: true});
      return {active: true, created: false, keyPreview, businessName: value.businessName || ""};
    }
    if (operation === "rotate") {
      active.docs.forEach((snapshot) => {
        if (snapshot.id !== uid) {
          transaction.update(snapshot.ref, {
            active: false, revokedAt: Date.now(), key: FieldValue.delete(),
          });
        }
      });
    }
    const migration = !!legacy && !canonical.exists && operation === "create";
    const key = migration ? legacy.key : rawKey;
    const keyPreview = previewKey(key);
    const name = businessName || existing?.data().businessName || legacy?.businessName || "";
    transaction.set(reference, {
      customerId: uid, active: true, keyHash: hashKey(key), keyPreview,
      businessName: name, createdAt: Date.now(), totalInquiries: 0,
    });
    transaction.set(profile, {apiKeys: [{id: uid, active: true, keyPreview, businessName: name}]}, {merge: true});
    return {active: true, created: !migration, keyPreview, businessName: name, ...(migration ? {} : {apiKey: key})};
  });
};

module.exports = {findKeyOwner, keyMetadata, manageKey};
