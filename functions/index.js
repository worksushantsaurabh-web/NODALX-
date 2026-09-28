/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const {setGlobalOptions} = require("firebase-functions/v2");
const admin = require("firebase-admin");
const {onRequest, onCall, HttpsError} = require("firebase-functions/v2/https");
const {
  getFirestore,
  FieldValue,
} = require("firebase-admin/firestore");
const {getAuth} = require("firebase-admin/auth");
const crypto = require("crypto");
const {parse: csvParse} = require("csv-parse/sync");
const XLSX = require("xlsx");
const busboy = require("busboy");
const googleSheets = require("./lib/googleSheets");
const {entitlementFromKey, toPlan, resolveTier, isRedeemed} = require("./lib/tier");


admin.initializeApp();

const db = getFirestore();

// For cost control, you can set the maximum number of containers that can be
// running at the same time. This helps mitigate the impact of unexpected
// traffic spikes by instead downgrading performance. This limit is a
// per-function limit. You can override the limit for each function using the
// `maxInstances` option in the function's options, e.g.
// `onRequest({ maxInstances: 5 }, (req, res) => { ... })`.
// NOTE: setGlobalOptions does not apply to functions using the v1 API. V1
// functions should each use functions.runWith({ maxInstances: 10 }) instead.
// In the v1 API, each function can only serve one request per container, so
// this will be the maximum concurrent request count.
setGlobalOptions({region: "us-central1", maxInstances: 10});

/**
 * Generate a unique API key.
 * @return {string} The generated API key.
 */
function generateApiKey() {
  return "nxk_live_" + crypto.randomBytes(24).toString("hex");
}

const ALLOWED_INQUIRY_STATUSES = new Set([
  "Pending",
  "Qualified",
  "Contacted",
  "Spam",
]);

/**
 * Validate an API key from request headers.
 * @param {Object} req The HTTP request object.
 * @return {Object|null} Customer data if valid, null otherwise.
 */
async function validateApiKey(req) {
  const apiKey = req.headers["x-api-key"];
  if (!apiKey) return null;

  const keyDoc = await db.collection("apiKeys")
      .where("key", "==", apiKey)
      .where("active", "==", true)
      .limit(1)
      .get();
  if (keyDoc.empty) return null;

  const keyData = keyDoc.docs[0].data();
  if (!keyData.customerId) return null;
  return {
    customerId: keyData.customerId,
    businessName: keyData.businessName,
    plan: toPlan(keyData.plan),
  };
}

/** Hard ceiling for an uploaded spreadsheet, enforced while streaming. */
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50MB

/**
 * Parse file upload from multipart form data.
 *
 * The body is buffered in memory because the spreadsheet parsers need a Buffer,
 * so the size cap is enforced by busboy as chunks arrive and the stream is
 * aborted on the first excess byte. Checking `fileBuffer.length` after the fact
 * was too late: without a streaming limit a single large upload was fully
 * resident before the check ran, which OOMs the instance (256MB default) and
 * takes down every tenant sharing it.
 *
 * @param {Object} req The HTTP request object.
 * @return {Promise<Object>} Promise with fileBuffer, fileName, and fieldData.
 */
function parseFileUpload(req) {
  return new Promise((resolve, reject) => {
    const bb = busboy({
      headers: req.headers,
      limits: {
        fileSize: MAX_UPLOAD_BYTES,
        files: 1,
        fields: 10,
        fieldSize: 1024 * 1024,
      },
    });
    let fileBuffer = null;
    let fileName = "";
    let bytesSeen = 0;
    let settled = false;
    const fieldData = {};

    const fail = (err) => {
      if (settled) return;
      settled = true;
      // Stop reading immediately so an oversized upload is not held in memory.
      req.unpipe(bb);
      if (typeof req.destroy === "function" && !req.readableEnded) {
        req.destroy();
      }
      reject(err);
    };

    bb.on("file", (fieldname, file, info) => {
      fileName = info.filename;
      const chunks = [];
      file.on("data", (chunk) => {
        bytesSeen += chunk.length;
        if (bytesSeen > MAX_UPLOAD_BYTES) {
          const err = new Error("Uploaded file exceeds the 50MB limit.");
          err.status = 413;
          fail(err);
          file.unpipe();
          return;
        }
        chunks.push(chunk);
      });
      file.on("limit", () => {
        const err = new Error("Uploaded file exceeds the 50MB limit.");
        err.status = 413;
        fail(err);
      });
      file.on("end", () => {
        if (!settled) fileBuffer = Buffer.concat(chunks);
      });
      file.on("error", fail);
    });

    bb.on("field", (name, value) => {
      fieldData[name] = value;
    });

    bb.on("finish", () => {
      if (settled) return;
      settled = true;
      resolve({fileBuffer, fileName, fieldData});
    });

    bb.on("error", (err) => {
      if (err && err.code === "LIMIT_FILE_SIZE") {
        err.message = "Uploaded file exceeds the 50MB limit.";
        err.status = 413;
      }
      fail(err);
    });

    // Cloud Functions may have already consumed the raw body
    if (req.rawBody) {
      // A pre-buffered body bypasses busboy's streaming counter, so enforce the
      // ceiling on the raw payload before handing it over.
      if (req.rawBody.length > MAX_UPLOAD_BYTES) {
        const err = new Error("Uploaded file exceeds the 50MB limit.");
        err.status = 413;
        reject(err);
        return;
      }
      bb.end(req.rawBody);
    } else {
      req.pipe(bb);
    }
  });
}

/**
 * Parse CSV or Excel spreadsheet into JSON records.
 * @param {Buffer} buffer The file buffer.
 * @param {string} fileName The original file name.
 * @return {Array} Array of parsed records.
 */
function parseSpreadsheet(buffer, fileName) {
  const ext = (fileName || "").toLowerCase();

  if (ext.endsWith(".csv") || ext.endsWith(".tsv")) {
    const content = buffer.toString("utf-8");
    const records = csvParse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    });
    return records;
  }

  // Excel files (.xlsx, .xls)
  const workbook = XLSX.read(buffer, {type: "buffer"});
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const records = XLSX.utils.sheet_to_json(sheet, {defval: ""});
  return records;
}

// checkAllowedUser disabled for standard Firebase Auth compatibility

