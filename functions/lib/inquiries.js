const {FieldPath} = require("firebase-admin/firestore");
const {fail} = require("./plans");

const serializeInquiry = (snapshot) => {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    name: data.name || "",
    email: data.email || "",
    company: data.company || "",
    message: data.message || "",
    phone: data.phone || "",
    industry: data.industry || "",
    service: data.service || "",
    intent: data.intent || "",
    urgency: data.urgency || "",
    fit_score: data.fit_score ?? "",
    category: data.category || "",
    summary: data.summary || "",
    suggested_action: data.suggested_action || "",
    processing_status: data.processingStatus || "unknown",
    status: data.status || "Pending",
    last_active: data.last_active || data.createdAt?.toDate?.().toISOString() || "",
  };
};

const listInquiries = async (db, uid, params) => {
  const rawLimit = params.limit === undefined ? "50" : params.limit;
  if (typeof rawLimit !== "string" || !/^\d{1,3}$/.test(rawLimit) || Number(rawLimit) < 1 || Number(rawLimit) > 100) {
    throw fail(400, "Limit must be between 1 and 100.");
  }
  const limit = Number(rawLimit);
  let query = db.collection("inquiries")
      .where("customerId", "==", uid)
      .orderBy("createdAt", "desc")
      .orderBy(FieldPath.documentId(), "desc");
  if (params.cursor !== undefined) {
    if (typeof params.cursor !== "string" || !/^[A-Za-z0-9_-]{1,200}$/.test(params.cursor)) {
      throw fail(400, "Invalid cursor.");
    }
    const id = Buffer.from(params.cursor, "base64url").toString("utf8");
    if (!/^[A-Za-z0-9_-]{1,150}$/.test(id) || Buffer.from(id).toString("base64url") !== params.cursor) {
      throw fail(400, "Invalid cursor.");
    }
    const anchor = await db.collection("inquiries").doc(id).get();
    if (!anchor.exists || anchor.data().customerId !== uid || !anchor.data().createdAt) {
      throw fail(400, "Cursor is unavailable. Refresh the inquiry list.");
    }
    query = query.startAfter(anchor);
  }
  const snapshot = await query.limit(limit + 1).get();
  const records = snapshot.docs.slice(0, limit);
  return {
    records: records.map(serializeInquiry),
    nextCursor: snapshot.size > limit ? Buffer.from(records[records.length - 1].id).toString("base64url") : null,
  };
};

module.exports = {listInquiries, serializeInquiry};