exports.redeemKey = onCall({invoker: "public"}, async (request) => {
  // 1. Require the caller to be signed in
  if (!request.auth) {
    throw new HttpsError(
        "unauthenticated",
        "You must be signed in to redeem a key.",
    );
  }

  const {key} = request.data || {};
  const {uid} = request.auth;

  // 2. Read "key" string from the request data
  if (typeof key !== "string" || key.length === 0) {
    throw new HttpsError(
        "invalid-argument",
        "The function must be called with a 'key' string argument.",
    );
  }

  const db = getFirestore();
  const userRef = db.collection("users").doc(uid);

  try {
    const result = await db.runTransaction(async (transaction) => {
      // 3. Look up the key by its 'key' field in the apiKeys collection.
      // The read MUST go through the transaction: a plain db.collection() query
      // is outside the transaction's read set, so Firestore would not detect the
      // conflict and two concurrent requests could both see redeemed === false
      // and both grant the paid entitlement from one single-use key.
      const keyQuery = db.collection("apiKeys").where("key", "==", key).limit(1);
      const keySnapshot = await transaction.get(keyQuery);

      if (keySnapshot.empty) {
        throw new HttpsError(
            "not-found",
            "The access key you provided does not exist.",
        );
      }

      const accessKeyRef = keySnapshot.docs[0].ref;
      const keyData = keySnapshot.docs[0].data();

      // 4. Throw an error if it's already redeemed
      if (isRedeemed(keyData)) {
        throw new HttpsError(
            "already-exists",
            "This access key has already been redeemed.",
        );
      }

      // 5. Mark the key document as redeemed and set the user's entitlement.
      // `tier` is normalized to the canonical free/full vocabulary so paid
      // accounts satisfy the premiumContent Firestore rule, while the original
      // commercial plan is preserved on `plan`.
      transaction.update(accessKeyRef, {
        redeemed: true,
        redeemedBy: uid,
        redeemedAt: FieldValue.serverTimestamp(),
      });

      const entitlement = entitlementFromKey(keyData.plan || keyData.tier);
      const plan = toPlan(keyData.plan, toPlan(keyData.tier));
      transaction.set(userRef, {tier: entitlement, plan}, {merge: true});
      transaction.set(
          userRef.collection("profile").doc("main"),
          {subscription: {tier: plan, status: "active"}, updatedAt: FieldValue.serverTimestamp()},
          {merge: true},
      );

      return {tier: entitlement, plan};
    });

    // 6. Log the redemption for audit purposes
    await db.collection("auditLogs").add({
      action: "key_redeemed",
      userId: uid,
      tier: result.tier,
      plan: result.plan,
      keyId: key,
      timestamp: FieldValue.serverTimestamp(),
    });

    // 7. Return success and the new tier
    return {success: true, tier: result.tier, plan: result.plan};
  } catch (error) {
    if (error instanceof HttpsError) {
      throw error;
    }
    console.error("Transaction failed: ", error);
    throw new HttpsError(
        "internal",
        "An unexpected error occurred while redeeming the key.",
    );
  }
});

const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors({origin: true}));
app.use(express.json({limit: "7mb"}));

/**
 * Check and enforce rate limit using Firestore as a shared store.
 * Stores recent request timestamps per user in the "rateLimits" collection,
 * pruning entries outside the window on every check.
 * @param {string} userId The user ID to check.
 * @param {number} maxRequests Maximum requests allowed in the window.
 * @param {number} windowMs Time window in milliseconds.
 * @return {Promise<boolean>} True if allowed, false if rate limited.
 */
async function checkRateLimit(userId, maxRequests = 10, windowMs = 60000) {
  const ref = db.collection("rateLimits").doc(userId);
  const now = Date.now();
  const cutoff = now - windowMs;

  return db.runTransaction(async (tx) => {
    const doc = await tx.get(ref);
    const timestamps = (doc.exists ? doc.data().timestamps : [])
        .filter((t) => t > cutoff);

    if (timestamps.length >= maxRequests) {
      return false;
    }

    // expiresAt is read by the daily prune job, which relies on this field to
    // delete counters that can no longer affect any live window.
    tx.set(ref, {
      timestamps: [...timestamps, now],
      expiresAt: now + Math.max(windowMs * 2, 60 * 60 * 1000),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return true;
  });
}

const MAKE_WEBHOOK_URL = process.env.MAKE_WEBHOOK_URL;
const WEBHOOK_TIMEOUT_MS = Number(process.env.WEBHOOK_TIMEOUT_MS || 30000);

// Inquiry intake quotas. Defaults: 120 requests per minute per API key, with
// wider per-IP ceilings layered on top to bound abuse from leaked keys.
const INQUIRY_RATE_MAX = Number(process.env.INQUIRY_RATE_MAX || 120);
const INQUIRY_RATE_WINDOW_MS = Number(process.env.INQUIRY_RATE_WINDOW_MS || 60000);

/**
 * Send a request to a webhook.
 * @param {string} webhookUrl The webhook URL to call.
 * @param {Object} config Request configuration.
 * @return {Promise<Object>} The webhook response data.
 */
async function requestWebhook(webhookUrl, {method = "POST", body} = {}) {
  const timeoutController = new AbortController();
  const timeout = setTimeout(() => timeoutController.abort(), WEBHOOK_TIMEOUT_MS);

  try {
    const response = await fetch(webhookUrl, {
      method,
      headers: {"Content-Type": "application/json"},
      body: body ? JSON.stringify(body) : undefined,
      signal: timeoutController.signal,
    });

    const responseText = await response.text();
    let data = responseText;
    try {
      data = responseText ? JSON.parse(responseText) : {};
    } catch {
      // Continue with responseText as fallback
    }

    if (!response.ok) {
      const error = new Error(data?.message || data?.error || `Webhook responded with status ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Send a Slack notification about a lead.
 * @param {string} slackWebhookUrl The Slack webhook URL.
 * @param {Object} inquiry The inquiry data.
 * @param {Object} classification The classification result.
 */
async function sendSlackNotification(slackWebhookUrl, inquiry, classification = {}) {
  if (!slackWebhookUrl) return;
  try {
    // Inquiry fields are attacker-controlled and are interpolated into Slack
    // mrkdwn. Slack's special mentions (<!channel>, <!here>) fire on a live
    // customer channel, and the values are plain_text/mrkdwn injected verbatim.
    const slackSafe = (value, maxLength = 300) => {
      const text = value === null || value === undefined ? "" : String(value);
      return text
      // Neutralize mentions, channel links and entity refs.
          .replace(/<[!@#][^>]*>/g, "")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .slice(0, maxLength);
    };

    const payload = {
      text: `🔥 *New Lead Captured via NodalX*`,
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "⚡ New Lead Captured - NodalX",
            emoji: true,
          },
        },
        {
          type: "section",
          fields: [
            {type: "mrkdwn", text: `*Lead Name:*\n${slackSafe(inquiry.name)}`},
            {type: "mrkdwn", text: `*Company:*\n${slackSafe(inquiry.company) || "N/A"}`},
            {type: "mrkdwn", text: `*Email:*\n${slackSafe(inquiry.email, 200)}`},
            {
              type: "mrkdwn",
              text: `*Intent / Score:*\n${slackSafe(classification.intent, 80) || "Unknown"} / ${
                classification.fit_score ?? "Unknown"}`,
            },
          ],
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Inquiry Message:*\n"${slackSafe(inquiry.message, 1000)}"`,
          },
        },
      ],
    };
    const response = await fetch(slackWebhookUrl, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(`Slack responded with ${response.status}`);
  } catch (err) {
    console.error("[Slack Notification Error]", err);
  }
}

const handleInquiry = async (req, res, expectedCustomerId = null) => {
  const {name, email, company, message} = req.body || {};
  if ([name, email, company, message].some((value) => typeof value !== "string" || !value.trim())) {
    return res.status(400).json({error: "Name, email, company, and message are required."});
  }
  try {
    // Pre-authentication per-IP ceiling. This runs before the apiKeys lookup so
    // a flood of invalid keys cannot drive unbounded Firestore reads.
    const preAuthIp = crypto.createHash("sha256")
        .update(`preauth:${req.ip || "unknown"}`).digest("hex").slice(0, 40);
    if (!await checkRateLimit(`inquiry-preauth-${preAuthIp}`, INQUIRY_RATE_MAX * 10, INQUIRY_RATE_WINDOW_MS)) {
      res.set("Retry-After", String(Math.ceil(INQUIRY_RATE_WINDOW_MS / 1000)));
      return res.status(429).json({error: "Too many requests from this address. Please retry shortly."});
    }
    const customer = await validateApiKey(req);
    if (!customer) {
      return res.status(401).json({error: "A valid X-API-Key is required for inquiry intake."});
    }
    if (expectedCustomerId && customer.customerId !== expectedCustomerId) {
      return res.status(403).json({error: "This API key does not belong to the webhook owner."});
    }
    // Rate limits are keyed on a salted hash of the presented key so a leaked
    // counter document can never be reversed into a usable credential.
    const keyFingerprint = crypto.createHash("sha256")
        .update(`rate:${String(req.headers["x-api-key"] || "")}`).digest("hex").slice(0, 40);
    if (!await checkRateLimit(`inquiry-key-${keyFingerprint}`, INQUIRY_RATE_MAX, INQUIRY_RATE_WINDOW_MS)) {
      res.set("Retry-After", String(Math.ceil(INQUIRY_RATE_WINDOW_MS / 1000)));
      return res.status(429).json({
        error: "This API key exceeded its inquiry rate limit. Please retry shortly.",
      });
    }
    // Secondary per-IP ceiling. Keys are long lived and a leaked one can be
    // rotated to a fresh IP range, so this backstop caps total abuse volume.
    const ipFingerprint = crypto.createHash("sha256")
        .update(`ip:${req.ip || "unknown"}`).digest("hex").slice(0, 40);
    if (!await checkRateLimit(`inquiry-ip-${ipFingerprint}`, INQUIRY_RATE_MAX * 5, INQUIRY_RATE_WINDOW_MS)) {
      res.set("Retry-After", String(Math.ceil(INQUIRY_RATE_WINDOW_MS / 1000)));
      return res.status(429).json({error: "Too many requests from this address. Please retry shortly."});
    }
    const enrichedBody = {
      ...req.body,
      customerId: customer.customerId,
      businessName: customer.businessName,
      plan: customer.plan,
      receivedAt: new Date().toISOString(),
    };
    const idempotencyKey = req.headers["idempotency-key"];
    if (idempotencyKey && (typeof idempotencyKey !== "string" || idempotencyKey.length > 128)) {
      return res.status(400).json({error: "Idempotency-Key must be a string of at most 128 characters."});
    }
    const inquiryId = idempotencyKey ? crypto.createHash("sha256")
        .update(`${customer.customerId}:${idempotencyKey}`).digest("hex") : null;
    const inquiryRef = inquiryId ? db.collection("inquiries").doc(inquiryId) : db.collection("inquiries").doc();
    try {
      await inquiryRef.create({
        name: name.trim(), email: email.trim().toLowerCase(), company: company.trim(),
        message: message.trim(), customerId: customer.customerId,
        businessName: customer.businessName || "", status: "Pending",
        processingStatus: MAKE_WEBHOOK_URL ? "pending" : "not_configured",
        createdAt: FieldValue.serverTimestamp(), last_active: enrichedBody.receivedAt,
      });
    } catch (error) {
      if (inquiryId && (error.code === 6 || error.code === "already-exists")) {
        const existing = await inquiryRef.get();
        return res.status(202).json({
          accepted: true, id: inquiryRef.id,
          processingStatus: existing.data()?.processingStatus || "pending", duplicate: true,
        });
      }
      throw error;
    }
    let classification = {};
    let processingStatus = "not_configured";
    if (MAKE_WEBHOOK_URL) {
      try {
        const response = await requestWebhook(MAKE_WEBHOOK_URL, {body: {...enrichedBody, inquiryId: inquiryRef.id}});
        classification = response && typeof response === "object" &&
          response.classification && typeof response.classification === "object" ?
          response.classification : {};
        processingStatus = Object.keys(classification).length ? "classified" : "no_classification";
      } catch (error) {
        processingStatus = "failed";
        console.error("[Make Webhook] Inquiry processing failed:", error);
      }
    }
    try {
      await inquiryRef.update({
        processingStatus,
        intent: classification.intent || "", urgency: classification.urgency || "",
        fit_score: classification.fit_score ?? "", category: classification.category || "",
        summary: classification.summary || "", suggested_action: classification.suggested_action || "",
      });
    } catch (error) {
      console.error("[Inquiry Intake] Failed to save classification:", error);
      processingStatus = "failed";
    }
    try {
      const keySnapshot = await db.collection("apiKeys").where("key", "==", req.headers["x-api-key"]).limit(1).get();
      if (!keySnapshot.empty) {
        await keySnapshot.docs[0].ref.update({
          totalInquiries: FieldValue.increment(1), lastUsedAt: FieldValue.serverTimestamp(),
        });
      }
      const notification = await db.collection("users").doc(customer.customerId)
          .collection("data-sources").doc("notifications").get();
      if (notification.exists && notification.data().slackWebhookUrl) {
        await sendSlackNotification(notification.data().slackWebhookUrl, req.body, classification);
      }
    } catch (error) {
      console.error("[Inquiry Intake] Usage or notification update failed:", error);
    }
    try {
      const sheetSource = await db.collection("users").doc(customer.customerId)
          .collection("data-sources").doc("google-sheets").get();
      if (sheetSource.exists && sheetSource.data().connected && sheetSource.data().config?.spreadsheetId) {
        await googleSheets.appendRow(sheetSource.data().config.spreadsheetId, {...enrichedBody, ...classification});
      }
    } catch (error) {
      console.error("[Google Sheets] Failed to append inquiry:", error);
    }
    return res.status(202).json({accepted: true, id: inquiryRef.id, processingStatus});
  } catch (error) {
    console.error("[Inquiry Intake] Failed to save inquiry:", error);
    return res.status(500).json({error: "The inquiry could not be saved."});
  }
};

app.post("/api/inquiries", (req, res) => handleInquiry(req, res));

app.post("/api/contact", async (req, res) => {
  const ownerId = process.env.NODALX_OWNER_UID;
  if (!ownerId) return res.status(503).json({error: "Contact intake is not configured."});
  const {name, email, company, message, phone, industry, service} = req.body || {};
  if ([name, email, company, message].some((value) => typeof value !== "string" || !value.trim())) {
    return res.status(400).json({error: "Name, email, company, and message are required."});
  }
  try {
    const visitorId = crypto.createHash("sha256").update(req.ip || "unknown").digest("hex");
    if (!await checkRateLimit(`contact-${visitorId}`, 5, 60000)) {
      return res.status(429).json({error: "Too many submissions. Please try again later."});
    }
    const inquiryRef = await db.collection("inquiries").add({
      name: name.trim(), email: email.trim().toLowerCase(), company: company.trim(),
      message: message.trim(), phone: typeof phone === "string" ? phone.trim() : "",
      industry: typeof industry === "string" ? industry.trim() : "",
      service: typeof service === "string" ? service.trim() : "",
      customerId: ownerId, source: "site_contact",
      status: "Pending", processingStatus: "not_requested",
      createdAt: FieldValue.serverTimestamp(), last_active: new Date().toISOString(),
    });
    return res.status(201).json({accepted: true, id: inquiryRef.id});
  } catch (error) {
    console.error("[Contact Intake] Failed:", error);
    return res.status(500).json({error: "The inquiry could not be saved."});
  }
});

// NOTE: the former POST /api/flows/test endpoint was removed. It took no
// authentication and reflected the request body verbatim, making it an
// unauthenticated request reflector reachable through the /api/** Hosting
// rewrite. Nothing in the frontend called it.

app.patch("/api/inquiries/:id/status", async (req, res) => {
  try {
    const userId = await requireUserId(req, res);
    if (!userId) return;
    const {status} = req.body;
    if (!ALLOWED_INQUIRY_STATUSES.has(status)) {
      return res.status(400).json({
        error: "Invalid status",
        allowedStatuses: [...ALLOWED_INQUIRY_STATUSES],
      });
    }

    const docRef = db.collection("inquiries").doc(req.params.id);
    const inquiry = await docRef.get();
    if (!inquiry.exists || inquiry.data().customerId !== userId) {
      return res.status(404).json({error: "Inquiry not found"});
    }
    await docRef.update({
      status: status,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return res.json({success: true, status});
  } catch (error) {
    console.error("[Status Update Error]", error);
    return res.status(500).json({error: "Failed to update status"});
  }
});

app.get("/api/integrations/notifications", async (req, res) => {
  try {
    const userId = await requireUserId(req, res);
    if (!userId) return;

    const notifDoc = await db.collection("users").doc(userId).collection("data-sources").doc("notifications").get();
    if (!notifDoc.exists) return res.json({slackWebhookUrl: "", emailAlerts: true});

    return res.json(notifDoc.data());
  } catch (error) {
    return res.status(500).json({error: "Failed to fetch notification settings"});
  }
});

app.put("/api/integrations/notifications", async (req, res) => {
  try {
    const userId = await requireUserId(req, res);
    if (!userId) return;
    const {slackWebhookUrl, emailAlerts} = req.body;

    await db.collection("users").doc(userId).collection("data-sources").doc("notifications").set({
      slackWebhookUrl: slackWebhookUrl || "",
      emailAlerts: emailAlerts !== false,
      updatedAt: FieldValue.serverTimestamp(),
    }, {merge: true});

    return res.json({success: true, message: "Notification settings updated successfully"});
  } catch (error) {
    return res.status(500).json({error: "Failed to save notification settings"});
  }
});

app.post("/api/integrations/notifications/test", async (req, res) => {
  try {
    const userId = await requireUserId(req, res);
    if (!userId) return;

    const slackWebhookUrl = req.body.slackWebhookUrl;

    if (!slackWebhookUrl || typeof slackWebhookUrl !== "string" || !slackWebhookUrl.trim()) {
      return res.status(400).json({
        error: "Slack Webhook URL is required.",
      });
    }

    const trimmedUrl = slackWebhookUrl.trim();
    if (!trimmedUrl.startsWith("https://hooks.slack.com/")) {
      return res.status(400).json({
        error: "Invalid Slack Webhook URL. It must start with https://hooks.slack.com/",
      });
    }

    const testPayload = {
      text: "🎉 *NodalX Test Alert*: Your Slack integration is working perfectly!",
    };

    const slackResponse = await fetch(trimmedUrl, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(testPayload),
    });

    if (slackResponse.ok) {
      return res.json({
        success: true,
        message: "Slack alert sent! Check your Slack channel.",
      });
    } else {
      const slackError = await slackResponse.text();
      console.error("[Slack Test Error]:", slackResponse.status, slackError);
      return res.status(400).json({
        error: `Slack rejected the request (${slackResponse.status}): ${
          slackError || "Please verify your Incoming Webhook URL."}`,
      });
    }
  } catch (error) {
    console.error("[Test Slack Notification Error]:", error);
    return res.status(500).json({
      error: "Failed to send test notification. Please check your network connection and Webhook URL.",
    });
  }
});

app.get("/api/customers", async (req, res) => {
  try {
    const userId = await requireUserId(req, res);
    if (!userId) return;

    // Read stored inquiries from Firestore
    const snapshot = await db.collection("inquiries")
        .where("customerId", "==", userId)
        .orderBy("createdAt", "desc")
        .limit(100)
        .get();

    if (snapshot.empty) {
      return res.json([]);
    }

    const customers = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
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
        last_active: data.last_active || (
          data.createdAt ? data.createdAt.toDate().toISOString() : ""
        ),
      };
    });

    res.set("X-NodalX-Data-Source", "firestore");
    return res.json(customers);
  } catch (error) {
    console.error("[Server Error] Loading customers failed:", error);
    return res.status(502).json({error: "Failed to load customer data."});
  }
});

const firebaseAuth = getAuth();
const userCollection = (userId) => db.collection("users").doc(userId);
const flowCollection = (userId) => userCollection(userId).collection("flows");
const profileDocument = (userId) => userCollection(userId).collection("profile").doc("main");
const dataSourceCollection = (userId) => userCollection(userId).collection("data-sources");

/**
 * Convert Firestore timestamp to ISO string if applicable.
 * @param {*} value The value to serialize.
 * @return {*} The serialized value.
 */
function serializeFirestoreValue(value) {
  if (value && typeof value.toDate === "function") return value.toDate().toISOString();
  return value;
}

/**
 * Serialize a Firestore document to plain JSON.
 * @param {Object} document The Firestore document snapshot.
 * @return {Object} Plain JSON object.
 */
function serializeDocument(document) {
  const data = document.data() || {};
  return Object.fromEntries(Object.entries(data).map(([key, value]) => [key, serializeFirestoreValue(value)]));
}

/**
 * Get default data sources for a new user.
 * @return {Array} Array of data source configs.
 */
function getDefaultDataSources() {
  return [
    {id: "google-sheets", name: "Google Sheets", connected: false, config: {}},
    {id: "webhooks", name: "Webhooks", connected: false, config: {url: "/api/inquiries"}},
  ];
}

/**
 * Get default profile for a new user.
 * @param {string} uid The user ID.
 * @param {Object} user The Firebase user object.
 * @return {Object} Default profile object.
 */
function getDefaultProfile(uid, user) {
  return {
    uid,
    displayName: user?.displayName || "User",
    email: user?.email || "",
    photoURL: user?.photoURL || "",
    workspace: "My Workspace",
    role: "Founder",
    timezone: "UTC",
    notifications: {flowFailure: true, weeklySummary: true, securityAlerts: true},
    subscription: {tier: "starter", status: "active", executionsUsed: 0, executionsLimit: 1000, nextInvoiceDate: ""},
    apiKeys: [],
  };
}

/**
 * Extract user ID from Firebase ID token in Authorization header.
 * @param {Object} req The HTTP request object.
 * @return {Promise<string>} The user ID.
 */
async function getUserId(req) {
  const authorization = req.headers.authorization || "";
  if (!authorization.startsWith("Bearer ")) {
    const error = new Error("Authentication required");
    error.status = 401;
    throw error;
  }
  const token = authorization.slice("Bearer ".length);
  const decodedToken = await firebaseAuth.verifyIdToken(token);
  return decodedToken.uid;
}

/**
 * Require authentication and return user ID, or send 401 response.
 * @param {Object} req The HTTP request object.
 * @param {Object} res The HTTP response object.
 * @return {Promise<string|null>} The user ID or null if authentication fails.
 */
async function requireUserId(req, res) {
  try {
    return await getUserId(req);
  } catch (error) {
    res.status(error.status || 401).json({error: "Authentication required"});
    return null;
  }
}

app.get("/api/flows", async (req, res) => {
  try {
    const userId = await requireUserId(req, res);
    if (!userId) return;
    const snapshot = await flowCollection(userId).orderBy("createdAt", "desc").get();
    res.json(snapshot.docs.map(serializeDocument));
  } catch (error) {
    res.status(500).json({error: "Failed to load flows"});
  }
});

app.post("/api/flows", async (req, res) => {
  try {
    const userId = await requireUserId(req, res);
    if (!userId) return;
    const {name, steps, status = "inactive"} = req.body;
    if (!name || !steps) return res.status(400).json({error: "Name and steps are required"});
    const flowRef = flowCollection(userId).doc();
    await flowRef.set({
      id: flowRef.id,
      name,
      steps: Array.isArray(steps) ? steps : [],
      status,
      lastRun: "Never",
      primaryMetric: "0 Executions",
      actions: Array.isArray(steps) ? steps.length : 0,
      subMetrics: [{label: "Avg Duration", value: "0s"}, {label: "Success Rate", value: "0%"}],
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    res.status(201).json(serializeDocument(await flowRef.get()));
  } catch (error) {
    res.status(500).json({error: "Failed to create flow"});
  }
});

app.put("/api/flows/:flowId", async (req, res) => {
  try {
    const userId = await requireUserId(req, res);
    if (!userId) return;
    const flowRef = flowCollection(userId).doc(req.params.flowId);
    if (!(await flowRef.get()).exists) return res.status(404).json({error: "Flow not found"});
    // `const {...updates} = req.body` is a no-op rest destructure that forwards
    // everything, letting the caller rewrite server-owned id/createdAt fields.
    // Explicitly drop them; the backend twin already did.
    const {id, createdAt, ...updates} = req.body || {};
    await flowRef.set({...updates, updatedAt: FieldValue.serverTimestamp()}, {merge: true});
    res.json(serializeDocument(await flowRef.get()));
  } catch (error) {
    res.status(500).json({error: "Failed to update flow"});
  }
});

app.delete("/api/flows/:flowId", async (req, res) => {
  try {
    const userId = await requireUserId(req, res);
    if (!userId) return;
    const flowRef = flowCollection(userId).doc(req.params.flowId);
    if (!(await flowRef.get()).exists) return res.status(404).json({error: "Flow not found"});
    await flowRef.delete();
    res.json({success: true});
  } catch (error) {
    res.status(500).json({error: "Failed to delete flow"});
  }
});

app.get("/api/user/profile", async (req, res) => {
  try {
    const userId = await requireUserId(req, res);
    if (!userId) return;
    const profileRef = profileDocument(userId);
    let profileSnapshot = await profileRef.get();
    if (!profileSnapshot.exists) {
      const firebaseUser = await firebaseAuth.getUser(userId);
      await profileRef.set({
        ...getDefaultProfile(userId, firebaseUser),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      profileSnapshot = await profileRef.get();
    }
    res.json(serializeDocument(profileSnapshot));
  } catch (error) {
    res.status(500).json({error: "Failed to load profile"});
  }
});

app.put("/api/user/profile", async (req, res) => {
  try {
    const userId = await requireUserId(req, res);
    if (!userId) return;
    const profileRef = profileDocument(userId);
    const currentSnapshot = await profileRef.get();
    const currentProfile = currentSnapshot.exists ? currentSnapshot.data() : getDefaultProfile(userId, {});

    // SECURITY: field-level allow-list. Spreading req.body would let a caller set
    // billing-owned fields, and `subscription` in particular is read as the
    // entitlement fallback by resolveTier, so accepting it here would be a
    // self-service upgrade to the paid tier.
    const EDITABLE_PROFILE_FIELDS = ["displayName", "photoURL", "workspace", "role", "timezone"];
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const safeUpdates = {};
    for (const field of EDITABLE_PROFILE_FIELDS) {
      if (typeof body[field] === "string" && body[field].trim()) {
        safeUpdates[field] = body[field].trim();
      }
    }

    const safeNotifications = {};
    const requestedNotifications =
      body.notifications && typeof body.notifications === "object" ? body.notifications : {};
    for (const key of ["flowFailure", "weeklySummary", "securityAlerts"]) {
      if (typeof requestedNotifications[key] === "boolean") {
        safeNotifications[key] = requestedNotifications[key];
      }
    }

    await profileRef.set({
      ...currentProfile,
      ...safeUpdates,
      uid: userId,
      email: currentProfile.email || "",
      apiKeys: currentProfile.apiKeys || [],
      // subscription is server-owned: preserved verbatim, never taken from the body.
      subscription: currentProfile.subscription || getDefaultProfile(userId, {}).subscription,
      notifications: {...(currentProfile.notifications || {}), ...safeNotifications},
      updatedAt: FieldValue.serverTimestamp(),
    }, {merge: true});
    res.json(serializeDocument(await profileRef.get()));
  } catch (error) {
    res.status(500).json({error: "Failed to update profile"});
  }
});

app.get("/api/connectors", async (req, res) => {
  try {
    const userId = await requireUserId(req, res);
    if (!userId) return;
    const sourceSnapshot = await dataSourceCollection(userId).get();
    if (sourceSnapshot.empty) {
      const batch = db.batch();
      getDefaultDataSources().forEach((source) => batch.set(dataSourceCollection(userId).doc(source.id), {
        ...source,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }));
      await batch.commit();
      return res.json(getDefaultDataSources());
    }
    res.json(sourceSnapshot.docs.map(serializeDocument));
  } catch (error) {
    res.status(500).json({error: "Failed to load connectors"});
  }
});

app.put("/api/connectors/:connectorId", async (req, res) => {
  try {
    const userId = await requireUserId(req, res);
    if (!userId) return;
    const sourceRef = dataSourceCollection(userId).doc(req.params.connectorId);
    if (!(await sourceRef.get()).exists) return res.status(404).json({error: "Connector not found"});
    const currentSource = (await sourceRef.get()).data();
    await sourceRef.set({
      ...req.body,
      config: {...currentSource.config, ...req.body.config},
      updatedAt: FieldValue.serverTimestamp(),
    }, {merge: true});
    res.json(serializeDocument(await sourceRef.get()));
  } catch (error) {
    res.status(500).json({error: "Failed to update connector"});
  }
});

app.post("/api/connectors/google-sheets/verify", async (req, res) => {
  try {
    const userId = await requireUserId(req, res);
    if (!userId) return;

    const {spreadsheetId} = req.body;
    if (!spreadsheetId || typeof spreadsheetId !== "string" || !spreadsheetId.trim()) {
      return res.status(400).json({error: "Spreadsheet ID or URL is required"});
    }

    // Extract and sanitize spreadsheet ID (handles both URLs and raw IDs)
    let sanitizedId;
    try {
      sanitizedId = googleSheets.extractSpreadsheetId(spreadsheetId);
    } catch (extractError) {
      return res.status(400).json({error: extractError.message});
    }

    // Verify access
    let result;
    try {
      result = await googleSheets.verifyAccess(sanitizedId);
    } catch (verifyError) {
      const message = verifyError.message || "Failed to verify Google Sheet access";
      if (message.includes("Permission denied")) {
        return res.status(403).json({error: message});
      }
      if (message.includes("not found") || message.includes("does not exist")) {
        return res.status(404).json({error: message});
      }
      return res.status(500).json({error: message});
    }

    // Save it if successful
    const sourceRef = dataSourceCollection(userId).doc("google-sheets");
    await sourceRef.set({
      connected: true,
      config: {spreadsheetId: sanitizedId},
      updatedAt: FieldValue.serverTimestamp(),
    }, {merge: true});

    return res.json({
      success: true,
      title: result.title,
      spreadsheetId: sanitizedId,
      message: "Google Sheet connected successfully!",
    });
  } catch (error) {
    console.error("[Google Sheets Verify Error]:", error);
    return res.status(500).json({error: "An unexpected error occurred while verifying the Google Sheet"});
  }
});

app.get("/api/connectors/google-sheets/service-account", async (req, res) => {
  try {
    const userId = await requireUserId(req, res);
    if (!userId) return;
    const serviceAccountEmail = await googleSheets.getServiceAccountEmail();
    return res.json({serviceAccountEmail});
  } catch (error) {
    console.error("[Google Sheets Service Account Error]", error);
    return res.status(500).json({error: "Failed to identify the Google Sheets service account."});
  }
});

app.post("/api/connectors/google-sheets/analyze", async (req, res) => {
  try {
    const userId = await requireUserId(req, res);
    if (!userId) return;
    if (!MAKE_WEBHOOK_URL) {
      return res.status(503).json({
        error: "AI classification is not configured. Connect the workflow before analyzing a sheet.",
      });
    }

    const sourceDoc = await dataSourceCollection(userId).doc("google-sheets").get();
    if (!sourceDoc.exists || !sourceDoc.data().connected || !sourceDoc.data().config?.spreadsheetId) {
      return res.status(400).json({error: "Connect and verify a Google Sheet before analyzing it."});
    }
    const spreadsheetId = sourceDoc.data().config.spreadsheetId;

    // Read rows from the sheet
    let sheetData;
    try {
      sheetData = await googleSheets.readSheetRows(spreadsheetId);
    } catch (readError) {
      const message = readError.message || "Failed to read Google Sheet";
      if (message.includes("Permission denied")) {
        return res.status(403).json({error: message});
      }
      if (message.includes("not found") || message.includes("does not exist")) {
        return res.status(404).json({error: message});
      }
      return res.status(500).json({error: message});
    }

    const {rows, isEmpty} = sheetData;
    if (isEmpty || !rows || rows.length === 0) {
      return res.status(400).json({
        error: "Google Sheet contains no data rows in Sheet1. Please add data and try again.",
      });
    }

    const results = [];
    const classificationsToWrite = [];

    for (let i = 0; i < Math.min(rows.length, 50); i++) {
      const row = rows[i];
      const name = row["Name"] || row["Full Name"] || row["First Name"] || row["name"] || "";
      const email = row["Email"] || row["Email Address"] || row["email"] || "";
      const company = row["Company"] || row["Organization"] || row["company"] || "";
      const message = row["Message"] || row["Inquiry"] || row["Notes"] || row["Description"] ||
          row["message"] || JSON.stringify(row);

      const inquiryData = {name, email, company, message};

      let classification;
      try {
        const workflowResponse = await requestWebhook(MAKE_WEBHOOK_URL, {
          body: {...inquiryData, receivedAt: new Date().toISOString(), source: "google_sheets_bulk"},
        });
        classification = workflowResponse?.classification;
        if (!classification || typeof classification !== "object" || !Object.keys(classification).length) {
          throw new Error("Workflow returned no classification");
        }
      } catch (error) {
        console.error("[Make Webhook Sheet Error]", error);
        return res.status(502).json({
          error: `Classification stopped at sheet row ${row._rowIndex}. No AI results were written.`,
        });
      }

      const item = {
        row: row._rowIndex,
        ...inquiryData,
        intent: classification.intent || "",
        urgency: classification.urgency || "",
        fit_score: classification.fit_score ?? "",
        summary: classification.summary || "",
        status: "classified",
      };

      results.push(item);
      classificationsToWrite.push(classification);
    }

    try {
      await googleSheets.writeClassificationsToSheet(spreadsheetId, classificationsToWrite);
    } catch (writeErr) {
      console.error("[Sheet Writeback Error]", writeErr);
      return res.status(502).json({
        error: "AI analysis finished, but the results could not be written to Google Sheets.",
      });
    }

    return res.json({
      success: true,
      title: `Analyzed ${results.length} rows`,
      message: `Successfully analyzed ${results.length} of ${rows.length} rows`,
      totalRows: rows.length,
      processedRows: results.length,
      results,
      spreadsheetId,
    });
  } catch (error) {
    console.error("[Google Sheets Analysis Error]:", error);
    return res.status(500).json({error: "An unexpected error occurred while analyzing the Google Sheet"});
  }
});

app.post("/api/webhook/:webhookId", (req, res) => handleInquiry(req, res, req.params.webhookId));

app.post("/api/onboarding/generate-key", async (req, res) => {
  try {
    const userId = await requireUserId(req, res);
    if (!userId) return;

    const existingKeyDoc = await db.collection("apiKeys")
        .where("customerId", "==", userId)
        .where("active", "==", true)
        .limit(1)
        .get();

    if (!existingKeyDoc.empty) {
      const keyData = existingKeyDoc.docs[0].data();
      return res.json({
        apiKey: keyData.key,
        businessName: keyData.businessName,
        plan: keyData.plan,
        createdAt: serializeFirestoreValue(keyData.createdAt),
      });
    }

    const newApiKey = generateApiKey();
    const newKeyDoc = {
      key: newApiKey,
      customerId: userId,
      businessName: "",
      plan: "starter",
      active: true,
      totalInquiries: 0,
      createdAt: FieldValue.serverTimestamp(),
      lastUsedAt: FieldValue.serverTimestamp(),
    };

    await db.collection("apiKeys").add(newKeyDoc);

    return res.status(201).json({
      apiKey: newApiKey,
      businessName: "",
      plan: "starter",
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error generating API key:", error);
    res.status(500).json({error: "Failed to generate API key"});
  }
});

app.get("/api/onboarding/status", async (req, res) => {
  try {
    const userId = await requireUserId(req, res);
    if (!userId) return;

    const keyDoc = await db.collection("apiKeys")
        .where("customerId", "==", userId)
        .where("active", "==", true)
        .limit(1)
        .get();

    if (keyDoc.empty) {
      return res.json({
        hasApiKey: false,
        totalInquiries: 0,
      });
    }

    const keyData = keyDoc.docs[0].data();
    return res.json({
      hasApiKey: true,
      apiKey: keyData.key,
      businessName: keyData.businessName,
      plan: keyData.plan,
      totalInquiries: keyData.totalInquiries || 0,
      createdAt: serializeFirestoreValue(keyData.createdAt),
    });
  } catch (error) {
    console.error("Error getting onboarding status:", error);
    res.status(500).json({error: "Failed to get onboarding status"});
  }
});

app.put("/api/onboarding/business-name", async (req, res) => {
  try {
    const userId = await requireUserId(req, res);
    if (!userId) return;

    const {businessName} = req.body;
    if (!businessName || typeof businessName !== "string") {
      return res.status(400).json({error: "businessName must be a non-empty string"});
    }
    if (businessName.length > 100) {
      return res.status(400).json({error: "businessName must be under 100 characters"});
    }

    const keyQuery = await db.collection("apiKeys")
        .where("customerId", "==", userId)
        .where("active", "==", true)
        .limit(1)
        .get();

    if (keyQuery.empty) {
      return res.status(404).json({error: "No active API key found"});
    }

    await keyQuery.docs[0].ref.update({
      businessName,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return res.json({success: true, businessName});
  } catch (error) {
    console.error("Error updating business name:", error);
    res.status(500).json({error: "Failed to update business name"});
  }
});

app.post("/api/analyze/upload", async (req, res) => {
  try {
    const userId = await requireUserId(req, res);
    if (!userId) return;

    if (!await checkRateLimit(userId, 5, 60000)) {
      return res.status(429).json({error: "Too many uploads. Please wait before uploading again."});
    }

    // An X-API-Key may be presented for attribution, but it must belong to the
    // caller. The Sheets/analysis service account and quota counters are
    // shared infrastructure, so trusting a foreign key here would let a starter
    // account borrow an enterprise key for a 10000-row quota and would write
    // usage onto another tenant's key document.
    const customer = await validateApiKey(req);
    if (customer && customer.customerId && customer.customerId !== userId) {
      return res.status(403).json({
        error: "The supplied API key does not belong to the authenticated user.",
      });
    }

    // Parse the uploaded file. A streaming limit violation surfaces here, so it
    // is mapped to 413 rather than falling through to the generic 500.
    let fileBuffer;
    let fileName;
    try {
      ({fileBuffer, fileName} = await parseFileUpload(req));
    } catch (uploadError) {
      if (uploadError && uploadError.status === 413) {
        return res.status(413).json({error: uploadError.message});
      }
      console.error("Error reading upload:", uploadError);
      return res.status(400).json({error: "Could not read the uploaded file."});
    }

    if (!fileBuffer || fileBuffer.length === 0) {
      return res.status(400).json({error: "No file uploaded"});
    }

    // Parse the spreadsheet
    let rows;
    try {
      rows = parseSpreadsheet(fileBuffer, fileName);
    } catch (parseError) {
      return res.status(400).json({error: `Failed to parse file: ${parseError.message}`});
    }

    if (!rows || rows.length === 0) {
      return res.status(400).json({error: "File contains no data rows"});
    }

    // Row quota comes from the caller's own server-owned plan, never from a
    // presented key.
    const [userDoc, profileDoc] = await Promise.all([
      db.collection("users").doc(userId).get(),
      profileDocument(userId).get(),
    ]);
    const {plan} = resolveTier(userDoc.data(), profileDoc.data());
    let maxRows = 50; // default
    if (plan === "pro") maxRows = 500;
    if (plan === "enterprise") maxRows = 10000;
    const limitedRows = rows.slice(0, maxRows);
    const wasLimited = rows.length > maxRows;

    // Create batch record in Firestore
    const batchId = crypto.randomBytes(8).toString("hex");
    const batchRef = db.collection("analyses").doc(batchId);
    await batchRef.set({
      userId,
      customerId: userId,
      businessName: customer?.businessName || "",
      fileName,
      totalRows: rows.length,
      processedRows: 0,
      status: "processing",
      createdAt: FieldValue.serverTimestamp(),
    });

    // Process each row through the n8n pipeline
    const results = [];
    for (let i = 0; i < limitedRows.length; i++) {
      const row = limitedRows[i];

      // Skip rows with no meaningful data (all empty values)
      const hasData = Object.values(row).some((v) => v !== null && v !== undefined && String(v).trim() !== "");
      if (!hasData) {
        results.push({raw_data: row, row: i + 1, status: "skipped", reason: "Empty row"});
        continue;
      }

      try {
        if (MAKE_WEBHOOK_URL) {
          const enrichedBody = {
            raw_data: row,
            ...(customer ? {
              customerId: customer.customerId,
              businessName: customer.businessName,
              plan: customer.plan,
            } : {}),
            receivedAt: new Date().toISOString(),
            source: "bulk_upload",
            batchId,
          };

          const webhookResponse = await requestWebhook(MAKE_WEBHOOK_URL, {body: enrichedBody});
          const classification = webhookResponse?.classification || {};
          if (!Object.keys(classification).length) {
            throw new Error("Workflow returned no classification");
          }

          // If a spreadsheet is provided, write to it
          if (req.body.spreadsheetId) {
            try {
              await googleSheets.appendRow(req.body.spreadsheetId, {
                ...row,
                ...classification,
              });
            } catch (err) {
              console.error("[Google Sheets] Bulk upload append failed for row:", err);
            }
          }

          results.push({
            row: i + 1,
            raw_data: row,
            name: classification.extracted_name || classification.name || "",
            email: classification.extracted_email || classification.email || "",
            company: classification.extracted_company || classification.company || "",
            intent: classification.intent || "",
            urgency: classification.urgency || "",
            fit_score: classification.fit_score ?? "",
            summary: classification.summary || "",
            suggested_action: classification.suggested_action || "",
            category: classification.category || "",
            status: "classified",
          });
        } else {
          results.push({raw_data: row, row: i + 1, status: "error", reason: "Workflow not configured"});
        }
      } catch (err) {
        results.push({raw_data: row, row: i + 1, status: "error", reason: err.message});
      }

      // Update progress every 5 rows
      if ((i + 1) % 5 === 0 || i === limitedRows.length - 1) {
        await batchRef.update({processedRows: i + 1});
      }
    }

    // Mark batch as complete and store results
    await batchRef.update({
      status: "completed",
      processedRows: limitedRows.length,
      completedAt: FieldValue.serverTimestamp(),
    });

    // Store results as a subcollection (in chunks if large)
    const resultChunkSize = 100;
    for (let i = 0; i < results.length; i += resultChunkSize) {
      const chunk = results.slice(i, i + resultChunkSize);
      await batchRef.collection("results").doc(`chunk_${Math.floor(i / resultChunkSize)}`).set({items: chunk});
    }

    // Track usage on the caller's own key. customer.customerId is guaranteed to
    // equal userId by the ownership check at the top of the handler, so this can
    // no longer increment another tenant's quota.
    if (customer) {
      const keyQuery = await db.collection("apiKeys")
          .where("customerId", "==", userId)
          .where("active", "==", true)
          .limit(1).get();
      if (!keyQuery.empty) {
        await keyQuery.docs[0].ref.update({
          totalInquiries: FieldValue.increment(limitedRows.length),
          lastUsedAt: FieldValue.serverTimestamp(),
        });
      }
    }

    return res.json({
      batchId,
      fileName,
      totalRows: rows.length,
      processedRows: limitedRows.length,
      wasLimited,
      maxRows,
      results,
    });
  } catch (error) {
    console.error("Error in bulk analysis:", error);
    res.status(500).json({error: "Failed to process file: " + error.message});
  }
});

app.get("/api/analyze/history", async (req, res) => {
  try {
    const userId = await requireUserId(req, res);
    if (!userId) return;

    const snapshot = await db.collection("analyses")
        .where("userId", "==", userId)
        .orderBy("createdAt", "desc")
        .limit(20)
        .get();

    const analyses = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: serializeFirestoreValue(doc.data().createdAt),
      completedAt: serializeFirestoreValue(doc.data().completedAt),
    }));

    return res.json({analyses});
  } catch (error) {
    console.error("Error fetching analysis history:", error);
    res.status(500).json({error: "Failed to fetch analysis history"});
  }
});

app.get("/api/analyze/:batchId", async (req, res) => {
  try {
    const userId = await requireUserId(req, res);
    if (!userId) return;

    const batchDoc = await db.collection("analyses").doc(req.params.batchId).get();
    if (!batchDoc.exists) {
      return res.status(404).json({error: "Analysis not found"});
    }

    const batchData = batchDoc.data();
    if (batchData.userId !== userId) {
      return res.status(403).json({error: "Access denied"});
    }

    // Get all result chunks
    const resultsSnapshot = await batchDoc.ref.collection("results").get();
    let results = [];
    resultsSnapshot.docs.forEach((doc) => {
      results = results.concat(doc.data().items || []);
    });

    return res.json({
      id: batchDoc.id,
      ...batchData,
      createdAt: serializeFirestoreValue(batchData.createdAt),
      completedAt: serializeFirestoreValue(batchData.completedAt),
      results,
    });
  } catch (error) {
    console.error("Error fetching analysis:", error);
    res.status(500).json({error: "Failed to fetch analysis"});
  }
});

app.get("/api/user/tier", async (req, res) => {
  try {
    const userId = await requireUserId(req, res);
    if (!userId) return;

    const userDoc = await db.collection("users").doc(userId).get();
    const profileDoc = await userDoc.ref.collection("profile").doc("main").get();
    const {tier, plan} = resolveTier(userDoc.data(), profileDoc.data());

    return res.json({tier, plan, userId});
  } catch (error) {
    console.error("Error fetching user tier:", error);
    res.status(500).json({error: "Failed to fetch user tier"});
  }
});

app.post("/api/user/redeem-key", async (req, res) => {
  try {
    const userId = await requireUserId(req, res);
    if (!userId) return;

    const {key} = req.body || {};
    if (typeof key !== "string" || key.length === 0) {
      return res.status(400).json({error: "A 'key' string is required."});
    }

    const userRef = db.collection("users").doc(userId);

    const result = await db.runTransaction(async (transaction) => {
      // The key read MUST go through the transaction. Using a plain collection
      // query here leaves the key outside the read set, so concurrent requests
      // both observe redeemed === false and both grant the entitlement.
      const keyQuery = db.collection("apiKeys").where("key", "==", key).limit(1);
      const keySnapshot = await transaction.get(keyQuery);

      if (keySnapshot.empty) {
        const err = new Error("The access key you provided does not exist.");
        err.status = 404;
        throw err;
      }

      const accessKeyRef = keySnapshot.docs[0].ref;
      const keyData = keySnapshot.docs[0].data();
      if (isRedeemed(keyData)) {
        const err = new Error("This access key has already been redeemed.");
        err.status = 409;
        throw err;
      }

      transaction.update(accessKeyRef, {
        redeemed: true,
        redeemedBy: userId,
        redeemedAt: FieldValue.serverTimestamp(),
      });

      const entitlement = entitlementFromKey(keyData.plan || keyData.tier);
      const plan = toPlan(keyData.plan, toPlan(keyData.tier));
      transaction.set(userRef, {tier: entitlement, plan}, {merge: true});
      transaction.set(
          userRef.collection("profile").doc("main"),
          {subscription: {tier: plan, status: "active"}, updatedAt: FieldValue.serverTimestamp()},
          {merge: true},
      );
      return {tier: entitlement, plan};
    });

    await db.collection("auditLogs").add({
      action: "key_redeemed",
      userId,
      tier: result.tier,
      plan: result.plan,
      keyId: key,
      timestamp: FieldValue.serverTimestamp(),
    });

    return res.json({success: true, tier: result.tier, plan: result.plan});
  } catch (error) {
    console.error("Error redeeming key:", error);
    // Only the two statuses we raise deliberately are reflected. Anything else
    // is an internal failure and must not leak its message or drive the status
    // code, since a thrown Firestore error does not set `.status` but a future
    // dependency might.
    const status = error.status === 404 || error.status === 409 ? error.status : 500;
    const message = status === 500 ? "Failed to redeem key." : error.message;
    return res.status(status).json({error: message});
  }
});

exports.api = onRequest({invoker: "public"}, app);

// Scheduled maintenance and analytics rollups. Kept in lib/jobs.js so the
// request handler above stays focused on serving traffic.
Object.assign(exports, require("./lib/jobs"));
